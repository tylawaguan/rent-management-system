import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Edit, Trash2, MapPin, Phone, Mail, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../utils/format';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import type { Branch } from '../../types';

const EMPTY: Partial<Branch> = { name: '', address: '', phone: '', email: '', description: '', total_floors: 1, status: 'active' };

export default function Branches() {
  const qc = useQueryClient();
  const { isSuperAdmin } = useAuth();
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [selected, setSelected] = useState<Branch | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Branch>>(EMPTY);

  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (data: Partial<Branch>) =>
      selected ? api.put(`/branches/${selected.id}`, data) : api.post('/branches', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      toast.success(selected ? 'Branch updated' : 'Branch created');
      setModal(null);
    },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error saving branch'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/branches/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['branches'] }); toast.success('Branch deleted'); setDeleteId(null); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error deleting branch'),
  });

  const openCreate = () => { setSelected(null); setForm(EMPTY); setModal('create'); };
  const openEdit = (b: Branch) => { setSelected(b); setForm({ ...b }); setModal('edit'); };
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); save.mutate(form); };

  if (isLoading) return <LoadingSpinner text="Loading branches..." />;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Branches</h1>
          <p className="page-subtitle">Manage property branches</p>
        </div>
        {isSuperAdmin && (
          <button onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Branch
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {branches.map(b => (
          <div key={b.id} className="card overflow-hidden">
            <div className="bg-gradient-to-r from-blue-800 to-blue-700 p-5 text-white">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <span className={`badge text-xs ${b.status === 'active' ? 'bg-green-400/20 text-green-100' : 'bg-red-400/20 text-red-100'}`}>
                  {b.status}
                </span>
              </div>
              <h3 className="text-lg font-bold mt-3">{b.name}</h3>
              <div className="flex items-center gap-1 text-blue-200 text-xs mt-1">
                <Layers className="w-3 h-3" /> {b.total_floors} floor{b.total_floors !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="p-5 space-y-3">
              {b.address && <div className="flex gap-2 text-sm text-gray-600"><MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" /><span>{b.address}</span></div>}
              {b.phone && <div className="flex gap-2 text-sm text-gray-600"><Phone className="w-4 h-4 text-gray-400 flex-shrink-0" /><span>{b.phone}</span></div>}
              {b.email && <div className="flex gap-2 text-sm text-gray-600"><Mail className="w-4 h-4 text-gray-400 flex-shrink-0" /><span>{b.email}</span></div>}
              {b.stats && (
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100">
                  <div className="text-center bg-blue-50 rounded-lg p-2">
                    <div className="text-lg font-bold text-blue-700">{b.stats.total_rooms}</div>
                    <div className="text-xs text-blue-500">Rooms</div>
                  </div>
                  <div className="text-center bg-green-50 rounded-lg p-2">
                    <div className="text-lg font-bold text-green-700">{b.stats.active_tenants}</div>
                    <div className="text-xs text-green-500">Tenants</div>
                  </div>
                  <div className="col-span-2 text-center bg-emerald-50 rounded-lg p-2">
                    <div className="text-sm font-bold text-emerald-700">{formatCurrency(b.stats.monthly_revenue)}</div>
                    <div className="text-xs text-emerald-500">Monthly Revenue</div>
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={() => openEdit(b)} className="btn-secondary btn-sm flex-1 justify-center"><Edit className="w-3 h-3" /> Edit</button>
                {isSuperAdmin && (
                  <button onClick={() => setDeleteId(b.id)} className="btn-danger btn-sm"><Trash2 className="w-3 h-3" /></button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {branches.length === 0 && (
        <div className="empty-state card py-20">
          <Building2 className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500">No branches yet. Add your first branch.</p>
        </div>
      )}

      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={modal === 'create' ? 'Add New Branch' : 'Edit Branch'}
        footer={<>
          <button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
          <button form="branch-form" type="submit" disabled={save.isPending} className="btn-primary">
            {save.isPending ? 'Saving...' : selected ? 'Update' : 'Create'}
          </button>
        </>}>
        <form id="branch-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group"><label className="label">Branch Name *</label>
            <input value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="input" required />
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="label">Phone</label>
              <input value={form.phone || ''} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="input" /></div>
            <div className="form-group"><label className="label">Email</label>
              <input type="email" value={form.email || ''} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="input" /></div>
          </div>
          <div className="form-group"><label className="label">Address</label>
            <input value={form.address || ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className="input" /></div>
          <div className="form-grid-2">
            <div className="form-group"><label className="label">Total Floors</label>
              <input type="number" min={1} value={form.total_floors || 1} onChange={e => setForm(p => ({ ...p, total_floors: +e.target.value }))} className="input" /></div>
            <div className="form-group"><label className="label">Status</label>
              <select value={form.status || 'active'} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))} className="select">
                <option value="active">Active</option><option value="inactive">Inactive</option>
              </select></div>
          </div>
          <div className="form-group"><label className="label">Description</label>
            <textarea value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="input h-20 resize-none" /></div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMut.mutate(deleteId)}
        title="Delete Branch" message="This will permanently delete the branch and all associated data. This action cannot be undone."
        confirmLabel="Delete Branch" isLoading={deleteMut.isPending} />
    </div>
  );
}
