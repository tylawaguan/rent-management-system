import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, Building2, TrendingUp, Users, CreditCard } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatMonthYear, currentMonthYear } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { exportToExcel, exportToPDF } from '../../utils/export';
import toast from 'react-hot-toast';

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Reports() {
  const { isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'branches' | 'payments' | 'tenants'>('overview');
  const [month, setMonth] = useState(currentMonthYear());

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/reports/dashboard').then(r => r.data),
  });

  const { data: branchComparison = [], isLoading: branchLoading } = useQuery({
    queryKey: ['branch-comparison'],
    queryFn: () => api.get('/reports/branch-comparison').then(r => r.data),
    enabled: isSuperAdmin,
  });

  const { data: paymentSummary, isLoading: payLoading } = useQuery({
    queryKey: ['payment-summary', month],
    queryFn: () => api.get('/reports/payments/summary', { params: { month_year: month } }).then(r => r.data),
  });

  const { data: tenantOverview } = useQuery({
    queryKey: ['tenant-overview'],
    queryFn: () => api.get('/reports/tenants/overview').then(r => r.data),
  });

  if (dashLoading) return <LoadingSpinner text="Loading reports..." />;

  const trendData = dashboard?.revenue_trend?.map((r: any) => ({
    month: formatMonthYear(r.month), Revenue: r.revenue
  })) || [];

  const tenantData = tenantOverview ? [
    { name: 'Active', value: tenantOverview.active, color: '#22c55e' },
    { name: 'Moved Out', value: tenantOverview.moved_out, color: '#9ca3af' },
    { name: 'Inactive', value: tenantOverview.inactive, color: '#f59e0b' },
    { name: 'Evicted', value: tenantOverview.evicted, color: '#ef4444' },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div><h1 className="page-title">Reports & Analytics</h1><p className="page-subtitle">Comprehensive business insights</p></div>
        <div className="flex gap-2">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input w-36" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          ...(isSuperAdmin ? [{ id: 'branches', label: 'Branches', icon: Building2 }] : []),
          { id: 'payments', label: 'Payments', icon: CreditCard },
          { id: 'tenants', label: 'Tenants', icon: Users },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Monthly Revenue', value: formatCurrency(dashboard?.summary?.monthly_revenue || 0), color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Occupancy Rate', value: `${dashboard?.summary?.occupancy_rate || 0}%`, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Active Tenants', value: dashboard?.summary?.total_tenants || 0, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Outstanding', value: formatCurrency(dashboard?.summary?.total_outstanding || 0), color: 'text-red-600', bg: 'bg-red-50' },
            ].map(s => (
              <div key={s.label} className={`card p-4 ${s.bg}`}>
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-sm text-gray-600 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold">Revenue Trend (6 Months)</h3>
              <button onClick={() => { exportToPDF('Revenue Trend', ['Month', 'Revenue'], trendData.map((r: any) => [r.month, r.Revenue]), 'revenue-trend'); toast.success('Exported'); }} className="btn-secondary btn-sm"><Download className="w-3 h-3" /> PDF</button>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} />
                  <Line type="monotone" dataKey="Revenue" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Branches Tab */}
      {activeTab === 'branches' && isSuperAdmin && (
        <div className="space-y-6">
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold">Branch Performance Comparison</h3>
              <button onClick={() => { exportToExcel(branchComparison, 'branch-comparison', 'Branches'); toast.success('Exported'); }} className="btn-secondary btn-sm"><Download className="w-3 h-3" /> Excel</button>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={branchComparison.map((b: any) => ({ name: b.name, Revenue: b.revenue, Tenants: b.tenants, Rooms: b.total_rooms }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Revenue" fill="#3b82f6" radius={[4,4,0,0]} />
                  <Bar dataKey="Tenants" fill="#22c55e" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branchComparison.map((b: any, i: number) => (
              <div key={b.id} className="card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold" style={{ background: COLORS[i % COLORS.length] }}>
                    {b.name.charAt(0)}
                  </div>
                  <h4 className="font-semibold">{b.name}</h4>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-center bg-gray-50 rounded-lg p-2"><div className="font-bold text-lg">{b.total_rooms}</div><div className="text-gray-500 text-xs">Rooms</div></div>
                  <div className="text-center bg-gray-50 rounded-lg p-2"><div className="font-bold text-lg">{b.tenants}</div><div className="text-gray-500 text-xs">Tenants</div></div>
                  <div className="col-span-2 text-center bg-green-50 rounded-lg p-2"><div className="font-bold text-lg text-green-700">{formatCurrency(b.revenue)}</div><div className="text-green-500 text-xs">Revenue this month</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="space-y-5">
          {payLoading ? <LoadingSpinner /> : paymentSummary && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Due', value: formatCurrency(paymentSummary.total_due), color: 'bg-blue-50 text-blue-700' },
                  { label: 'Collected', value: formatCurrency(paymentSummary.total_collected), color: 'bg-green-50 text-green-700' },
                  { label: 'Outstanding', value: formatCurrency(paymentSummary.total_outstanding), color: 'bg-red-50 text-red-700' },
                  { label: 'Penalties', value: formatCurrency(paymentSummary.total_penalties), color: 'bg-orange-50 text-orange-700' },
                ].map(s => (
                  <div key={s.label} className={`card p-4 ${s.color}`}><div className="text-xl font-bold">{s.value}</div><div className="text-sm mt-1 opacity-75">{s.label}</div></div>
                ))}
              </div>
              <div className="card p-5">
                <h4 className="font-semibold mb-4">Payment Status Breakdown — {month}</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {[
                    { label: 'Paid', count: paymentSummary.paid_count, color: 'bg-green-100 text-green-800' },
                    { label: 'Pending', count: paymentSummary.pending_count, color: 'bg-yellow-100 text-yellow-800' },
                    { label: 'Overdue', count: paymentSummary.overdue_count, color: 'bg-red-100 text-red-800' },
                    { label: 'Partial', count: paymentSummary.partial_count, color: 'bg-blue-100 text-blue-800' },
                    { label: 'Total', count: paymentSummary.total_records, color: 'bg-gray-100 text-gray-800' },
                  ].map(s => (
                    <div key={s.label} className={`rounded-xl p-4 text-center ${s.color}`}>
                      <div className="text-2xl font-bold">{s.count}</div>
                      <div className="text-xs">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tenants Tab */}
      {activeTab === 'tenants' && (
        <div className="space-y-5">
          {tenantOverview && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card p-5">
                <h4 className="font-semibold mb-4">Tenant Status Distribution</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={tenantData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                      {tenantData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="card p-5">
                <h4 className="font-semibold mb-4">Tenant Statistics</h4>
                <div className="space-y-3">
                  {[
                    { label: 'Total Tenants', value: tenantOverview.total, color: 'bg-gray-100' },
                    { label: 'Active', value: tenantOverview.active, color: 'bg-green-100 text-green-700' },
                    { label: 'Moved Out', value: tenantOverview.moved_out, color: 'bg-gray-100' },
                    { label: 'Inactive', value: tenantOverview.inactive, color: 'bg-yellow-100 text-yellow-700' },
                    { label: 'Evicted', value: tenantOverview.evicted, color: 'bg-red-100 text-red-700' },
                  ].map(s => (
                    <div key={s.label} className={`flex items-center justify-between p-3 rounded-xl ${s.color}`}>
                      <span className="text-sm font-medium">{s.label}</span>
                      <span className="font-bold text-lg">{s.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
