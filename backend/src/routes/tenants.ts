import { Router, Request, Response } from 'express';
import { getDb } from '../database/db';
import { authenticate, authorize } from '../middleware/auth';
import { logAudit } from '../utils/audit';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { branch_id, status, room_id, search } = req.query;
  let query = `SELECT t.*, r.room_number, r.floor, r.room_type, b.name as branch_name
    FROM tenants t
    LEFT JOIN rooms r ON t.room_id = r.id
    LEFT JOIN branches b ON t.branch_id = b.id
    WHERE 1=1`;
  const params: any[] = [];

  if (req.user!.role !== 'super_admin') {
    query += ' AND t.branch_id = ?'; params.push(req.user!.branch_id);
  } else if (branch_id) {
    query += ' AND t.branch_id = ?'; params.push(branch_id);
  }
  if (status) { query += ' AND t.status = ?'; params.push(status); }
  if (room_id) { query += ' AND t.room_id = ?'; params.push(room_id); }
  if (search) {
    query += ` AND (t.first_name LIKE ? OR t.last_name LIKE ? OR t.phone LIKE ? OR t.national_id LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  query += ' ORDER BY t.created_at DESC';

  res.json(db.prepare(query).all(...params));
});

router.post('/', authorize('super_admin', 'admin', 'manager'), (req: Request, res: Response) => {
  const { branch_id, room_id, first_name, last_name, email, phone, national_id, emergency_contact, emergency_phone,
    move_in_date, lease_end_date, rent_amount, deposit_paid, notes } = req.body;

  if (!first_name || !last_name || !phone || !move_in_date || !rent_amount) {
    return res.status(400).json({ error: 'first_name, last_name, phone, move_in_date, rent_amount required' });
  }

  const db = getDb();
  const effectiveBranch = req.user!.role === 'super_admin' ? branch_id : req.user!.branch_id;
  if (!effectiveBranch) return res.status(400).json({ error: 'branch_id required' });

  if (room_id) {
    const room = db.prepare('SELECT * FROM rooms WHERE id=? AND branch_id=?').get(room_id, effectiveBranch) as any;
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.status === 'occupied') return res.status(400).json({ error: 'Room is already occupied' });
  }

  const id = uuidv4();
  db.prepare(`INSERT INTO tenants (id, branch_id, room_id, first_name, last_name, email, phone, national_id,
    emergency_contact, emergency_phone, move_in_date, lease_end_date, rent_amount, deposit_paid, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, effectiveBranch, room_id || null, first_name, last_name, email, phone, national_id,
    emergency_contact, emergency_phone, move_in_date, lease_end_date, rent_amount, deposit_paid || 0, notes, req.user!.id
  );

  if (room_id) {
    db.prepare(`UPDATE rooms SET status='occupied', updated_at=datetime('now') WHERE id=?`).run(room_id);
  }

  logAudit(req, 'CREATE_TENANT', 'tenant', id, { name: `${first_name} ${last_name}`, room_id });
  const tenant = db.prepare(`SELECT t.*, r.room_number FROM tenants t LEFT JOIN rooms r ON t.room_id = r.id WHERE t.id=?`).get(id);
  res.status(201).json(tenant);
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const tenant = db.prepare(`SELECT t.*, r.room_number, r.floor, r.room_type, r.rent_amount as room_rent, b.name as branch_name
    FROM tenants t LEFT JOIN rooms r ON t.room_id=r.id LEFT JOIN branches b ON t.branch_id=b.id WHERE t.id=?`).get(req.params.id) as any;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (req.user!.role !== 'super_admin' && req.user!.branch_id !== tenant.branch_id) return res.status(403).json({ error: 'Access denied' });

  const payments = db.prepare(`SELECT * FROM payments WHERE tenant_id=? ORDER BY due_date DESC LIMIT 12`).all(req.params.id);
  const unpaidCount = db.prepare(`SELECT COUNT(*) as c FROM payments WHERE tenant_id=? AND status IN ('pending','overdue')`).get(req.params.id) as any;
  res.json({ ...tenant, payments, unpaid_count: unpaidCount.c });
});

router.put('/:id', authorize('super_admin', 'admin', 'manager'), (req: Request, res: Response) => {
  const db = getDb();
  const tenant = db.prepare('SELECT * FROM tenants WHERE id=?').get(req.params.id) as any;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (req.user!.role !== 'super_admin' && req.user!.branch_id !== tenant.branch_id) return res.status(403).json({ error: 'Access denied' });

  const { first_name, last_name, email, phone, national_id, emergency_contact, emergency_phone,
    move_out_date, lease_end_date, rent_amount, deposit_paid, balance, notes, status, room_id } = req.body;

  if (room_id && room_id !== tenant.room_id) {
    const newRoom = db.prepare('SELECT * FROM rooms WHERE id=?').get(room_id) as any;
    if (!newRoom || newRoom.status === 'occupied') return res.status(400).json({ error: 'Room not available' });
    if (tenant.room_id) db.prepare(`UPDATE rooms SET status='available', updated_at=datetime('now') WHERE id=?`).run(tenant.room_id);
    db.prepare(`UPDATE rooms SET status='occupied', updated_at=datetime('now') WHERE id=?`).run(room_id);
  }

  if (status === 'moved_out' || status === 'inactive' || status === 'evicted') {
    if (tenant.room_id) {
      db.prepare(`UPDATE rooms SET status='available', updated_at=datetime('now') WHERE id=?`).run(tenant.room_id);
    }
  }

  db.prepare(`UPDATE tenants SET first_name=COALESCE(?,first_name), last_name=COALESCE(?,last_name), email=COALESCE(?,email),
    phone=COALESCE(?,phone), national_id=COALESCE(?,national_id), emergency_contact=COALESCE(?,emergency_contact),
    emergency_phone=COALESCE(?,emergency_phone), move_out_date=COALESCE(?,move_out_date), lease_end_date=COALESCE(?,lease_end_date),
    rent_amount=COALESCE(?,rent_amount), deposit_paid=COALESCE(?,deposit_paid), balance=COALESCE(?,balance),
    notes=COALESCE(?,notes), status=COALESCE(?,status), room_id=COALESCE(?,room_id), updated_at=datetime('now') WHERE id=?`).run(
    first_name, last_name, email, phone, national_id, emergency_contact, emergency_phone,
    move_out_date, lease_end_date, rent_amount, deposit_paid, balance, notes, status, room_id, req.params.id
  );

  logAudit(req, 'UPDATE_TENANT', 'tenant', req.params.id, { status, room_id });
  res.json(db.prepare(`SELECT t.*, r.room_number FROM tenants t LEFT JOIN rooms r ON t.room_id=r.id WHERE t.id=?`).get(req.params.id));
});

router.delete('/:id', authorize('super_admin', 'admin'), (req: Request, res: Response) => {
  const db = getDb();
  const tenant = db.prepare('SELECT * FROM tenants WHERE id=?').get(req.params.id) as any;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  if (tenant.room_id) db.prepare(`UPDATE rooms SET status='available' WHERE id=?`).run(tenant.room_id);
  db.prepare(`UPDATE tenants SET status=?, updated_at=datetime('now') WHERE id=?`).run('inactive', req.params.id);
  logAudit(req, 'DEACTIVATE_TENANT', 'tenant', req.params.id);
  res.json({ message: 'Tenant deactivated' });
});

export default router;
