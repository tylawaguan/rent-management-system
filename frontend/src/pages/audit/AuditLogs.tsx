import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../utils/api';
import { formatDateTime, getRoleColor, getRoleLabel } from '../../utils/format';
import { exportToExcel } from '../../utils/export';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import type { AuditLog } from '../../types';
import toast from 'react-hot-toast';

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'badge-green', UPDATE: 'badge-blue', DELETE: 'badge-red', DEACTIVATE: 'badge-orange',
  LOGIN: 'badge-gray', GENERATE: 'badge-yellow',
};

function getActionColor(action: string) {
  const key = Object.keys(ACTION_COLORS).find(k => action.startsWith(k)) || '';
  return ACTION_COLORS[key] || 'badge-gray';
}

export default function AuditLogs() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [entityType, setEntityType] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit', page, entityType, fromDate, toDate],
    queryFn: () => api.get('/audit', { params: { page, limit: 50, entity_type: entityType || undefined, from_date: fromDate || undefined, to_date: toDate || undefined } }).then(r => r.data),
  });

  const logs: AuditLog[] = data?.data || [];
  const pagination = data?.pagination || { pages: 1 };

  const filtered = logs.filter(l =>
    (l.action.toLowerCase().includes(search.toLowerCase())) ||
    (l.user_name?.toLowerCase().includes(search.toLowerCase())) ||
    (l.entity_type?.toLowerCase().includes(search.toLowerCase()))
  );

  const handleExport = () => {
    exportToExcel(logs.map(l => ({
      'Date/Time': formatDateTime(l.created_at), User: l.user_name, Role: l.user_role,
      Action: l.action, 'Entity Type': l.entity_type, 'Entity ID': l.entity_id,
      Status: l.status, IP: l.ip_address,
    })), 'audit-logs', 'Audit Logs');
    toast.success('Exported to Excel');
  };

  if (isLoading) return <LoadingSpinner text="Loading audit logs..." />;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div><h1 className="page-title">Audit Logs</h1><p className="page-subtitle">Track all system activities</p></div>
        <button onClick={handleExport} className="btn-secondary"><Download className="w-4 h-4" /> Export</button>
      </div>

      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" placeholder="Search action, user..." />
        </div>
        <select value={entityType} onChange={e => setEntityType(e.target.value)} className="select w-36">
          <option value="">All Types</option>
          {['user','branch','room','tenant','payment','settings'].map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="input w-36" placeholder="From" />
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="input w-36" placeholder="To" />
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Date/Time</th><th>User</th><th>Action</th><th>Entity</th><th>Status</th><th>IP</th></tr></thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id}>
                  <td className="text-xs text-gray-500 whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                  <td>
                    <div className="text-sm font-medium">{l.user_name || 'System'}</div>
                    {l.user_role && <span className={`${getRoleColor(l.user_role)} text-xs`}>{getRoleLabel(l.user_role)}</span>}
                  </td>
                  <td><span className={`${getActionColor(l.action)} text-xs font-mono`}>{l.action}</span></td>
                  <td className="text-xs">
                    {l.entity_type && <span className="capitalize text-gray-700">{l.entity_type}</span>}
                    {l.details && <div className="text-gray-400 truncate max-w-32" title={l.details}>{(() => { try { const d = JSON.parse(l.details); return Object.entries(d).slice(0,2).map(([k,v]) => `${k}: ${v}`).join(', '); } catch { return l.details; } })()}</div>}
                  </td>
                  <td><span className={l.status === 'success' ? 'badge-green' : 'badge-red'}>{l.status}</span></td>
                  <td className="text-xs text-gray-400 font-mono">{l.ip_address}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">
                  <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" /><div>No audit logs found</div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <span className="text-sm text-gray-500">Page {page} of {pagination.pages} · {data?.pagination?.total || 0} records</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="btn-secondary btn-sm"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setPage(p => Math.min(pagination.pages, p+1))} disabled={page === pagination.pages} className="btn-secondary btn-sm"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
