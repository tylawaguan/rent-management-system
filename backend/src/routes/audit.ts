import { Router, Request, Response } from 'express';
import { query, queryOne } from '../database/db';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();
router.use(authenticate, authorize('super_admin', 'admin'));

router.get('/', async (req: Request, res: Response) => {
  try {
    const { branch_id, user_id, action, entity_type, from_date, to_date, page = '1', limit = '50' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let sql = 'SELECT a.*, u.name as user_display FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id WHERE 1=1';
    const params: any[] = [];

    if (req.user!.role === 'admin') {
      sql += ' AND a.branch_id = ?'; params.push(req.user!.branch_id);
    } else if (branch_id) {
      sql += ' AND a.branch_id = ?'; params.push(branch_id);
    }
    if (user_id) { sql += ' AND a.user_id = ?'; params.push(user_id); }
    if (action) { sql += ' AND a.action LIKE ?'; params.push(`%${action}%`); }
    if (entity_type) { sql += ' AND a.entity_type = ?'; params.push(entity_type); }
    if (from_date) { sql += ' AND a.created_at >= ?'; params.push(from_date); }
    if (to_date) { sql += ' AND a.created_at <= ?'; params.push(`${to_date} 23:59:59`); }

    const countResult = await queryOne<any>(`SELECT COUNT(*) as c FROM (${sql}) sub`, params);
    const total = countResult?.c ?? 0;

    sql += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
    params.push(limitNum, offset);

    res.json({
      data: await query(sql, params),
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
