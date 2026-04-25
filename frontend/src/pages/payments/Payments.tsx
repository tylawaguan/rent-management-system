import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Plus, Search, Download, RefreshCw, Eye, CheckCircle, Clock, AlertTriangle, FileText, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDate, getStatusColor, currentMonthYear } from '../../utils/format';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import PaymentForm from './PaymentForm';
import { exportToExcel, exportToPDF } from '../../utils/export';
import type { Payment } from '../../types';

export default function Payments() {
  const qc = useQueryClient();
  const { isSuperAdmin, isAdmin } = useAuth();
  const [modal, setModal] = useState<'create' | 'view' | null>(null);
  const [selected, setSelected] = useState<Payment | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMonth, setFilterMonth] = useState(currentMonthYear());
  const [genLoading, setGenLoading] = useState(false);

  const { data: payments = [], isLoading } = useQuery<Payment[]>({
    queryKey: ['payments', filterStatus, filterMonth],
    queryFn: () => api.get('/payments', { params: { status: filterStatus || undefined, month_year: filterMonth || undefined } }).then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (data: FormData) => api.post('/payments', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); toast.success('Payment recorded'); setModal(null); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error recording payment'),
  });

  const filtered = payments.filter(p =>
    (p.tenant_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.room_number || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.receipt_number || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleGenerate = async () => {
    setGenLoading(true);
    try {
      const res = await api.post('/payments/generate-monthly', { month_year: filterMonth });
      toast.success(res.data.message);
      qc.invalidateQueries({ queryKey: ['payments'] });
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Error generating payments');
    } finally {
      setGenLoading(false);
    }
  };

  const handleExportExcel = () => {
    exportToExcel(filtered.map(p => ({
      Tenant: p.tenant_name, Room: p.room_number, Branch: p.branch_name,
      Month: p.month_year, 'Amount Due': p.amount_due, 'Amount Paid': p.amount,
      Penalty: p.penalty, Status: p.status, Method: p.payment_method,
      'Due Date': p.due_date, 'Paid Date': p.paid_date, Receipt: p.receipt_number,
    })), `payments-${filterMonth}`, 'Payments');
    toast.success('Exported to Excel');
  };

  const handleExportPDF = () => {
    exportToPDF(
      `Payments Report — ${filterMonth}`,
      ['Tenant', 'Room', 'Amount Due', 'Paid', 'Status', 'Due Date'],
      filtered.map(p => [p.tenant_name || '', p.room_number || '', formatCurrency(p.amount_due), formatCurrency(p.amount), p.status, p.due_date]),
      `payments-${filterMonth}`
    );
    toast.success('Exported to PDF');
  };

  const stats = {
    total: payments.length,
    paid: payments.filter(p => p.status === 'paid').length,
    pending: payments.filter(p => p.status === 'pending').length,
    overdue: payments.filter(p => p.status === 'overdue').length,
    revenue: payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0),
  };

  if (isLoading) return <LoadingSpinner text="Loading payments..." />;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div><h1 className="page-title">Payments</h1><p className="page-subtitle">Track and manage rent payments</p></div>
        <div className="flex gap-2">
          {isAdmin && (
            <button onClick={handleGenerate} disabled={genLoading} className="btn-secondary">
              <RefreshCw className={`w-4 h-4 ${genLoading ? 'animate-spin' : ''}`} />
              Generate Monthly
            </button>
          )}
          <button onClick={() => setModal('create')} className="btn-primary"><Plus className="w-4 h-4" /> Record Payment</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center"><CreditCard className="w-6 h-6 text-blue-600 mx-auto mb-1" /><div className="text-2xl font-bold">{stats.total}</div><div className="text-xs text-gray-500">Total Records</div></div>
        <div className="card p-4 text-center"><CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" /><div className="text-2xl font-bold text-green-600">{stats.paid}</div><div className="text-xs text-gray-500">Paid</div></div>
        <div className="card p-4 text-center"><Clock className="w-6 h-6 text-yellow-600 mx-auto mb-1" /><div className="text-2xl font-bold text-yellow-600">{stats.pending}</div><div className="text-xs text-gray-500">Pending</div></div>
        <div className="card p-4 text-center"><AlertTriangle className="w-6 h-6 text-red-600 mx-auto mb-1" /><div className="text-2xl font-bold text-red-600">{stats.overdue}</div><div className="text-xs text-gray-500">Overdue</div></div>
      </div>

      {/* Revenue card */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-600 rounded-xl p-5 text-white">
        <div className="text-sm opacity-80">Total Revenue Collected — {filterMonth}</div>
        <div className="text-3xl font-bold mt-1">{formatCurrency(stats.revenue)}</div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" placeholder="Search tenant, room, receipt..." />
        </div>
        <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="input w-40" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select w-36">
          <option value="">All Status</option>
          {['paid','pending','overdue','partial','waived'].map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
        <div className="flex gap-1">
          <button onClick={handleExportExcel} className="btn-secondary btn-sm"><Download className="w-3 h-3" /> Excel</button>
          <button onClick={handleExportPDF} className="btn-secondary btn-sm"><Download className="w-3 h-3" /> PDF</button>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead><tr>
              <th>Tenant</th><th>Room</th>{isSuperAdmin && <th>Branch</th>}<th>Due</th>
              <th>Paid</th><th>Penalty</th><th>Status</th><th>Method</th><th>Receipt</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td>
                    <div className="font-medium text-sm">{p.tenant_name}</div>
                    <div className="text-xs text-gray-400">{p.month_year}</div>
                  </td>
                  <td className="text-sm">{p.room_number || '—'}</td>
                  {isSuperAdmin && <td className="text-xs text-gray-600">{p.branch_name}</td>}
                  <td className="font-medium text-sm">{formatCurrency(p.amount_due)}</td>
                  <td className={`font-semibold text-sm ${p.amount > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {p.amount > 0 ? formatCurrency(p.amount) : '—'}
                  </td>
                  <td className="text-xs">{p.penalty > 0 ? <span className="text-red-600">{formatCurrency(p.penalty)}</span> : '—'}</td>
                  <td><span className={getStatusColor(p.status)}>{p.status}</span></td>
                  <td className="text-xs capitalize">{p.payment_method?.replace('_', ' ')}</td>
                  <td className="text-xs text-blue-600 font-mono">{p.receipt_number || '—'}</td>
                  <td>
                    <button onClick={() => { setSelected(p); setModal('view'); }} className="btn-secondary btn-sm"><Eye className="w-3 h-3" /></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="text-center py-12 text-gray-400">
                  <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" /><div>No payments found</div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={modal === 'create'} onClose={() => setModal(null)} title="Record Payment" size="lg"
        footer={<><button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
          <button form="payment-form" type="submit" disabled={save.isPending} className="btn-primary">{save.isPending ? 'Saving...' : 'Record Payment'}</button></>}>
        <PaymentForm onSubmit={save.mutate} defaultMonth={filterMonth} />
      </Modal>

      <Modal isOpen={modal === 'view'} onClose={() => setModal(null)} title="Payment Details">
        {selected && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Tenant', selected.tenant_name], ['Room', selected.room_number], ['Month', selected.month_year],
                ['Amount Due', formatCurrency(selected.amount_due)], ['Amount Paid', formatCurrency(selected.amount)],
                ['Penalty', selected.penalty > 0 ? formatCurrency(selected.penalty) : '—'],
                ['Status', selected.status], ['Method', (selected.payment_method || '').replace('_', ' ')],
                ['Due Date', formatDate(selected.due_date)], ['Paid Date', formatDate(selected.paid_date)],
                ['Receipt #', selected.receipt_number || '—'],
              ].map(([label, val]) => (
                <div key={label}><span className="text-gray-500">{label}: </span><span className="font-medium">{val}</span></div>
              ))}
            </div>
            {(selected as any).receipt_file && (
              <div className="border border-blue-200 rounded-xl p-3 bg-blue-50">
                <div className="text-blue-700 font-medium text-xs mb-2 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5" /> Attached Receipt
                </div>
                <a
                  href={`/api/payments/receipt-file/${(selected as any).receipt_file}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  {(selected as any).receipt_file}
                </a>
              </div>
            )}
            {selected.notes && <div className="bg-amber-50 rounded-lg p-3 text-amber-800"><span className="font-medium">Notes: </span>{selected.notes}</div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
