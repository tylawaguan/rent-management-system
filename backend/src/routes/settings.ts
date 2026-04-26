import { Router, Request, Response } from 'express';
import { query, run } from '../database/db';
import { authenticate, authorize } from '../middleware/auth';
import { logAudit } from '../utils/audit';

const router = Router();
router.use(authenticate);

router.get('/', async (_req: Request, res: Response) => {
  try {
    const settings = await query('SELECT `key`, value, description FROM system_settings');
    const obj: Record<string, string> = {};
    settings.forEach((s: any) => { obj[s.key] = s.value; });
    res.json(obj);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/', authorize('super_admin'), async (req: Request, res: Response) => {
  try {
    const updates = req.body as Record<string, string>;
    for (const [key, value] of Object.entries(updates)) {
      await run(
        'INSERT INTO system_settings (`key`, value, updated_by) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value=VALUES(value), updated_by=VALUES(updated_by), updated_at=NOW()',
        [key, value, req.user!.id]
      );
    }
    logAudit(req, 'UPDATE_SETTINGS', 'settings', undefined, updates);
    res.json({ message: 'Settings updated' });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
