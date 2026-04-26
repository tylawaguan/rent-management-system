import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, run } from '../database/db';
import { authenticate } from '../middleware/auth';
import { logAudit } from '../utils/audit';
import { sendResetEmail } from '../utils/email';

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

// Logged-in user changes their own password
router.put('/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required' });
    if (new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

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

// Send password reset link to email
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await queryOne<any>('SELECT * FROM users WHERE email = ? AND status = ?', [email.toLowerCase().trim(), 'active']);

    // Always return success to avoid revealing which emails exist
    if (!user) return res.json({ message: 'If that email exists, a reset link has been sent.' });

    const token = uuidv4();
    const exp = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '); // 1 hour
    await run('UPDATE users SET reset_token = ?, reset_token_exp = ? WHERE id = ?', [token, exp, user.id]);

    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 5001}`;
    const resetLink = `${appUrl}/reset-password?token=${token}`;

    try {
      await sendResetEmail(user.email, user.name, resetLink);
    } catch (mailErr) {
      console.error('Failed to send reset email:', mailErr);
      return res.status(500).json({ error: 'Failed to send reset email. Check SMTP settings.' });
    }

    logAudit(req as any, 'FORGOT_PASSWORD', 'user', user.id, { email });
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset password using token from email
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) return res.status(400).json({ error: 'Token and new password required' });
    if (new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const user = await queryOne<any>('SELECT * FROM users WHERE reset_token = ? AND status = ?', [token, 'active']);
    if (!user) return res.status(400).json({ error: 'Invalid or expired reset link.' });
    if (new Date(user.reset_token_exp) < new Date()) {
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await run('UPDATE users SET password = ?, reset_token = NULL, reset_token_exp = NULL WHERE id = ?', [hashed, user.id]);
    logAudit(req as any, 'RESET_PASSWORD', 'user', user.id);
    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
