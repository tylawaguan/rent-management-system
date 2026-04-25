import { Router, Request, Response } from 'express';
import { getDb } from '../database/db';
import { authenticate, authorize } from '../middleware/auth';
import { logAudit } from '../utils/audit';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);

router.get('/', (req: Request, res: Response) => {
  const db = getDb();
  const { branch_id, status, floor } = req.query;
  let query = `SELECT r.*, b.name as branch_name,
    t.first_name || ' ' || t.last_name as tenant_name, t.id as tenant_id
    FROM rooms r LEFT JOIN branches b ON r.branch_id = b.id
    LEFT JOIN tenants t ON t.room_id = r.id AND t.status = 'active'
    WHERE 1=1`;
  const params: any[] = [];

  if (req.user!.role !== 'super_admin') {
    query += ' AND r.branch_id = ?'; params.push(req.user!.branch_id);
  } else if (branch_id) {
    query += ' AND r.branch_id = ?'; params.push(branch_id);
  }
  if (status) { query += ' AND r.status = ?'; params.push(status); }
  if (floor) { query += ' AND r.floor = ?'; params.push(floor); }
  query += ' ORDER BY r.branch_id, r.floor, r.room_number';

  res.json(db.prepare(query).all(...params));
});

router.post('/', authorize('super_admin', 'admin'), (req: Request, res: Response) => {
  const { branch_id, room_number, floor, room_type, capacity, rent_amount, deposit_amount, description, amenities } = req.body;
  if (!branch_id || !room_number || !rent_amount) return res.status(400).json({ error: 'branch_id, room_number, rent_amount required' });

  const db = getDb();
  const exists = db.prepare('SELECT id FROM rooms WHERE branch_id=? AND room_number=?').get(branch_id, room_number);
  if (exists) return res.status(409).json({ error: 'Room number already exists in this branch' });

  const id = uuidv4();
  db.prepare(`INSERT INTO rooms (id, branch_id, room_number, floor, room_type, capacity, rent_amount, deposit_amount, description, amenities)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    id, branch_id, room_number, floor || 1, room_type || 'standard', capacity || 1,
    rent_amount, deposit_amount || rent_amount, description, JSON.stringify(amenities || [])
  );
  logAudit(req, 'CREATE_ROOM', 'room', id, { branch_id, room_number, rent_amount });
  res.status(201).json(db.prepare('SELECT * FROM rooms WHERE id = ?').get(id));
});

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const room = db.prepare(`SELECT r.*, b.name as branch_name FROM rooms r LEFT JOIN branches b ON r.branch_id = b.id WHERE r.id = ?`).get(req.params.id) as any;
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (req.user!.role !== 'super_admin' && req.user!.branch_id !== room.branch_id) return res.status(403).json({ error: 'Access denied' });
  const tenant = db.prepare(`SELECT id, first_name, last_name, phone, email, rent_amount, move_in_date FROM tenants WHERE room_id=? AND status='active'`).get(room.id);
  res.json({ ...room, amenities: JSON.parse(room.amenities || '[]'), current_tenant: tenant || null });
});

router.put('/:id', authorize('super_admin', 'admin'), (req: Request, res: Response) => {
  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id) as any;
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (req.user!.role === 'admin' && req.user!.branch_id !== room.branch_id) return res.status(403).json({ error: 'Access denied' });

  const { room_number, floor, room_type, capacity, rent_amount, deposit_amount, description, amenities, status } = req.body;
  db.prepare(`UPDATE rooms SET room_number=COALESCE(?,room_number), floor=COALESCE(?,floor), room_type=COALESCE(?,room_type),
    capacity=COALESCE(?,capacity), rent_amount=COALESCE(?,rent_amount), deposit_amount=COALESCE(?,deposit_amount),
    description=COALESCE(?,description), amenities=COALESCE(?,amenities), status=COALESCE(?,status), updated_at=datetime('now')
    WHERE id=?`).run(room_number, floor, room_type, capacity, rent_amount, deposit_amount, description,
    amenities ? JSON.stringify(amenities) : null, status, req.params.id);

  logAudit(req, 'UPDATE_ROOM', 'room', req.params.id, req.body);
  res.json(db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id));
});

router.delete('/:id', authorize('super_admin', 'admin'), (req: Request, res: Response) => {
  const db = getDb();
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id) as any;
  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.status === 'occupied') return res.status(400).json({ error: 'Cannot delete occupied room' });
  db.prepare('DELETE FROM rooms WHERE id = ?').run(req.params.id);
  logAudit(req, 'DELETE_ROOM', 'room', req.params.id, { room_number: room.room_number });
  res.json({ message: 'Room deleted' });
});

export default router;
