import { Router, Request, Response } from 'express';
import { getDb } from '../database/db';
import { authenticate, authorize } from '../middleware/auth';
import { logAudit } from '../utils/audit';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  let branches;
  if (req.user!.role === 'super_admin') {
    branches = db.prepare('SELECT * FROM branches ORDER BY name').all();
  } else {
    branches = db.prepare('SELECT * FROM branches WHERE id = ?').all(req.user!.branch_id);
  }
  const result = (branches as any[]).map(b => {
    const stats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM rooms WHERE branch_id = ? AND status != 'maintenance') as total_rooms,
        (SELECT COUNT(*) FROM rooms WHERE branch_id = ? AND status = 'occupied') as occupied_rooms,
        (SELECT COUNT(*) FROM tenants WHERE branch_id = ? AND status = 'active') as active_tenants,
        (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE branch_id = ? AND status = 'paid' AND month_year = strftime('%Y-%m', 'now')) as monthly_revenue
    `).get(b.id, b.id, b.id, b.id);
    return { ...b, stats };
  });
  res.json(result);
});

router.post('/', authorize('super_admin'), (req: Request, res: Response) => {
  const { name, address, phone, email, description, total_floors } = req.body;
  if (!name) return res.status(400).json({ error: 'Branch name required' });
  const db = getDb();
  const id = uuidv4();
  db.prepare(`INSERT INTO branches (id, name, address, phone, email, description, total_floors) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    id, name.toUpperCase(), address, phone, email, description, total_floors || 1
  );
  logAudit(req, 'CREATE_BRANCH', 'branch', id, { name });
  const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(id);
  res.status(201).json(branch);
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  if (req.user!.role !== 'super_admin' && req.user!.branch_id !== req.params.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(req.params.id);
  if (!branch) return res.status(404).json({ error: 'Branch not found' });
  res.json(branch);
});

router.put('/:id', authorize('super_admin', 'admin'), (req: Request, res: Response) => {
  const db = getDb();
  if (req.user!.role === 'admin' && req.user!.branch_id !== req.params.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const { name, address, phone, email, description, total_floors, status } = req.body;
  db.prepare(`
    UPDATE branches SET name=COALESCE(?, name), address=COALESCE(?, address), phone=COALESCE(?, phone),
    email=COALESCE(?, email), description=COALESCE(?, description), total_floors=COALESCE(?, total_floors),
    status=COALESCE(?, status), updated_at=datetime('now') WHERE id=?
  `).run(name?.toUpperCase(), address, phone, email, description, total_floors, status, req.params.id);
  logAudit(req, 'UPDATE_BRANCH', 'branch', req.params.id, req.body);
  res.json(db.prepare('SELECT * FROM branches WHERE id = ?').get(req.params.id));
});

router.delete('/:id', authorize('super_admin'), (req: Request, res: Response) => {
  const db = getDb();
  const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(req.params.id) as any;
  if (!branch) return res.status(404).json({ error: 'Branch not found' });
  db.prepare('DELETE FROM branches WHERE id = ?').run(req.params.id);
  logAudit(req, 'DELETE_BRANCH', 'branch', req.params.id, { name: branch.name });
  res.json({ message: 'Branch deleted' });
});

export default router;
