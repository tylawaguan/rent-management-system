import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { getDb } from '../database/db';
import { authenticate } from '../middleware/auth';
import { logAudit } from '../utils/audit';

const router = Router();

// Step 1: email + password login
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

  // If OTP is enabled, issue a short-lived temp token and require OTP step
  if (user.otp_enabled && user.otp_secret) {
    const tempToken = jwt.sign({ id: user.id, type: 'otp_pending' }, process.env.JWT_SECRET!, { expiresIn: '5m' });
    const exp = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    db.prepare(`UPDATE users SET otp_temp_token=?, otp_temp_token_exp=? WHERE id=?`).run(tempToken, exp, user.id);
    return res.json({ requires_otp: true, temp_token: tempToken, user_name: user.name });
  }

  // No OTP — issue full JWT immediately
  return issueFullToken(req, res, user, db);
});

// Step 2: verify OTP code after password check
router.post('/verify-otp-login', (req: Request, res: Response) => {
  const { temp_token, otp_code } = req.body;
  if (!temp_token || !otp_code) return res.status(400).json({ error: 'temp_token and otp_code required' });

  let decoded: any;
  try {
    decoded = jwt.verify(temp_token, process.env.JWT_SECRET!);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired OTP session. Please log in again.' });
  }

  if (decoded.type !== 'otp_pending') return res.status(401).json({ error: 'Invalid token type' });

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ? AND status = ?').get(decoded.id, 'active') as any;
  if (!user || user.otp_temp_token !== temp_token) {
    return res.status(401).json({ error: 'Invalid or expired OTP session. Please log in again.' });
  }
  if (new Date(user.otp_temp_token_exp) < new Date()) {
    return res.status(401).json({ error: 'OTP session expired. Please log in again.' });
  }

  const valid = speakeasy.totp.verify({
    secret: user.otp_secret,
    encoding: 'base32',
    token: String(otp_code).replace(/\s/g, ''),
    window: 1,
  });

  if (!valid) {
    logAudit(req as any, 'OTP_FAILED', 'user', user.id);
    return res.status(401).json({ error: 'Invalid OTP code. Please try again.' });
  }

  // Clear temp token
  db.prepare(`UPDATE users SET otp_temp_token=NULL, otp_temp_token_exp=NULL WHERE id=?`).run(user.id);
  return issueFullToken(req, res, user, db);
});

function issueFullToken(req: Request, res: Response, user: any, db: any) {
  const branch = user.branch_id ? db.prepare('SELECT id, name FROM branches WHERE id = ?').get(user.branch_id) as any : null;
  const payload = {
    id: user.id, name: user.name, email: user.email,
    role: user.role, branch_id: user.branch_id,
    permissions: JSON.parse(user.permissions || '[]'),
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });
  db.prepare(`UPDATE users SET last_login = datetime('now') WHERE id = ?`).run(user.id);
  req.user = payload as any;
  logAudit(req as any, 'LOGIN_SUCCESS', 'user', user.id);
  res.json({ token, user: { ...payload, branch, otp_enabled: !!user.otp_enabled } });
}

router.get('/me', authenticate, (req: Request, res: Response) => {
  const db = getDb();
  const user = db.prepare('SELECT id, name, email, role, branch_id, permissions, status, last_login, otp_enabled, created_at FROM users WHERE id = ?').get(req.user!.id) as any;
  const branch = user.branch_id ? db.prepare('SELECT id, name FROM branches WHERE id = ?').get(user.branch_id) : null;
  res.json({ ...user, permissions: JSON.parse(user.permissions || '[]'), branch });
});

// Generate OTP secret + QR code for a user (self or admin setting up for another)
router.post('/setup-otp', authenticate, async (req: Request, res: Response) => {
  const targetId = req.body.user_id || req.user!.id;

  // Only super_admin/admin can set up OTP for others
  if (targetId !== req.user!.id && !['super_admin', 'admin'].includes(req.user!.role)) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const db = getDb();
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any;
  if (!target) return res.status(404).json({ error: 'User not found' });

  // Admin can only set up OTP for users in their branch
  if (req.user!.role === 'admin' && target.branch_id !== req.user!.branch_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const secret = speakeasy.generateSecret({
    name: `RMS — ${target.name}`,
    issuer: 'Rent Management System',
    length: 20,
  });

  db.prepare(`UPDATE users SET otp_secret=?, otp_enabled=0 WHERE id=?`).run(secret.base32, targetId);

  const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url!);
  logAudit(req, 'OTP_SETUP_INITIATED', 'user', targetId, { for_user: target.name });

  res.json({
    secret: secret.base32,
    otpauth_url: secret.otpauth_url,
    qr_code: qrDataUrl,
    user_name: target.name,
    user_email: target.email,
  });
});

// Confirm OTP code to activate 2FA
router.post('/enable-otp', authenticate, (req: Request, res: Response) => {
  const { otp_code, user_id } = req.body;
  const targetId = user_id || req.user!.id;
  if (!otp_code) return res.status(400).json({ error: 'otp_code required' });

  if (targetId !== req.user!.id && !['super_admin', 'admin'].includes(req.user!.role)) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const db = getDb();
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any;
  if (!target || !target.otp_secret) return res.status(400).json({ error: 'OTP not set up. Run setup first.' });

  const valid = speakeasy.totp.verify({
    secret: target.otp_secret,
    encoding: 'base32',
    token: String(otp_code).replace(/\s/g, ''),
    window: 1,
  });

  if (!valid) return res.status(400).json({ error: 'Invalid OTP code. Check your authenticator app.' });

  db.prepare(`UPDATE users SET otp_enabled=1 WHERE id=?`).run(targetId);
  logAudit(req, 'OTP_ENABLED', 'user', targetId, { for_user: target.name });
  res.json({ message: `OTP enabled for ${target.name}` });
});

// Disable OTP for a user
router.post('/disable-otp', authenticate, (req: Request, res: Response) => {
  const { user_id } = req.body;
  const targetId = user_id || req.user!.id;

  if (targetId !== req.user!.id && !['super_admin', 'admin'].includes(req.user!.role)) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const db = getDb();
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any;
  if (!target) return res.status(404).json({ error: 'User not found' });

  if (req.user!.role === 'admin' && target.branch_id !== req.user!.branch_id && targetId !== req.user!.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.prepare(`UPDATE users SET otp_enabled=0, otp_secret=NULL WHERE id=?`).run(targetId);
  logAudit(req, 'OTP_DISABLED', 'user', targetId, { for_user: target.name });
  res.json({ message: `OTP disabled for ${target.name}` });
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
