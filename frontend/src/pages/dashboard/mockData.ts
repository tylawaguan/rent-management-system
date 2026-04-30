export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const YEARS = [2023, 2024, 2025, 2026];

export interface MonthMetrics {
  totalRevenue: number;
  totalCollected: number;
  totalPayments: number;
  occupiedRooms: number;
  outstandingPct: number;
  collectionRate: number;
}

export interface TrendPoint {
  month: string;
  revenue: number;
  profit: number;
  target: number;
}

export interface PaidPoint {
  month: string;
  paid: number;
  outstanding: number;
}

export interface BranchPoint {
  branch: string;
  revenue: number;
}

export interface RoomTypePoint {
  type: string;
  revenue: number;
}

export interface DonutPoint {
  name: string;
  value: number;
}

export interface YearData {
  metrics: MonthMetrics[];
  trend: TrendPoint[];
  paidVsOutstanding: PaidPoint[];
  byBranch: BranchPoint[];
  byRoomType: RoomTypePoint[];
  donut: DonutPoint[];
}

function makeYear(
  revenues: number[],
  collRates: number[],
  payments: number[],
  occupied: number[],
  branchSplit: [number, number],
  roomSplit: [number, number, number, number],
): YearData {
  const active = revenues.map((r, i) => ({ r, c: collRates[i], p: payments[i], o: occupied[i] })).filter(x => x.r > 0);

  const metrics: MonthMetrics[] = revenues.map((rev, i) => {
    if (rev === 0) return { totalRevenue: 0, totalCollected: 0, totalPayments: 0, occupiedRooms: 0, outstandingPct: 0, collectionRate: 0 };
    const cr = collRates[i];
    return {
      totalRevenue: rev,
      totalCollected: Math.round(rev * cr),
      totalPayments: payments[i],
      occupiedRooms: occupied[i],
      outstandingPct: Math.round((1 - cr) * 100),
      collectionRate: Math.round(cr * 100),
    };
  });

  const trend: TrendPoint[] = revenues
    .map((rev, i) => ({ month: MONTHS[i], revenue: rev, profit: Math.round(rev * 0.38), target: Math.round(rev * 1.06) }))
    .filter(t => t.revenue > 0);

  const paidVsOutstanding: PaidPoint[] = revenues
    .map((rev, i) => ({ month: MONTHS[i], paid: Math.round(rev * collRates[i]), outstanding: Math.round(rev * (1 - collRates[i])) }))
    .filter(p => p.paid + p.outstanding > 0);

  const totalRev = active.reduce((a, x) => a + x.r, 0);

  const byBranch: BranchPoint[] = [
    { branch: 'UBUMWE HOUSE', revenue: Math.round(totalRev * branchSplit[0]) },
    { branch: 'IHURIRO HOUSE', revenue: Math.round(totalRev * branchSplit[1]) },
  ];

  const byRoomType: RoomTypePoint[] = [
    { type: 'Standard', revenue: Math.round(totalRev * roomSplit[0]) },
    { type: 'Deluxe', revenue: Math.round(totalRev * roomSplit[1]) },
    { type: 'Suite', revenue: Math.round(totalRev * roomSplit[2]) },
    { type: 'Studio', revenue: Math.round(totalRev * roomSplit[3]) },
  ];

  return {
    metrics,
    trend,
    paidVsOutstanding,
    byBranch,
    byRoomType,
    donut: byBranch.map(b => ({ name: b.branch, value: b.revenue })),
  };
}

export const allData: Record<number, YearData> = {
  2023: makeYear(
    [3800000, 3900000, 4000000, 4100000, 4200000, 4000000, 4300000, 4400000, 4200000, 4500000, 4300000, 4600000],
    [0.86, 0.88, 0.87, 0.89, 0.91, 0.85, 0.90, 0.88, 0.87, 0.92, 0.89, 0.91],
    [38, 39, 40, 41, 42, 40, 43, 44, 42, 45, 43, 46],
    [35, 36, 37, 38, 39, 37, 40, 41, 39, 42, 40, 43],
    [0.57, 0.43],
    [0.30, 0.35, 0.20, 0.15],
  ),
  2024: makeYear(
    [4800000, 4900000, 5100000, 5200000, 5300000, 5100000, 5400000, 5500000, 5300000, 5600000, 5400000, 5700000],
    [0.87, 0.89, 0.88, 0.90, 0.92, 0.86, 0.91, 0.89, 0.88, 0.93, 0.90, 0.92],
    [48, 49, 51, 52, 53, 51, 54, 55, 53, 56, 54, 57],
    [42, 43, 45, 46, 47, 45, 48, 49, 47, 50, 48, 51],
    [0.56, 0.44],
    [0.30, 0.36, 0.19, 0.15],
  ),
  2025: makeYear(
    [6000000, 6100000, 6300000, 6400000, 6500000, 6200000, 6600000, 6700000, 6400000, 6800000, 6500000, 6900000],
    [0.88, 0.90, 0.89, 0.91, 0.93, 0.87, 0.92, 0.90, 0.89, 0.94, 0.91, 0.93],
    [60, 61, 63, 64, 65, 62, 66, 67, 64, 68, 65, 69],
    [52, 53, 55, 56, 57, 54, 58, 59, 56, 60, 57, 61],
    [0.55, 0.45],
    [0.31, 0.36, 0.18, 0.15],
  ),
  2026: makeYear(
    [7000000, 7200000, 7400000, 7500000, 0, 0, 0, 0, 0, 0, 0, 0],
    [0.89, 0.91, 0.90, 0.92, 0, 0, 0, 0, 0, 0, 0, 0],
    [70, 72, 74, 75, 0, 0, 0, 0, 0, 0, 0, 0],
    [60, 62, 64, 65, 0, 0, 0, 0, 0, 0, 0, 0],
    [0.55, 0.45],
    [0.31, 0.36, 0.18, 0.15],
  ),
};

export function getYearMetrics(year: number): MonthMetrics {
  const d = allData[year];
  const months = d.metrics.filter(m => m.totalRevenue > 0);
  if (!months.length) return { totalRevenue: 0, totalCollected: 0, totalPayments: 0, occupiedRooms: 0, outstandingPct: 0, collectionRate: 0 };
  return {
    totalRevenue: months.reduce((a, m) => a + m.totalRevenue, 0),
    totalCollected: months.reduce((a, m) => a + m.totalCollected, 0),
    totalPayments: months.reduce((a, m) => a + m.totalPayments, 0),
    occupiedRooms: Math.round(months.reduce((a, m) => a + m.occupiedRooms, 0) / months.length),
    outstandingPct: Math.round(months.reduce((a, m) => a + m.outstandingPct, 0) / months.length),
    collectionRate: Math.round(months.reduce((a, m) => a + m.collectionRate, 0) / months.length),
  };
}

export function shortMoney(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K`;
  return `${amount}`;
}
