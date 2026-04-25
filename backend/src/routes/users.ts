import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../database/db';
import { authenticate, authorize } from '../middleware/auth';
import { logAudit } from '../utils/audit';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { role: myRole, branch_id: myBranch } = req.user!;
  const { branch_id, role, status } = req.query;

  let query = `SELECT u.id, u.name, u.email, u.role, u.branch_id, u.permissions, u.status, u.last_login, u.created_at,
    b.name as branch_name FROM users u LEFT JOIN branches b ON u.branch_id = b.id WHERE 1=1`;
  const params: any[] = [];

  if (myRole === 'super_admin') {
    if (branch_id) { query += ' AND u.branch_id = ?'; params.push(branch_id); }
  } else if (myRole === 'admin') {
    query += ' AND u.branch_id = ? AND u.role != ?';
    params.push(myBranch, 'super_admin');
  } else {
    return res.status(403).json({ error: 'Not authorized to list users' });
  }

  if (role) { query += ' AND u.role = ?'; params.push(role); }
  if (status) { query += ' AND u.status = ?'; params.push(status); }
  query += ' ORDER BY u.created_at DESC';

  res.json(db.prepare(query).all(...params));
});

router.post('/', authorize('super_admin', 'admin'), async (req: Request, res: Response) => {
  const { name, email, password, role, branch_id, permissions } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'name, email, password, role required' });

  const myRole = req.user!.role;
  const myBranch = req.user!.branch_id;

  if (myRole === 'admin') {
    if (!['manager','accountant','receptionist','staff'].includes(role)) {
      return res.status(403).json({ error: 'Admin can only create manager or lower roles' });
    }
    if (branch_id && branch_id !== myBranch) {
      return res.status(403).json({ error: 'Cannot create user in another branch' });
    }
  }

  const db = getDb();
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (exists) return res.status(409).json({ error: 'Email already exists' });

  const id = uuidv4();
  const hashed = await bcrypt.hash(password, 10);
  const assignedBranch = myRole === 'admin' ? myBranch : (branch_id || null);
  const perms = permissions ? JSON.stringify(permissions) : '[]';

  db.prepare(`INSERT INTO users (id, name, email, password, role, branch_id, permissions, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, name, email.toLowerCase(), hashed, role, assignedBranch, perms, req.user!.id
  );

  logAudit(req, 'CREATE_USER', 'user', id, { name, email, role });
  const user = db.prepare('SELECT id, name, email, role, branch_id, permissions, status, created_at FROM users WHERE id = ?').get(id) as any;
  res.status(201).json({ ...user, permissions: JSON.parse(user.permissions) });
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const user = db.prepare(`
    SELECT u.id, u.name, u.email, u.role, u.branch_id, u.permissions, u.status, u.last_login, u.created_at,
    b.name as branch_name FROM users u LEFT JOIN branches b ON u.branch_id = b.id WHERE u.id = ?
  `).get(req.params.id) as any;
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (req.user!.role !== 'super_admin' && req.user!.branch_id !== user.branch_id && req.user!.id !== user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  res.json({ ...user, permissions: JSON.parse(user.permissions || '[]') });
});

router.put('/:id', authorize('super_admin', 'admin'), async (req: Request, res: Response) => {
  const db = getDb();
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any;
  if (!target) return res.status(404).json({ error: 'User not found' });

  if (req.user!.role === 'admin' && target.branch_id !== req.user!.branch_id) {
    return res.status(403).json({ error: 'Cannot edit user in another branch' });
  }

  const { name, email, role, branch_id, permissions, status, password } = req.body;
  let newPassword = target.password;
  if (password) newPassword = await bcrypt.hash(password, 10);

  db.prepare(`
    UPDATE users SET name=COALESCE(?,name), email=COALESCE(?,email), role=COALESCE(?,role),
    branch_id=COALESCE(?,branch_id), permissions=COALESCE(?,permissions), status=COALESCE(?,status),
    password=?, updated_at=datetime('now') WHERE id=?
  `).run(name, email?.toLowerCase(), role, branch_id, permissions ? JSON.stringify(permissions) : null, status, newPassword, req.params.id);

  logAudit(req, 'UPDATE_USER', 'user', req.params.id, { name, role, status });
  const updated = db.prepare('SELECT id, name, email, role, branch_id, permissions, status FROM users WHERE id = ?').get(req.params.id) as any;
  res.json({ ...updated, permissions: JSON.parse(updated.permissions || '[]') });
});

router.delete('/:id', authorize('super_admin', 'admin'), (req: Request, res: Response) => {
  const db = getDb();
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as any;
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'super_admin') return res.status(403).json({ error: 'Cannot delete super admin' });
  if (req.user!.role === 'admin' && target.branch_id !== req.user!.branch_id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  db.prepare(`UPDATE users SET status=?, updated_at=datetime('now') WHERE id=?`).run('inactive', req.params.id);
  logAudit(req, 'DEACTIVATE_USER', 'user', req.params.id, { name: target.name });
  res.json({ message: 'User deactivated' });
});

export default router;
