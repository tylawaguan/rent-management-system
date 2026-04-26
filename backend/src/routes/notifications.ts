import { Router, Request, Response } from 'express';
import { query, queryOne, run } from '../database/db';
import { authenticate, authorize } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { unread_only } = req.query;
    let sql = `SELECT n.*, CONCAT(t.first_name, ' ', t.last_name) as tenant_name, b.name as branch_name
      FROM notifications n
      LEFT JOIN tenants t ON n.tenant_id = t.id
      LEFT JOIN branches b ON n.branch_id = b.id
      WHERE (n.user_id = ? OR n.user_id IS NULL)`;
    const params: any[] = [req.user!.id];

    if (req.user!.role !== 'super_admin') {
      sql += ' AND (n.branch_id = ? OR n.branch_id IS NULL)'; params.push(req.user!.branch_id);
    }
    if (unread_only === 'true') { sql += ' AND n.is_read = 0'; }
    sql += ' ORDER BY n.sent_at DESC LIMIT 100';

    res.json(await query(sql, params));
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    let sql = 'SELECT COUNT(*) as count FROM notifications WHERE is_read = 0 AND (user_id = ? OR user_id IS NULL)';
    const params: any[] = [req.user!.id];
    if (req.user!.role !== 'super_admin') {
      sql += ' AND (branch_id = ? OR branch_id IS NULL)'; params.push(req.user!.branch_id);
    }
    const result = await queryOne<any>(sql, params);
    res.json({ count: result?.count ?? 0 });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    await run('UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ?', [req.params.id]);
    res.json({ message: 'Marked as read' });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/mark-all-read', async (req: Request, res: Response) => {
  try {
    await run('UPDATE notifications SET is_read = 1, read_at = NOW() WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0', [req.user!.id]);
    res.json({ message: 'All notifications marked as read' });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/send', authorize('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const { tenant_id, branch_id, user_id, type, title, message } = req.body;
    if (!title || !message || !type) return res.status(400).json({ error: 'title, message, type required' });
    const id = uuidv4();
    await run(
      'INSERT INTO notifications (id, tenant_id, branch_id, user_id, type, title, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, tenant_id || null, branch_id || req.user!.branch_id, user_id || null, type, title, message]
    );
    res.status(201).json(await queryOne('SELECT * FROM notifications WHERE id = ?', [id]));
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/check-overdue', authorize('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const branchFilter = req.user!.role === 'super_admin' ? '' : 'AND p.branch_id = ?';
    const params: any[] = req.user!.role === 'super_admin' ? [today] : [today, req.user!.branch_id];

    const overduePayments = await query<any>(`
      SELECT p.id, p.tenant_id, p.branch_id, p.month_year, p.amount_due,
        CONCAT(t.first_name, ' ', t.last_name) as tenant_name
      FROM payments p JOIN tenants t ON p.tenant_id = t.id
      WHERE p.status = 'pending' AND p.due_date < ? ${branchFilter} AND p.payment_type = 'rent'
    `, params);

    let count = 0;
    for (const p of overduePayments) {
      await run("UPDATE payments SET status = 'overdue' WHERE id = ?", [p.id]);
      const existing = await queryOne("SELECT id FROM notifications WHERE tenant_id = ? AND type = 'overdue'", [p.tenant_id]);
      if (!existing) {
        await run(
          'INSERT INTO notifications (id, tenant_id, branch_id, type, title, message) VALUES (?, ?, ?, ?, ?, ?)',
          [uuidv4(), p.tenant_id, p.branch_id, 'overdue',
            'Overdue Rent Payment',
            `${p.tenant_name}'s rent of ${p.amount_due.toLocaleString()} RWF for ${p.month_year} is overdue.`]
        );
        count++;
      }
    }

    res.json({ message: `Processed ${overduePayments.length} overdue payments, sent ${count} notifications` });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
