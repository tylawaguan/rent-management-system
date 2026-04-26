import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne } from '../database/db';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  branch_id: string | null;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as AuthUser;
    const user = await queryOne<any>(
      'SELECT id, name, email, role, branch_id, permissions, status FROM users WHERE id = ?',
      [decoded.id]
    );
    if (!user || user.status !== 'active') return res.status(401).json({ error: 'User not found or inactive' });
    req.user = { ...user, permissions: JSON.parse(user.permissions || '[]') };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function branchAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role === 'super_admin') return next();
  const requestedBranch = req.params.branchId || req.query.branch_id || req.body?.branch_id;
  if (requestedBranch && req.user.branch_id !== requestedBranch) {
    return res.status(403).json({ error: 'Access denied to this branch' });
  }
  next();
}
