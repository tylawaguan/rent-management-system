import { Router, Request, Response } from 'express';
import { query, queryOne, run } from '../database/db';
import { authenticate, authorize } from '../middleware/auth';
import { logAudit } from '../utils/audit';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  try {
    const { branch_id, status, room_id, search } = req.query;
    let sql = `SELECT t.*, r.room_number, r.floor, r.room_type, b.name as branch_name
      FROM tenants t
      LEFT JOIN rooms r ON t.room_id = r.id
      LEFT JOIN branches b ON t.branch_id = b.id
      WHERE 1=1`;
    const params: any[] = [];

    if (req.user!.role !== 'super_admin') {
      sql += ' AND t.branch_id = ?'; params.push(req.user!.branch_id);
    } else if (branch_id) {
      sql += ' AND t.branch_id = ?'; params.push(branch_id);
    }
    if (status) { sql += ' AND t.status = ?'; params.push(status); }
    if (room_id) { sql += ' AND t.room_id = ?'; params.push(room_id); }
    if (search) {
      sql += ' AND (t.first_name LIKE ? OR t.last_name LIKE ? OR t.phone LIKE ? OR t.national_id LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }
    sql += ' ORDER BY t.created_at DESC';

    res.json(await query(sql, params));
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authorize('super_admin', 'admin', 'manager'), async (req: Request, res: Response) => {
  try {
    const { branch_id, room_id, first_name, last_name, email, phone, national_id, emergency_contact, emergency_phone,
      move_in_date, lease_end_date, rent_amount, deposit_paid, notes } = req.body;

    if (!first_name || !last_name || !phone || !move_in_date || !rent_amount)
      return res.status(400).json({ error: 'first_name, last_name, phone, move_in_date, rent_amount required' });

    const effectiveBranch = req.user!.role === 'super_admin' ? branch_id : req.user!.branch_id;
    if (!effectiveBranch) return res.status(400).json({ error: 'branch_id required' });

    if (room_id) {
      const room = await queryOne<any>('SELECT * FROM rooms WHERE id = ? AND branch_id = ?', [room_id, effectiveBranch]);
      if (!room) return res.status(404).json({ error: 'Room not found' });
      if (room.status === 'occupied') return res.status(400).json({ error: 'Room is already occupied' });
    }

    const id = uuidv4();
    await run(
      `INSERT INTO tenants (id, branch_id, room_id, first_name, last_name, email, phone, national_id,
        emergency_contact, emergency_phone, move_in_date, lease_end_date, rent_amount, deposit_paid, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, effectiveBranch, room_id || null, first_name, last_name, email, phone, national_id,
        emergency_contact, emergency_phone, move_in_date, lease_end_date, rent_amount, deposit_paid || 0, notes, req.user!.id]
    );

    if (room_id) {
      await run("UPDATE rooms SET status = 'occupied' WHERE id = ?", [room_id]);
    }

    logAudit(req, 'CREATE_TENANT', 'tenant', id, { name: `${first_name} ${last_name}`, room_id });
    res.status(201).json(await queryOne(
      'SELECT t.*, r.room_number FROM tenants t LEFT JOIN rooms r ON t.room_id = r.id WHERE t.id = ?', [id]
    ));
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const tenant = await queryOne<any>(`
      SELECT t.*, r.room_number, r.floor, r.room_type, r.rent_amount as room_rent, b.name as branch_name
      FROM tenants t LEFT JOIN rooms r ON t.room_id = r.id LEFT JOIN branches b ON t.branch_id = b.id WHERE t.id = ?
    `, [req.params.id]);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (req.user!.role !== 'super_admin' && req.user!.branch_id !== tenant.branch_id)
      return res.status(403).json({ error: 'Access denied' });

    const payments = await query('SELECT * FROM payments WHERE tenant_id = ? ORDER BY due_date DESC LIMIT 12', [req.params.id]);
    const unpaid = await queryOne<any>("SELECT COUNT(*) as c FROM payments WHERE tenant_id = ? AND status IN ('pending','overdue')", [req.params.id]);
    res.json({ ...tenant, payments, unpaid_count: unpaid?.c ?? 0 });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', authorize('super_admin', 'admin', 'manager'), async (req: Request, res: Response) => {
  try {
    const tenant = await queryOne<any>('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (req.user!.role !== 'super_admin' && req.user!.branch_id !== tenant.branch_id)
      return res.status(403).json({ error: 'Access denied' });

    const { first_name, last_name, email, phone, national_id, emergency_contact, emergency_phone,
      move_out_date, lease_end_date, rent_amount, deposit_paid, balance, notes, status, room_id } = req.body;

    if (room_id && room_id !== tenant.room_id) {
      const newRoom = await queryOne<any>('SELECT * FROM rooms WHERE id = ?', [room_id]);
      if (!newRoom || newRoom.status === 'occupied') return res.status(400).json({ error: 'Room not available' });
      if (tenant.room_id) await run("UPDATE rooms SET status = 'available' WHERE id = ?", [tenant.room_id]);
      await run("UPDATE rooms SET status = 'occupied' WHERE id = ?", [room_id]);
    }

    if (status === 'moved_out' || status === 'inactive' || status === 'evicted') {
      if (tenant.room_id) await run("UPDATE rooms SET status = 'available' WHERE id = ?", [tenant.room_id]);
    }

    await run(`
      UPDATE tenants SET
        first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name), email = COALESCE(?, email),
        phone = COALESCE(?, phone), national_id = COALESCE(?, national_id),
        emergency_contact = COALESCE(?, emergency_contact), emergency_phone = COALESCE(?, emergency_phone),
        move_out_date = COALESCE(?, move_out_date), lease_end_date = COALESCE(?, lease_end_date),
        rent_amount = COALESCE(?, rent_amount), deposit_paid = COALESCE(?, deposit_paid),
        balance = COALESCE(?, balance), notes = COALESCE(?, notes), status = COALESCE(?, status),
        room_id = COALESCE(?, room_id)
      WHERE id = ?
    `, [first_name, last_name, email, phone, national_id, emergency_contact, emergency_phone,
        move_out_date, lease_end_date, rent_amount, deposit_paid, balance, notes, status, room_id, req.params.id]);

    logAudit(req, 'UPDATE_TENANT', 'tenant', req.params.id, { status, room_id });
    res.json(await queryOne(
      'SELECT t.*, r.room_number FROM tenants t LEFT JOIN rooms r ON t.room_id = r.id WHERE t.id = ?',
      [req.params.id]
    ));
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authorize('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const tenant = await queryOne<any>('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    if (tenant.room_id) await run("UPDATE rooms SET status = 'available' WHERE id = ?", [tenant.room_id]);
    await run("UPDATE tenants SET status = 'inactive' WHERE id = ?", [req.params.id]);
    logAudit(req, 'DEACTIVATE_TENANT', 'tenant', req.params.id);
    res.json({ message: 'Tenant deactivated' });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
