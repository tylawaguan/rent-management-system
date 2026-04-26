import { Router, Request, Response } from 'express';
import { query, queryOne, run } from '../database/db';
import { authenticate, authorize } from '../middleware/auth';
import { logAudit } from '../utils/audit';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { branch_id, status, floor } = req.query;
    let sql = `SELECT r.*, b.name as branch_name,
      CONCAT(t.first_name, ' ', t.last_name) as tenant_name, t.id as tenant_id
      FROM rooms r LEFT JOIN branches b ON r.branch_id = b.id
      LEFT JOIN tenants t ON t.room_id = r.id AND t.status = 'active'
      WHERE 1=1`;
    const params: any[] = [];

    if (req.user!.role !== 'super_admin') {
      sql += ' AND r.branch_id = ?'; params.push(req.user!.branch_id);
    } else if (branch_id) {
      sql += ' AND r.branch_id = ?'; params.push(branch_id);
    }
    if (status) { sql += ' AND r.status = ?'; params.push(status); }
    if (floor) { sql += ' AND r.floor = ?'; params.push(floor); }
    sql += ' ORDER BY r.branch_id, r.floor, r.room_number';

    res.json(await query(sql, params));
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authorize('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const { branch_id, room_number, floor, room_type, capacity, rent_amount, deposit_amount, description, amenities } = req.body;
    if (!branch_id || !room_number || !rent_amount) return res.status(400).json({ error: 'branch_id, room_number, rent_amount required' });

    const exists = await queryOne('SELECT id FROM rooms WHERE branch_id = ? AND room_number = ?', [branch_id, room_number]);
    if (exists) return res.status(409).json({ error: 'Room number already exists in this branch' });

    const id = uuidv4();
    await run(
      'INSERT INTO rooms (id, branch_id, room_number, floor, room_type, capacity, rent_amount, deposit_amount, description, amenities) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, branch_id, room_number, floor || 1, room_type || 'standard', capacity || 1, rent_amount, deposit_amount || rent_amount, description, JSON.stringify(amenities || [])]
    );
    logAudit(req, 'CREATE_ROOM', 'room', id, { branch_id, room_number, rent_amount });
    res.status(201).json(await queryOne('SELECT * FROM rooms WHERE id = ?', [id]));
  } catch (e: any) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Room number already exists in this branch' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const room = await queryOne<any>(
      'SELECT r.*, b.name as branch_name FROM rooms r LEFT JOIN branches b ON r.branch_id = b.id WHERE r.id = ?',
      [req.params.id]
    );
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (req.user!.role !== 'super_admin' && req.user!.branch_id !== room.branch_id)
      return res.status(403).json({ error: 'Access denied' });

    const tenant = await queryOne(
      "SELECT id, first_name, last_name, phone, email, rent_amount, move_in_date FROM tenants WHERE room_id = ? AND status = 'active'",
      [room.id]
    );
    res.json({ ...room, amenities: JSON.parse(room.amenities || '[]'), current_tenant: tenant || null });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', authorize('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const room = await queryOne<any>('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (req.user!.role !== 'super_admin' && req.user!.branch_id !== room.branch_id)
      return res.status(403).json({ error: 'Access denied' });

    const { room_number, floor, room_type, capacity, rent_amount, deposit_amount, description, status, amenities } = req.body;
    await run(`
      UPDATE rooms SET
        room_number = COALESCE(?, room_number), floor = COALESCE(?, floor), room_type = COALESCE(?, room_type),
        capacity = COALESCE(?, capacity), rent_amount = COALESCE(?, rent_amount), deposit_amount = COALESCE(?, deposit_amount),
        description = COALESCE(?, description), status = COALESCE(?, status),
        amenities = COALESCE(?, amenities)
      WHERE id = ?
    `, [room_number, floor, room_type, capacity, rent_amount, deposit_amount, description, status, amenities ? JSON.stringify(amenities) : null, req.params.id]);

    logAudit(req, 'UPDATE_ROOM', 'room', req.params.id, { room_number, status });
    res.json(await queryOne('SELECT * FROM rooms WHERE id = ?', [req.params.id]));
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authorize('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const room = await queryOne<any>('SELECT * FROM rooms WHERE id = ?', [req.params.id]);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (room.status === 'occupied') return res.status(400).json({ error: 'Cannot delete an occupied room' });
    if (req.user!.role !== 'super_admin' && req.user!.branch_id !== room.branch_id)
      return res.status(403).json({ error: 'Access denied' });

    await run('DELETE FROM rooms WHERE id = ?', [req.params.id]);
    logAudit(req, 'DELETE_ROOM', 'room', req.params.id, { room_number: room.room_number });
    res.json({ message: 'Room deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
