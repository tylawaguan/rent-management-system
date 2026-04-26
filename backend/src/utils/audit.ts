import { Request } from 'express';
import { run } from '../database/db';
import { v4 as uuidv4 } from 'uuid';

export function logAudit(
  req: Request,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: object,
  status: 'success' | 'failed' = 'success'
) {
  run(
    `INSERT INTO audit_logs (id, user_id, user_name, user_role, branch_id, action, entity_type, entity_id, details, ip_address, user_agent, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      req.user?.id ?? null,
      req.user?.name ?? 'System',
      req.user?.role ?? 'system',
      req.user?.branch_id ?? null,
      action,
      entityType ?? null,
      entityId ?? null,
      details ? JSON.stringify(details) : null,
      req.ip ?? null,
      req.headers['user-agent'] ?? null,
      status,
    ]
  ).catch(e => console.error('Audit log error:', e));
}
