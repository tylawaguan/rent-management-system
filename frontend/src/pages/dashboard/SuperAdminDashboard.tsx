import { useQuery } from '@tanstack/react-query';
import { TrendingUp, CreditCard, Receipt, Home, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import api from '../../utils/api';
import { formatCurrency, formatMonthYear } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import MetricCard from './components/MetricCard';
import ChartCard from './components/ChartCard';
import type { DashboardData } from '../../types';

const C = {
  purple: '#8b5cf6',
  purpleDark: '#7c3aed',
  purpleLight: '#a78bfa',
  purpleLighter: '#c4b5fd',
  emerald: '#10b981',
  amber: '#f59e0b',
  cyan: '#06b6d4',
  gray: '#e5e7eb',
};

const BRANCH_COLORS = [C.purple, C.cyan];
const DONUT_COLORS = [C.purple, C.cyan];
const ROOM_COLORS = [C.emerald, C.purple, C.amber, C.cyan];

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white shadow-lg rounded-xl p-3 border border-gray-100 text-xs min-w-[140px]">
      {label && <div className="font-semibold text-gray-700 mb-2 border-b border-gray-100 pb-1">{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-gray-800 ml-auto pl-2">
            {typeof p.value === 'number' && p.value > 999 ? formatCurrency(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const DonutLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, name }: any) => {
  const RADIAN = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600}>
      {name.split(' ')[0]}
    </text>
  );
};

export default function SuperAdminDashboard() {
  const { data, isLoading, refetch, isFetching } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/reports/dashboard').then(r => r.data),
    refetchInterval: 60000,
  });

  const { data: branchComparison = [] } = useQuery<any[]>({
    queryKey: ['branch-comparison'],
    queryFn: () => api.get('/reports/branch-comparison').then(r => r.data),
    refetchInterval: 60000,
  });

  if (isLoading) return <LoadingSpinner text="Loading dashboard..." />;
  if (!data) return null;

  const { summary, revenue_trend, unpaid_tenants, room_breakdown, payment_stats } = data;

  // Derived metrics
  const totalDue = payment_stats.reduce((a: number, p: any) => a + Number(p.total_due ?? 0), 0);
  const collected = summary.monthly_revenue;
  const totalPaymentCount = payment_stats.reduce((a: number, p: any) => a + Number(p.count ?? 0), 0);
  const collectionRate = totalDue > 0 ? Math.round((collected / totalDue) * 100) : 0;
  const outstandingPct = totalDue > 0 ? Math.round(((totalDue - collected) / totalDue) * 100) : 0;

  // Chart data
  const trendData = revenue_trend.map(r => ({
    month: formatMonthYear(r.month),
    Revenue: r.revenue,
    Collected: r.collected,
  }));

  const paidData = revenue_trend.map(r => ({
    month: formatMonthYear(r.month),
    Paid: r.revenue,
    Outstanding: Math.max(0, r.collected - r.revenue),
  }));

  const perfData = revenue_trend.map(r => ({
    month: formatMonthYear(r.month),
    Target: r.collected,
    Actual: r.revenue,
  }));

  const roomData = room_breakdown.map((r: any) => ({
    type: String(r.status).charAt(0).toUpperCase() + String(r.status).slice(1),
    count: Number(r.count),
  }));

  const branchData = branchComparison.map((b: any) => ({
    branch: b.name,
    revenue: Number(b.revenue) || 0,
  }));

  const donutData = branchComparison
    .map((b: any) => ({ name: b.name, value: Number(b.revenue) || 0 }))
    .filter(d => d.value > 0);

  const yFmt = (v: number) => v >= 1000000 ? `${(v / 1e6).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Sales Performance</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            All branches · {new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-violet-50 border border-violet-100 rounded-xl px-4 py-2">
            <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
            <span className="text-xs font-medium text-violet-700">{summary.total_branches} Branches</span>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 border border-violet-100 rounded-xl transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard
          label="Monthly Revenue"
          value={formatCurrency(collected)}
          sub="this month"
          trend={summary.revenue_growth ? Number(summary.revenue_growth) : undefined}
          icon={TrendingUp}
          iconBg="bg-violet-100"
          iconColor="text-violet-600"
          borderColor="border-violet-500"
        />
        <MetricCard
          label="Total Collected"
          value={formatCurrency(collected)}
          sub={totalDue > 0 ? `of ${formatCurrency(totalDue)} billed` : 'no billing yet'}
          icon={CreditCard}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
          borderColor="border-emerald-500"
        />
        <MetricCard
          label="Total Payments"
          value={`${totalPaymentCount}`}
          sub="transactions"
          icon={Receipt}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          borderColor="border-blue-500"
        />
        <MetricCard
          label="Occupied Rooms"
          value={`${summary.occupied_rooms}`}
          sub={`of ${summary.total_rooms} total`}
          icon={Home}
          iconBg="bg-indigo-100"
          iconColor="text-indigo-600"
          borderColor="border-indigo-500"
        />
        <MetricCard
          label="Outstanding %"
          value={`${outstandingPct}%`}
          sub={formatCurrency(summary.total_outstanding)}
          icon={AlertTriangle}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          borderColor="border-amber-500"
        />
        <MetricCard
          label="Collection Rate"
          value={`${collectionRate}%`}
          sub={`${summary.occupancy_rate}% occupancy`}
          icon={CheckCircle2}
          iconBg="bg-teal-100"
          iconColor="text-teal-600"
          borderColor="border-teal-500"
        />
      </div>

      {/* Row 2: Revenue trend + Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <ChartCard
          title="Revenue & Collection Trend"
          subtitle="Last 6 months"
          badge={{ label: `${trendData.length} months` }}
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.purple} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={C.purple} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCol" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.emerald} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={C.emerald} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={yFmt} axisLine={false} tickLine={false} width={45} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Area type="monotone" dataKey="Collected" stroke={C.purpleLight} strokeWidth={2} fill="url(#gradCol)" dot={false} />
              <Area type="monotone" dataKey="Revenue" stroke={C.purple} strokeWidth={2.5} fill="url(#gradRev)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Revenue by Branch"
          subtitle="Distribution"
          badge={{ label: `${summary.total_branches} branches` }}
        >
          {donutData.length > 0 ? (
            <ResponsiveContainer width="100%" height={230}>
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="46%"
                  innerRadius={55}
                  outerRadius={85}
                  labelLine={false}
                  label={DonutLabel}
                >
                  {donutData.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} contentStyle={{ fontSize: 11 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[230px] flex items-center justify-center text-gray-400 text-xs">No revenue data yet</div>
          )}
        </ChartCard>
      </div>

      {/* Row 3: Monthly Performance + Paid vs Outstanding */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Monthly Performance" subtitle="Billed (target) vs Paid (actual)">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={perfData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={yFmt} axisLine={false} tickLine={false} width={45} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Target" fill={C.gray} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Actual" fill={C.purple} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Paid vs Outstanding" subtitle="Collection breakdown by month">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={paidData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={yFmt} axisLine={false} tickLine={false} width={45} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Paid" fill={C.emerald} radius={[3, 3, 0, 0]} stackId="a" />
              <Bar dataKey="Outstanding" fill={C.amber} radius={[3, 3, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 4: Room Status + By Branch */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ChartCard title="Room Status Breakdown" subtitle="Rooms by occupancy status">
          {roomData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                layout="vertical"
                data={roomData}
                margin={{ top: 5, right: 20, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="type" tick={{ fontSize: 11, fill: '#6b7280' }} width={80} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" name="Rooms" radius={[0, 4, 4, 0]}>
                  {roomData.map((_: any, i: number) => (
                    <Cell key={i} fill={ROOM_COLORS[i % ROOM_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400 text-xs">No rooms added yet</div>
          )}
        </ChartCard>

        <ChartCard title="Revenue by Branch" subtitle="Branch comparison this month">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={branchData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="branch" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickFormatter={yFmt} axisLine={false} tickLine={false} width={45} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="revenue" name="Revenue" radius={[4, 4, 0, 0]}>
                {branchData.map((_: any, i: number) => (
                  <Cell key={i} fill={BRANCH_COLORS[i % BRANCH_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Outstanding Tenants */}
      {unpaid_tenants.length > 0 && (
        <ChartCard
          title="Top Outstanding Tenants"
          subtitle="Tenants with unpaid balances"
          badge={{ label: `${unpaid_tenants.length}`, color: 'bg-red-100 text-red-600' }}
        >
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>Tenant</th><th>Room</th><th>Branch</th><th className="text-right">Outstanding</th></tr>
              </thead>
              <tbody>
                {unpaid_tenants.map((t: any, i: number) => (
                  <tr key={i}>
                    <td>
                      <div className="font-medium text-gray-900 text-xs">{t.name}</div>
                      <div className="text-gray-400 text-xs">{t.phone}</div>
                    </td>
                    <td className="text-xs">{t.room_number || '—'}</td>
                    <td className="text-xs text-gray-500">{t.branch_name}</td>
                    <td className="text-right text-xs font-semibold text-red-600">{formatCurrency(t.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </div>
  );
}
