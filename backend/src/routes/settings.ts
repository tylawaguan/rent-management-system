import { Router, Request, Response } from 'express';
import { getDb } from '../database/db';
import { authenticate, authorize } from '../middleware/auth';
import { logAudit } from '../utils/audit';

const router = Router();
router.use(authenticate);

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const settings = db.prepare('SELECT key, value, description FROM system_settings').all();
  const obj: Record<string, string> = {};
  (settings as any[]).forEach(s => { obj[s.key] = s.value; });
  res.json(obj);
});

router.put('/', authorize('super_admin'), (req: Request, res: Response) => {
  const db = getDb();
  const updates = req.body as Record<string, string>;
  const stmt = db.prepare(`INSERT OR REPLACE INTO system_settings (key, value, updated_by, updated_at) VALUES (?, ?, ?, datetime('now'))`);
  for (const [key, value] of Object.entries(updates)) {
    stmt.run(key, value, req.user!.id);
  }
  logAudit(req, 'UPDATE_SETTINGS', 'settings', null, updates);
  res.json({ message: 'Settings updated' });
});

export default router;
