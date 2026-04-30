import { useQuery } from '@tanstack/react-query';
import { DoorOpen, Users, CreditCard, TrendingUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatMonthYear } from '../../utils/format';
import StatCard from '../../components/common/StatCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import type { DashboardData } from '../../types';

const PIE_COLORS = { available: '#22c55e', occupied: '#3b82f6', maintenance: '#f59e0b', reserved: '#8b5cf6' };
const STATUS_COLORS = { paid: '#22c55e', pending: '#f59e0b', overdue: '#ef4444', partial: '#3b82f6', waived: '#9ca3af' };

export default function BranchDashboard() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/reports/dashboard').then(r => r.data),
    refetchInterval: 60000,
  });

  if (isLoading) return <LoadingSpinner text="Loading dashboard..." />;
  if (!data) return null;
  const { summary, revenue_trend, unpaid_tenants, room_breakdown, payment_stats } = data;

  const trendData = revenue_trend.map(r => ({ month: formatMonthYear(r.month), Revenue: r.revenue }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          {user?.branch?.name || user?.branch_name || 'Branch'} overview
          {' · '}
          <span className="text-blue-600">{new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Rooms" value={summary.total_rooms} icon={DoorOpen} iconBg="bg-blue-100" iconColor="text-blue-600" sub={`${summary.occupied_rooms} occupied`} />
        <StatCard label="Active Tenants" value={summary.total_tenants} icon={Users} iconBg="bg-green-100" iconColor="text-green-600" sub={`${summary.occupancy_rate}% occupancy`} />
        <StatCard label="Monthly Revenue" value={formatCurrency(summary.monthly_revenue)} icon={CreditCard} iconBg="bg-emerald-100" iconColor="text-emerald-600" trend={summary.revenue_growth} />
        <StatCard label="Pending Payments" value={summary.pending_payments} icon={Clock} iconBg="bg-yellow-100" iconColor="text-yellow-600" sub="this month" />
        <StatCard label="Outstanding" value={formatCurrency(summary.total_outstanding)} icon={AlertTriangle} iconBg="bg-red-100" iconColor="text-red-600" />
        <StatCard label="Occupancy Rate" value={`${summary.occupancy_rate}%`} icon={TrendingUp} iconBg="bg-indigo-100" iconColor="text-indigo-600" sub={`${summary.available_rooms} available`} />
        <StatCard label="Paid This Month" value={formatCurrency(summary.monthly_revenue)} icon={CheckCircle} iconBg="bg-teal-100" iconColor="text-teal-600" trend={summary.revenue_growth} sub="vs last month" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card col-span-2">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">Revenue Trend (6 Months)</h3>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
                <Area type="monotone" dataKey="Revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">Room Status</h3>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={room_breakdown} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={75} label={({ count }) => `${count}`}>
                  {room_breakdown.map((entry, i) => (
                    <Cell key={i} fill={PIE_COLORS[entry.status as keyof typeof PIE_COLORS] || '#9ca3af'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend formatter={(v) => <span className="capitalize text-xs">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold text-gray-900">Payment Status (This Month)</h3>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={payment_stats.map(p => ({ status: p.status, count: p.count }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {payment_stats.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.status as keyof typeof STATUS_COLORS] || '#9ca3af'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Top Outstanding Tenants</h3>
            <span className="badge-red">{unpaid_tenants.length} tenants</span>
          </div>
          <div className="overflow-hidden">
            {unpaid_tenants.length === 0 ? (
              <div className="empty-state py-8">
                <CheckCircle className="w-10 h-10 text-green-400 mb-2" />
                <p className="text-gray-500 text-sm">All tenants are up to date</p>
              </div>
            ) : (
              <table className="table">
                <thead><tr><th>Tenant</th><th>Room</th><th className="text-right">Outstanding</th></tr></thead>
                <tbody>
                  {unpaid_tenants.map((t, i) => (
                    <tr key={i}>
                      <td>
                        <div className="font-medium text-gray-900 text-xs">{t.name}</div>
                        <div className="text-gray-400 text-xs">{t.phone}</div>
                      </td>
                      <td className="text-xs">{t.room_number}</td>
                      <td className="text-right text-xs font-semibold text-red-600">{formatCurrency(t.outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
