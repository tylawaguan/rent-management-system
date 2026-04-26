import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { queryOne, run } from '../database/db';
import { authenticate } from '../middleware/auth';
import { logAudit } from '../utils/audit';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await queryOne<any>('SELECT * FROM users WHERE email = ? AND status = ?', [email.toLowerCase().trim(), 'active']);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      logAudit(req as any, 'LOGIN_FAILED', 'user', user.id, { email });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    return await issueFullToken(req, res, user);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

async function issueFullToken(req: Request, res: Response, user: any) {
  const branch = user.branch_id
    ? await queryOne<any>('SELECT id, name FROM branches WHERE id = ?', [user.branch_id])
    : null;
  const payload = {
    id: user.id, name: user.name, email: user.email,
    role: user.role, branch_id: user.branch_id,
    permissions: JSON.parse(user.permissions || '[]'),
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: (process.env.JWT_EXPIRES_IN || '24h') as any });
  await run('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
  req.user = payload as any;
  logAudit(req as any, 'LOGIN_SUCCESS', 'user', user.id);
  res.json({ token, user: { ...payload, branch } });
}

router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await queryOne<any>(
      'SELECT id, name, email, role, branch_id, permissions, status, last_login, created_at FROM users WHERE id = ?',
      [req.user!.id]
    );
    const branch = user.branch_id ? await queryOne<any>('SELECT id, name FROM branches WHERE id = ?', [user.branch_id]) : null;
    res.json({ ...user, permissions: JSON.parse(user.permissions || '[]'), branch });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required' });
    if (new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

    const user = await queryOne<any>('SELECT * FROM users WHERE id = ?', [req.user!.id]);
    const valid = await bcrypt.compare(current_password, user.password);
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });

    const hashed = await bcrypt.hash(new_password, 10);
    await run('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user!.id]);
    logAudit(req, 'CHANGE_PASSWORD', 'user', req.user!.id);
    res.json({ message: 'Password updated successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
