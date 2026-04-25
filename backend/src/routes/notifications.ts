import { Router, Request, Response } from 'express';
import { getDb } from '../database/db';
import { authenticate, authorize } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { unread_only } = req.query;
  let query = `SELECT n.*, t.first_name || ' ' || t.last_name as tenant_name, b.name as branch_name
    FROM notifications n
    LEFT JOIN tenants t ON n.tenant_id=t.id
    LEFT JOIN branches b ON n.branch_id=b.id
    WHERE (n.user_id=? OR n.user_id IS NULL)`;
  const params: any[] = [req.user!.id];

  if (req.user!.role !== 'super_admin') {
    query += ' AND (n.branch_id=? OR n.branch_id IS NULL)'; params.push(req.user!.branch_id);
  }
  if (unread_only === 'true') { query += ' AND n.is_read=0'; }
  query += ' ORDER BY n.sent_at DESC LIMIT 100';

  res.json(db.prepare(query).all(...params));
});

router.get('/unread-count', (req: Request, res: Response) => {
  const db = getDb();
  let query = `SELECT COUNT(*) as count FROM notifications WHERE is_read=0 AND (user_id=? OR user_id IS NULL)`;
  const params: any[] = [req.user!.id];
  if (req.user!.role !== 'super_admin') {
    query += ' AND (branch_id=? OR branch_id IS NULL)'; params.push(req.user!.branch_id);
  }
  const result = db.prepare(query).get(...params) as any;
  res.json({ count: result.count });
});

router.put('/:id/read', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare(`UPDATE notifications SET is_read=1, read_at=datetime('now') WHERE id=?`).run(req.params.id);
  res.json({ message: 'Marked as read' });
});

router.put('/mark-all-read', (req: Request, res: Response) => {
  const db = getDb();
  db.prepare(`UPDATE notifications SET is_read=1, read_at=datetime('now') WHERE (user_id=? OR user_id IS NULL) AND is_read=0`).run(req.user!.id);
  res.json({ message: 'All notifications marked as read' });
});

router.post('/send', authorize('super_admin', 'admin'), (req: Request, res: Response) => {
  const { tenant_id, branch_id, user_id, type, title, message } = req.body;
  if (!title || !message || !type) return res.status(400).json({ error: 'title, message, type required' });
  const db = getDb();
  const id = uuidv4();
  db.prepare(`INSERT INTO notifications (id, tenant_id, branch_id, user_id, type, title, message) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    id, tenant_id || null, branch_id || req.user!.branch_id, user_id || null, type, title, message
  );
  res.status(201).json(db.prepare('SELECT * FROM notifications WHERE id=?').get(id));
});

// Check and create overdue notifications
router.post('/check-overdue', authorize('super_admin', 'admin'), (req: Request, res: Response) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const branchFilter = req.user!.role === 'super_admin' ? '' : 'AND p.branch_id=?';
  const params: any[] = req.user!.role === 'super_admin' ? [today] : [today, req.user!.branch_id];

  const overduePayments = db.prepare(`
    SELECT p.id, p.tenant_id, p.branch_id, p.month_year, p.amount_due,
    t.first_name || ' ' || t.last_name as tenant_name
    FROM payments p JOIN tenants t ON p.tenant_id=t.id
    WHERE p.status='pending' AND p.due_date < ? ${branchFilter} AND p.payment_type='rent'
  `).all(...params) as any[];

  let count = 0;
  for (const p of overduePayments) {
    db.prepare(`UPDATE payments SET status='overdue', updated_at=datetime('now') WHERE id=?`).run(p.id);
    const existing = db.prepare(`SELECT id FROM notifications WHERE tenant_id=? AND type='overdue' AND month_year=?`).get(p.tenant_id, p.month_year) as any;
    if (!existing) {
      db.prepare(`INSERT INTO notifications (id, tenant_id, branch_id, type, title, message, month_year) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
        uuidv4(), p.tenant_id, p.branch_id, 'overdue',
        'Overdue Rent Payment',
        `${p.tenant_name}'s rent of ${p.amount_due.toLocaleString()} RWF for ${p.month_year} is overdue.`,
        p.month_year
      );
      count++;
    }
  }

  res.json({ message: `Processed ${overduePayments.length} overdue payments, sent ${count} notifications` });
});

export default router;
