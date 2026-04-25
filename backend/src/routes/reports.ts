import { Router, Request, Response } from 'express';
import { getDb } from '../database/db';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/dashboard', (req: Request, res: Response) => {
  const db = getDb();
  const isSuperAdmin = req.user!.role === 'super_admin';
  const branchId = isSuperAdmin ? (req.query.branch_id as string) : req.user!.branch_id!;

  const branchFilter = branchId ? 'AND branch_id = ?' : '';
  const branchParam = branchId ? [branchId] : [];

  const currentMonth = new Date().toISOString().slice(0, 7);
  const prevMonth = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  })();

  const totalBranches = isSuperAdmin ? (db.prepare('SELECT COUNT(*) as c FROM branches WHERE status=?').get('active') as any).c : 1;
  const totalRooms = (db.prepare(`SELECT COUNT(*) as c FROM rooms WHERE 1=1 ${branchFilter}`).get(...branchParam) as any).c;
  const occupiedRooms = (db.prepare(`SELECT COUNT(*) as c FROM rooms WHERE status='occupied' ${branchFilter}`).get(...branchParam) as any).c;
  const availableRooms = (db.prepare(`SELECT COUNT(*) as c FROM rooms WHERE status='available' ${branchFilter}`).get(...branchParam) as any).c;
  const totalTenants = (db.prepare(`SELECT COUNT(*) as c FROM tenants WHERE status='active' ${branchFilter}`).get(...branchParam) as any).c;
  const monthlyRevenue = (db.prepare(`SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE status='paid' AND month_year=? ${branchFilter}`).get(currentMonth, ...branchParam) as any).s;
  const pendingPayments = (db.prepare(`SELECT COUNT(*) as c FROM payments WHERE status IN ('pending','overdue') AND month_year=? ${branchFilter}`).get(currentMonth, ...branchParam) as any).c;
  const totalPending = (db.prepare(`SELECT COALESCE(SUM(amount_due - amount),0) as s FROM payments WHERE status IN ('pending','overdue') ${branchFilter}`).get(...branchParam) as any).s;
  const prevRevenue = (db.prepare(`SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE status='paid' AND month_year=? ${branchFilter}`).get(prevMonth, ...branchParam) as any).s;

  // Last 6 months revenue trend
  const months: { month: string; revenue: number; collected: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const my = d.toISOString().slice(0, 7);
    const rev = (db.prepare(`SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE status='paid' AND month_year=? ${branchFilter}`).get(my, ...branchParam) as any).s;
    const due = (db.prepare(`SELECT COALESCE(SUM(amount_due),0) as s FROM payments WHERE month_year=? AND payment_type='rent' ${branchFilter}`).get(my, ...branchParam) as any).s;
    months.push({ month: my, revenue: rev, collected: due });
  }

  // Top unpaid tenants
  const unpaidTenants = db.prepare(`SELECT t.first_name || ' ' || t.last_name as name, t.phone,
    r.room_number, b.name as branch_name, SUM(p.amount_due - p.amount) as outstanding
    FROM payments p JOIN tenants t ON p.tenant_id=t.id LEFT JOIN rooms r ON t.room_id=r.id LEFT JOIN branches b ON t.branch_id=b.id
    WHERE p.status IN ('pending','overdue','partial') ${branchFilter ? 'AND p.' + branchFilter.trim().replace('AND ','') : ''}
    GROUP BY p.tenant_id ORDER BY outstanding DESC LIMIT 5`).all(...branchParam);

  // Room status breakdown
  const roomBreakdown = db.prepare(`SELECT status, COUNT(*) as count FROM rooms WHERE 1=1 ${branchFilter} GROUP BY status`).all(...branchParam);

  // Payment status for current month
  const paymentStats = db.prepare(`SELECT status, COUNT(*) as count, COALESCE(SUM(amount_due),0) as total_due
    FROM payments WHERE month_year=? ${branchFilter} GROUP BY status`).all(currentMonth, ...branchParam);

  const occupancyRate = totalRooms > 0 ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : '0';
  const revenueGrowth = prevRevenue > 0 ? (((monthlyRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1) : '0';

  res.json({
    summary: {
      total_branches: totalBranches,
      total_rooms: totalRooms,
      occupied_rooms: occupiedRooms,
      available_rooms: availableRooms,
      total_tenants: totalTenants,
      monthly_revenue: monthlyRevenue,
      pending_payments: pendingPayments,
      total_outstanding: totalPending,
      occupancy_rate: parseFloat(occupancyRate),
      revenue_growth: parseFloat(revenueGrowth),
    },
    revenue_trend: months,
    unpaid_tenants: unpaidTenants,
    room_breakdown: roomBreakdown,
    payment_stats: paymentStats,
  });
});

router.get('/branch-comparison', authenticate, (req: Request, res: Response) => {
  if (req.user!.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
  const db = getDb();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const branches = db.prepare('SELECT * FROM branches WHERE status=?').all('active') as any[];
  const result = branches.map(b => {
    const stats = db.prepare(`SELECT
      (SELECT COUNT(*) FROM rooms WHERE branch_id=?) as total_rooms,
      (SELECT COUNT(*) FROM rooms WHERE branch_id=? AND status='occupied') as occupied,
      (SELECT COUNT(*) FROM tenants WHERE branch_id=? AND status='active') as tenants,
      (SELECT COALESCE(SUM(amount),0) FROM payments WHERE branch_id=? AND status='paid' AND month_year=?) as revenue,
      (SELECT COUNT(*) FROM payments WHERE branch_id=? AND status IN ('pending','overdue') AND month_year=?) as pending
    `).get(b.id, b.id, b.id, b.id, currentMonth, b.id, currentMonth);
    return { ...b, ...stats };
  });
  res.json(result);
});

router.get('/payments/summary', (req: Request, res: Response) => {
  const db = getDb();
  const { month_year, branch_id } = req.query;
  const branchId = req.user!.role !== 'super_admin' ? req.user!.branch_id : (branch_id as string);
  const my = (month_year as string) || new Date().toISOString().slice(0, 7);

  const branchFilter = branchId ? 'AND p.branch_id=?' : '';
  const params = branchId ? [my, branchId] : [my];

  const summary = db.prepare(`SELECT
    COUNT(*) as total_records,
    COALESCE(SUM(amount_due),0) as total_due,
    COALESCE(SUM(amount),0) as total_collected,
    COALESCE(SUM(penalty),0) as total_penalties,
    COALESCE(SUM(amount_due - amount),0) as total_outstanding,
    SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid_count,
    SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending_count,
    SUM(CASE WHEN status='overdue' THEN 1 ELSE 0 END) as overdue_count,
    SUM(CASE WHEN status='partial' THEN 1 ELSE 0 END) as partial_count
    FROM payments p WHERE month_year=? ${branchFilter}`).get(...params);

  res.json({ month_year: my, ...summary });
});

router.get('/tenants/overview', (req: Request, res: Response) => {
  const db = getDb();
  const branchId = req.user!.role !== 'super_admin' ? req.user!.branch_id : (req.query.branch_id as string);
  const branchFilter = branchId ? 'AND branch_id=?' : '';
  const params = branchId ? [branchId] : [];

  const overview = db.prepare(`SELECT
    SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active,
    SUM(CASE WHEN status='inactive' THEN 1 ELSE 0 END) as inactive,
    SUM(CASE WHEN status='moved_out' THEN 1 ELSE 0 END) as moved_out,
    SUM(CASE WHEN status='evicted' THEN 1 ELSE 0 END) as evicted,
    COUNT(*) as total
    FROM tenants WHERE 1=1 ${branchFilter}`).get(...params);

  res.json(overview);
});

export default router;
