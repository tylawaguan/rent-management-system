import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, queryOne, run } from '../database/db';
import { authenticate, authorize } from '../middleware/auth';
import { logAudit } from '../utils/audit';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { role: myRole, branch_id: myBranch } = req.user!;
    const { branch_id, role, status } = req.query;

    let sql = `SELECT u.id, u.name, u.email, u.role, u.branch_id, u.permissions, u.status, u.last_login, u.created_at,
      b.name as branch_name FROM users u LEFT JOIN branches b ON u.branch_id = b.id WHERE 1=1`;
    const params: any[] = [];

    if (myRole === 'super_admin') {
      if (branch_id) { sql += ' AND u.branch_id = ?'; params.push(branch_id); }
    } else if (myRole === 'admin') {
      sql += ' AND u.branch_id = ? AND u.role != ?';
      params.push(myBranch, 'super_admin');
    } else {
      return res.status(403).json({ error: 'Not authorized to list users' });
    }

    if (role) { sql += ' AND u.role = ?'; params.push(role); }
    if (status) { sql += ' AND u.status = ?'; params.push(status); }
    sql += ' ORDER BY u.created_at DESC';

    res.json(await query(sql, params));
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authorize('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const { name, email, password, role, branch_id, permissions } = req.body;
    if (!name || !email || !password || !role) return res.status(400).json({ error: 'name, email, password, role required' });

    const myRole = req.user!.role;
    const myBranch = req.user!.branch_id;

    if (myRole === 'admin') {
      if (!['manager', 'accountant', 'receptionist', 'staff'].includes(role))
        return res.status(403).json({ error: 'Admin can only create manager or lower roles' });
      if (branch_id && branch_id !== myBranch)
        return res.status(403).json({ error: 'Cannot create user in another branch' });
    }

    const exists = await queryOne('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    if (exists) return res.status(409).json({ error: 'Email already exists' });

    const id = uuidv4();
    const hashed = await bcrypt.hash(password, 10);
    const assignedBranch = myRole === 'admin' ? myBranch : (branch_id || null);
    const perms = permissions ? JSON.stringify(permissions) : '[]';

    await run(
      'INSERT INTO users (id, name, email, password, role, branch_id, permissions, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, email.toLowerCase(), hashed, role, assignedBranch, perms, req.user!.id]
    );

    logAudit(req, 'CREATE_USER', 'user', id, { name, email, role });
    const user = await queryOne<any>('SELECT id, name, email, role, branch_id, permissions, status, created_at FROM users WHERE id = ?', [id]);
    res.status(201).json({ ...user, permissions: JSON.parse(user.permissions) });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = await queryOne<any>(`
      SELECT u.id, u.name, u.email, u.role, u.branch_id, u.permissions, u.status, u.last_login, u.created_at,
      b.name as branch_name FROM users u LEFT JOIN branches b ON u.branch_id = b.id WHERE u.id = ?
    `, [req.params.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (req.user!.role !== 'super_admin' && req.user!.branch_id !== user.branch_id && req.user!.id !== user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json({ ...user, permissions: JSON.parse(user.permissions || '[]') });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', authorize('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const target = await queryOne<any>('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (req.user!.role === 'admin' && target.branch_id !== req.user!.branch_id)
      return res.status(403).json({ error: 'Cannot edit user in another branch' });

    const { name, email, role, branch_id, permissions, status, password } = req.body;
    let newPassword = target.password;
    if (password) newPassword = await bcrypt.hash(password, 10);

    await run(`
      UPDATE users SET
        name = COALESCE(?, name), email = COALESCE(?, email), role = COALESCE(?, role),
        branch_id = COALESCE(?, branch_id), permissions = COALESCE(?, permissions),
        status = COALESCE(?, status), password = ?
      WHERE id = ?
    `, [name, email?.toLowerCase(), role, branch_id, permissions ? JSON.stringify(permissions) : null, status, newPassword, req.params.id]);

    logAudit(req, 'UPDATE_USER', 'user', req.params.id, { name, role, status });
    const updated = await queryOne<any>('SELECT id, name, email, role, branch_id, permissions, status FROM users WHERE id = ?', [req.params.id]);
    res.json({ ...updated, permissions: JSON.parse(updated.permissions || '[]') });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin resets password for a user in their branch
router.post('/:id/reset-password', authorize('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const { new_password } = req.body;
    if (!new_password) return res.status(400).json({ error: 'new_password required' });
    if (new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const target = await queryOne<any>('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role === 'super_admin') return res.status(403).json({ error: 'Cannot reset super admin password' });
    if (req.user!.role === 'admin' && target.branch_id !== req.user!.branch_id)
      return res.status(403).json({ error: 'Access denied' });

    const hashed = await bcrypt.hash(new_password, 10);
    await run('UPDATE users SET password = ? WHERE id = ?', [hashed, req.params.id]);
    logAudit(req, 'RESET_USER_PASSWORD', 'user', req.params.id, { reset_by: req.user!.name });
    res.json({ message: `Password reset for ${target.name}` });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authorize('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const target = await queryOne<any>('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.role === 'super_admin') return res.status(403).json({ error: 'Cannot delete super admin' });
    if (req.user!.role === 'admin' && target.branch_id !== req.user!.branch_id)
      return res.status(403).json({ error: 'Access denied' });

    await run("UPDATE users SET status = 'inactive' WHERE id = ?", [req.params.id]);
    logAudit(req, 'DEACTIVATE_USER', 'user', req.params.id, { name: target.name });
    res.json({ message: 'User deactivated' });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
