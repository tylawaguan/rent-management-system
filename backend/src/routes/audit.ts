import { Router, Request, Response } from 'express';
import { getDb } from '../database/db';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate, authorize('super_admin', 'admin'));

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { branch_id, user_id, action, entity_type, from_date, to_date, page = '1', limit = '50' } = req.query;
  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  let query = `SELECT a.*, u.name as user_display FROM audit_logs a LEFT JOIN users u ON a.user_id=u.id WHERE 1=1`;
  const params: any[] = [];

  if (req.user!.role === 'admin') {
    query += ' AND a.branch_id=?'; params.push(req.user!.branch_id);
  } else if (branch_id) {
    query += ' AND a.branch_id=?'; params.push(branch_id);
  }
  if (user_id) { query += ' AND a.user_id=?'; params.push(user_id); }
  if (action) { query += ' AND a.action LIKE ?'; params.push(`%${action}%`); }
  if (entity_type) { query += ' AND a.entity_type=?'; params.push(entity_type); }
  if (from_date) { query += ' AND a.created_at >= ?'; params.push(from_date); }
  if (to_date) { query += ' AND a.created_at <= ?'; params.push(`${to_date} 23:59:59`); }

  const total = (db.prepare(`SELECT COUNT(*) as c FROM (${query})`).get(...params) as any).c;
  query += ` ORDER BY a.created_at DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit as string), offset);

  res.json({
    data: db.prepare(query).all(...params),
    pagination: { page: parseInt(page as string), limit: parseInt(limit as string), total, pages: Math.ceil(total / parseInt(limit as string)) },
  });
});

export default router;
