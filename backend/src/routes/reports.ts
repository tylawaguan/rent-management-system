import { Router, Request, Response } from 'express';
import { query, queryOne } from '../database/db';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const isSuperAdmin = req.user!.role === 'super_admin';
    const branchId = isSuperAdmin ? (req.query.branch_id as string) : req.user!.branch_id!;
    const branchFilter = branchId ? 'AND branch_id = ?' : '';
    const bp = branchId ? [branchId] : [];
    const currentMonth = new Date().toISOString().slice(0, 7);
    const prevMonth = (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();

    const [totalBranches, totalRooms, occupiedRooms, availableRooms, totalTenants,
      monthlyRevenue, pendingPayments, totalPending, prevRevenue] = await Promise.all([
      isSuperAdmin
        ? queryOne<any>("SELECT COUNT(*) as c FROM branches WHERE status = 'active'")
        : Promise.resolve({ c: 1 }),
      queryOne<any>(`SELECT COUNT(*) as c FROM rooms WHERE 1=1 ${branchFilter}`, bp),
      queryOne<any>(`SELECT COUNT(*) as c FROM rooms WHERE status = 'occupied' ${branchFilter}`, bp),
      queryOne<any>(`SELECT COUNT(*) as c FROM rooms WHERE status = 'available' ${branchFilter}`, bp),
      queryOne<any>(`SELECT COUNT(*) as c FROM tenants WHERE status = 'active' ${branchFilter}`, bp),
      queryOne<any>(`SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE status='paid' AND month_year=? ${branchFilter}`, [currentMonth, ...bp]),
      queryOne<any>(`SELECT COUNT(*) as c FROM payments WHERE status IN ('pending','overdue') AND month_year=? ${branchFilter}`, [currentMonth, ...bp]),
      queryOne<any>(`SELECT COALESCE(SUM(amount_due - amount),0) as s FROM payments WHERE status IN ('pending','overdue') ${branchFilter}`, bp),
      queryOne<any>(`SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE status='paid' AND month_year=? ${branchFilter}`, [prevMonth, ...bp]),
    ]);

    // Last 6 months revenue trend
    const months = await Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
        return d.toISOString().slice(0, 7);
      }).map(async my => {
        const [rev, due] = await Promise.all([
          queryOne<any>(`SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE status='paid' AND month_year=? ${branchFilter}`, [my, ...bp]),
          queryOne<any>(`SELECT COALESCE(SUM(amount_due),0) as s FROM payments WHERE month_year=? AND payment_type='rent' ${branchFilter}`, [my, ...bp]),
        ]);
        return { month: my, revenue: rev?.s ?? 0, collected: due?.s ?? 0 };
      })
    );

    const bfPayments = branchId ? 'AND p.branch_id = ?' : '';
    const unpaidTenants = await query(`
      SELECT CONCAT(t.first_name, ' ', t.last_name) as name, t.phone,
        r.room_number, b.name as branch_name, SUM(p.amount_due - p.amount) as outstanding
      FROM payments p JOIN tenants t ON p.tenant_id = t.id
      LEFT JOIN rooms r ON t.room_id = r.id LEFT JOIN branches b ON t.branch_id = b.id
      WHERE p.status IN ('pending','overdue','partial') ${bfPayments}
      GROUP BY p.tenant_id ORDER BY outstanding DESC LIMIT 5
    `, bp);

    const roomBreakdown = await query(`SELECT status, COUNT(*) as count FROM rooms WHERE 1=1 ${branchFilter} GROUP BY status`, bp);
    const paymentStats = await query(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(amount_due),0) as total_due FROM payments WHERE month_year=? ${branchFilter} GROUP BY status`,
      [currentMonth, ...bp]
    );

    const occ = totalRooms?.c ?? 0;
    const occRate = occ > 0 ? (((occupiedRooms?.c ?? 0) / occ) * 100).toFixed(1) : '0';
    const prev = prevRevenue?.s ?? 0;
    const curr = monthlyRevenue?.s ?? 0;
    const revGrowth = prev > 0 ? (((curr - prev) / prev) * 100).toFixed(1) : '0';

    res.json({
      summary: {
        total_branches: totalBranches?.c ?? 1,
        total_rooms: totalRooms?.c ?? 0,
        occupied_rooms: occupiedRooms?.c ?? 0,
        available_rooms: availableRooms?.c ?? 0,
        total_tenants: totalTenants?.c ?? 0,
        monthly_revenue: curr,
        pending_payments: pendingPayments?.c ?? 0,
        total_outstanding: totalPending?.s ?? 0,
        occupancy_rate: parseFloat(occRate),
        revenue_growth: parseFloat(revGrowth),
      },
      revenue_trend: months,
      unpaid_tenants: unpaidTenants,
      room_breakdown: roomBreakdown,
      payment_stats: paymentStats,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/branch-comparison', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'super_admin') return res.status(403).json({ error: 'Super Admin only' });
    const currentMonth = new Date().toISOString().slice(0, 7);
    const branches = await query<any>("SELECT * FROM branches WHERE status = 'active'");

    const result = await Promise.all(branches.map(async b => {
      const [stats] = await query(`
        SELECT
          (SELECT COUNT(*) FROM rooms WHERE branch_id = ?) as total_rooms,
          (SELECT COUNT(*) FROM rooms WHERE branch_id = ? AND status = 'occupied') as occupied,
          (SELECT COUNT(*) FROM tenants WHERE branch_id = ? AND status = 'active') as tenants,
          (SELECT COALESCE(SUM(amount),0) FROM payments WHERE branch_id = ? AND status = 'paid' AND month_year = ?) as revenue,
          (SELECT COUNT(*) FROM payments WHERE branch_id = ? AND status IN ('pending','overdue') AND month_year = ?) as pending
      `, [b.id, b.id, b.id, b.id, currentMonth, b.id, currentMonth]);
      return { ...b, ...stats };
    }));

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/payments/summary', async (req: Request, res: Response) => {
  try {
    const { month_year, branch_id } = req.query;
    const branchId = req.user!.role !== 'super_admin' ? req.user!.branch_id : (branch_id as string);
    const my = (month_year as string) || new Date().toISOString().slice(0, 7);
    const branchFilter = branchId ? 'AND p.branch_id = ?' : '';
    const params = branchId ? [my, branchId] : [my];

    const summary = await queryOne(`
      SELECT COUNT(*) as total_records,
        COALESCE(SUM(amount_due),0) as total_due,
        COALESCE(SUM(amount),0) as total_collected,
        COALESCE(SUM(penalty),0) as total_penalties,
        COALESCE(SUM(amount_due - amount),0) as total_outstanding,
        SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status='overdue' THEN 1 ELSE 0 END) as overdue_count,
        SUM(CASE WHEN status='partial' THEN 1 ELSE 0 END) as partial_count
      FROM payments p WHERE month_year = ? ${branchFilter}
    `, params);

    res.json({ month_year: my, ...summary });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/tenants/overview', async (req: Request, res: Response) => {
  try {
    const branchId = req.user!.role !== 'super_admin' ? req.user!.branch_id : (req.query.branch_id as string);
    const branchFilter = branchId ? 'AND branch_id = ?' : '';
    const params = branchId ? [branchId] : [];

    const overview = await queryOne(`
      SELECT
        SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status='inactive' THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN status='moved_out' THEN 1 ELSE 0 END) as moved_out,
        SUM(CASE WHEN status='evicted' THEN 1 ELSE 0 END) as evicted,
        COUNT(*) as total
      FROM tenants WHERE 1=1 ${branchFilter}
    `, params);

    res.json(overview);
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
