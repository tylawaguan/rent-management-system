import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { query, queryOne, run } from '../database/db';
import { authenticate, authorize } from '../middleware/auth';
import { logAudit } from '../utils/audit';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticate);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.resolve('./uploads/receipts');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `receipt-${Date.now()}-${Math.floor(Math.random() * 9999)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only PDF and image files are allowed'));
  },
});

function generateReceipt(): string {
  return `RCP-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const { branch_id, tenant_id, status, month_year, payment_type } = req.query;
    let sql = `SELECT p.*, CONCAT(t.first_name, ' ', t.last_name) as tenant_name, t.phone as tenant_phone,
      r.room_number, b.name as branch_name
      FROM payments p
      LEFT JOIN tenants t ON p.tenant_id = t.id
      LEFT JOIN rooms r ON p.room_id = r.id
      LEFT JOIN branches b ON p.branch_id = b.id
      WHERE 1=1`;
    const params: any[] = [];

    if (req.user!.role !== 'super_admin') {
      sql += ' AND p.branch_id = ?'; params.push(req.user!.branch_id);
    } else if (branch_id) {
      sql += ' AND p.branch_id = ?'; params.push(branch_id);
    }
    if (tenant_id) { sql += ' AND p.tenant_id = ?'; params.push(tenant_id); }
    if (status) { sql += ' AND p.status = ?'; params.push(status); }
    if (month_year) { sql += ' AND p.month_year = ?'; params.push(month_year); }
    if (payment_type) { sql += ' AND p.payment_type = ?'; params.push(payment_type); }
    sql += ' ORDER BY p.created_at DESC';

    res.json(await query(sql, params));
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post(
  '/',
  authorize('super_admin', 'admin', 'manager', 'accountant'),
  upload.single('receipt_file'),
  async (req: Request, res: Response) => {
    try {
      const { tenant_id, amount, amount_due, penalty, payment_type, payment_method, due_date, paid_date, month_year, notes } = req.body;
      if (!tenant_id || !amount_due || !due_date || !month_year) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'tenant_id, amount_due, due_date, month_year required' });
      }

      const tenant = await queryOne<any>('SELECT * FROM tenants WHERE id = ?', [tenant_id]);
      if (!tenant) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Tenant not found' });
      }

      const effectiveBranch = req.user!.role === 'super_admin' ? (req.body.branch_id || tenant.branch_id) : req.user!.branch_id;
      if (req.user!.role !== 'super_admin' && tenant.branch_id !== effectiveBranch) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'Access denied' });
      }

      const paidAmount = parseFloat(amount) || 0;
      let status: string;
      if (paidAmount === 0) status = 'pending';
      else if (paidAmount >= (parseFloat(amount_due) + parseFloat(penalty || '0'))) status = 'paid';
      else status = 'partial';

      const id = uuidv4();
      const receipt = status === 'paid' ? generateReceipt() : null;
      const receiptFile = req.file ? req.file.filename : null;

      await run(
        `INSERT INTO payments (id, tenant_id, branch_id, room_id, amount, amount_due, penalty, payment_type,
          payment_method, due_date, paid_date, month_year, status, receipt_number, receipt_file, notes, recorded_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, tenant_id, tenant.branch_id, tenant.room_id, paidAmount, amount_due, penalty || 0,
          payment_type || 'rent', payment_method || 'cash', due_date,
          paid_date || (status === 'paid' ? new Date().toISOString().split('T')[0] : null),
          month_year, status, receipt, receiptFile, notes, req.user!.id]
      );

      if (paidAmount > 0) {
        await run(
          'INSERT INTO notifications (id, tenant_id, branch_id, type, channel, title, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), tenant_id, tenant.branch_id, 'payment_received', 'in_app',
            'Payment Received',
            `Payment of ${paidAmount.toLocaleString()} RWF received from ${tenant.first_name} ${tenant.last_name} for ${month_year}`]
        );
      }

      logAudit(req, 'RECORD_PAYMENT', 'payment', id, { tenant_id, amount: paidAmount, status, has_receipt_file: !!receiptFile });
      res.status(201).json(await queryOne('SELECT * FROM payments WHERE id = ?', [id]));
    } catch (e) {
      res.status(500).json({ error: 'Server error' });
    }
  }
);

router.get('/receipt-file/:filename', (req: Request, res: Response) => {
  const filePath = path.resolve('./uploads/receipts', req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const payment = await queryOne<any>(`
      SELECT p.*, CONCAT(t.first_name, ' ', t.last_name) as tenant_name, t.phone as tenant_phone,
        r.room_number, b.name as branch_name FROM payments p
        LEFT JOIN tenants t ON p.tenant_id = t.id LEFT JOIN rooms r ON p.room_id = r.id
        LEFT JOIN branches b ON p.branch_id = b.id WHERE p.id = ?
    `, [req.params.id]);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (req.user!.role !== 'super_admin' && req.user!.branch_id !== payment.branch_id)
      return res.status(403).json({ error: 'Access denied' });
    res.json(payment);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/:id', authorize('super_admin', 'admin', 'manager', 'accountant'), upload.single('receipt_file'), async (req: Request, res: Response) => {
  try {
    const payment = await queryOne<any>('SELECT * FROM payments WHERE id = ?', [req.params.id]);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    if (req.user!.role !== 'super_admin' && req.user!.branch_id !== payment.branch_id)
      return res.status(403).json({ error: 'Access denied' });

    const { amount, penalty, payment_method, paid_date, status, notes } = req.body;
    const paidAmount = amount !== undefined ? parseFloat(amount) : payment.amount;
    const totalDue = payment.amount_due + (penalty !== undefined ? parseFloat(penalty) : payment.penalty);
    const newStatus = status || (paidAmount >= totalDue ? 'paid' : paidAmount > 0 ? 'partial' : 'pending');
    const receipt = (newStatus === 'paid' && !payment.receipt_number) ? generateReceipt() : payment.receipt_number;
    const receiptFile = req.file ? req.file.filename : payment.receipt_file;

    await run(`
      UPDATE payments SET
        amount = ?, penalty = COALESCE(?, penalty), payment_method = COALESCE(?, payment_method),
        paid_date = COALESCE(?, paid_date), status = ?, receipt_number = ?,
        receipt_file = COALESCE(?, receipt_file), notes = COALESCE(?, notes)
      WHERE id = ?
    `, [paidAmount, penalty, payment_method, paid_date, newStatus, receipt, receiptFile, notes, req.params.id]);

    logAudit(req, 'UPDATE_PAYMENT', 'payment', req.params.id, { amount: paidAmount, status: newStatus });
    res.json(await queryOne('SELECT * FROM payments WHERE id = ?', [req.params.id]));
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/generate-monthly', authorize('super_admin', 'admin'), async (req: Request, res: Response) => {
  try {
    const { month_year, branch_id } = req.body;
    if (!month_year) return res.status(400).json({ error: 'month_year required (format: YYYY-MM)' });

    const effectiveBranch = req.user!.role === 'super_admin' ? branch_id : req.user!.branch_id;
    const [year, month] = month_year.split('-').map(Number);
    const dueDate = `${year}-${String(month).padStart(2, '0')}-05`;

    let sql = "SELECT * FROM tenants WHERE status = 'active'";
    const params: any[] = [];
    if (effectiveBranch) { sql += ' AND branch_id = ?'; params.push(effectiveBranch); }

    const tenants = await query(sql, params) as any[];
    let created = 0;

    for (const tenant of tenants) {
      const exists = await queryOne("SELECT id FROM payments WHERE tenant_id = ? AND month_year = ? AND payment_type = 'rent'", [tenant.id, month_year]);
      if (!exists) {
        await run(
          'INSERT INTO payments (id, tenant_id, branch_id, room_id, amount, amount_due, payment_type, due_date, month_year, status, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [uuidv4(), tenant.id, tenant.branch_id, tenant.room_id, 0, tenant.rent_amount, 'rent', dueDate, month_year, 'pending', req.user!.id]
        );
        created++;
      }
    }

    logAudit(req, 'GENERATE_MONTHLY_PAYMENTS', 'payment', undefined, { month_year, created });
    res.json({ message: `Generated ${created} payment records for ${month_year}` });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
