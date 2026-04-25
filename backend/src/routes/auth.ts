import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../database/db';
import { authenticate } from '../middleware/auth';
import { logAudit } from '../utils/audit';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND status = ?').get(email.toLowerCase().trim(), 'active') as any;
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    logAudit(req as any, 'LOGIN_FAILED', 'user', user.id, { email });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const branch = user.branch_id ? db.prepare('SELECT id, name FROM branches WHERE id = ?').get(user.branch_id) as any : null;

  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    branch_id: user.branch_id,
    permissions: JSON.parse(user.permissions || '[]'),
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });
  db.prepare(`UPDATE users SET last_login = datetime('now') WHERE id = ?`).run(user.id);

  req.user = payload as any;
  logAudit(req as any, 'LOGIN_SUCCESS', 'user', user.id);

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branch_id: user.branch_id,
      branch,
      permissions: payload.permissions,
    },
  });
});

router.get('/me', authenticate, (req: Request, res: Response) => {
  const db = getDb();
  const user = db.prepare('SELECT id, name, email, role, branch_id, permissions, status, last_login, created_at FROM users WHERE id = ?').get(req.user!.id) as any;
  const branch = user.branch_id ? db.prepare('SELECT id, name FROM branches WHERE id = ?').get(user.branch_id) : null;
  res.json({ ...user, permissions: JSON.parse(user.permissions || '[]'), branch });
});

router.put('/change-password', authenticate, async (req: Request, res: Response) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required' });
  if (new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as any;
  const valid = await bcrypt.compare(current_password, user.password);
  if (!valid) return res.status(401).json({ error: 'Current password incorrect' });

  const hashed = await bcrypt.hash(new_password, 10);
  db.prepare(`UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?`).run(hashed, req.user!.id);
  logAudit(req, 'CHANGE_PASSWORD', 'user', req.user!.id);
  res.json({ message: 'Password updated successfully' });
});

export default router;
