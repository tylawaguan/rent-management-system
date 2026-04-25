import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCheck, Plus, Edit, Eye, Search, Phone, DoorOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, formatDate, getStatusColor } from '../../utils/format';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import TenantForm from './TenantForm';
import TenantDetail from './TenantDetail';
import type { Tenant } from '../../types';

export default function Tenants() {
  const qc = useQueryClient();
  const { isSuperAdmin } = useAuth();
  const [modal, setModal] = useState<'create' | 'edit' | 'view' | null>(null);
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');

  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ['tenants', filterStatus],
    queryFn: () => api.get('/tenants', { params: { status: filterStatus || undefined } }).then(r => r.data),
  });

  const { data: tenantDetail } = useQuery<Tenant>({
    queryKey: ['tenant', selected?.id],
    queryFn: () => api.get(`/tenants/${selected!.id}`).then(r => r.data),
    enabled: modal === 'view' && !!selected,
  });

  const save = useMutation({
    mutationFn: (data: any) => selected && modal === 'edit' ? api.put(`/tenants/${selected.id}`, data) : api.post('/tenants', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants'] }); toast.success(modal === 'edit' ? 'Tenant updated' : 'Tenant added'); setModal(null); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error saving tenant'),
  });

  const filtered = tenants.filter(t =>
    `${t.first_name} ${t.last_name} ${t.phone} ${t.national_id || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <LoadingSpinner text="Loading tenants..." />;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div><h1 className="page-title">Tenants</h1><p className="page-subtitle">{tenants.length} tenant{tenants.length !== 1 ? 's' : ''}</p></div>
        <button onClick={() => { setSelected(null); setModal('create'); }} className="btn-primary"><Plus className="w-4 h-4" /> Add Tenant</button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" placeholder="Search by name, phone, ID..." />
        </div>
        <div className="flex gap-1">
          {['', 'active', 'inactive', 'moved_out', 'evicted'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`btn btn-sm ${filterStatus === s ? 'btn-primary' : 'btn-secondary'}`}>
              {s === '' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead><tr>
              <th>Tenant</th><th>Room</th>{isSuperAdmin && <th>Branch</th>}<th>Rent</th>
              <th>Move In</th><th>Status</th><th>Balance</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-sm font-bold">
                        {t.first_name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{t.first_name} {t.last_name}</div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Phone className="w-3 h-3" />{t.phone}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {t.room_number
                      ? <div className="flex items-center gap-1 text-sm"><DoorOpen className="w-3 h-3 text-gray-400" />{t.room_number}</div>
                      : <span className="text-gray-400 text-xs">No room</span>
                    }
                  </td>
                  {isSuperAdmin && <td className="text-xs text-gray-600">{t.branch_name}</td>}
                  <td className="font-semibold text-blue-700 text-sm">{formatCurrency(t.rent_amount)}</td>
                  <td className="text-xs text-gray-500">{formatDate(t.move_in_date)}</td>
                  <td><span className={getStatusColor(t.status)}>{t.status.replace('_', ' ')}</span></td>
                  <td className={`text-sm font-medium ${t.balance > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {t.balance > 0 ? formatCurrency(t.balance) : '—'}
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => { setSelected(t); setModal('view'); }} className="btn-secondary btn-sm"><Eye className="w-3 h-3" /></button>
                      <button onClick={() => { setSelected(t); setModal('edit'); }} className="btn-secondary btn-sm"><Edit className="w-3 h-3" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                  <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-40" /><div>No tenants found</div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Modal isOpen={modal === 'create' || modal === 'edit'} onClose={() => setModal(null)}
        title={modal === 'edit' ? 'Edit Tenant' : 'Add New Tenant'} size="lg"
        footer={<><button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
          <button form="tenant-form" type="submit" disabled={save.isPending} className="btn-primary">
            {save.isPending ? 'Saving...' : modal === 'edit' ? 'Update' : 'Add Tenant'}
          </button></>}>
        <TenantForm tenant={modal === 'edit' ? selected : null} onSubmit={save.mutate} />
      </Modal>

      {/* View Modal */}
      <Modal isOpen={modal === 'view'} onClose={() => setModal(null)} title="Tenant Details" size="xl">
        {tenantDetail && <TenantDetail tenant={tenantDetail} onEdit={() => setModal('edit')} />}
      </Modal>
    </div>
  );
}
