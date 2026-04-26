import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DoorOpen, Plus, Edit, Trash2, Search, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency, getStatusColor } from '../../utils/format';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import type { Room, Branch } from '../../types';

const ROOM_TYPES = ['standard', 'deluxe', 'suite', 'studio', 'office', 'shop'];
const STATUSES = ['available', 'occupied', 'maintenance', 'reserved'];

const TYPE_COLORS: Record<string, string> = {
  standard: 'badge-gray', deluxe: 'badge-blue', suite: 'badge-orange', studio: 'badge-yellow', office: 'badge-green', shop: 'badge-red',
};

export default function Rooms() {
  const qc = useQueryClient();
  const { isSuperAdmin, user: me } = useAuth();
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [selected, setSelected] = useState<Room | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [form, setForm] = useState<Partial<Room>>({});

  const { data: rooms = [], isLoading } = useQuery<Room[]>({
    queryKey: ['rooms', filterBranch, filterStatus],
    queryFn: () => api.get('/rooms', { params: { branch_id: filterBranch || undefined, status: filterStatus || undefined } }).then(r => r.data),
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches').then(r => r.data),
    enabled: isSuperAdmin,
  });

  const save = useMutation({
    mutationFn: (data: any) => selected ? api.put(`/rooms/${selected.id}`, data) : api.post('/rooms', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); toast.success(selected ? 'Room updated' : 'Room added'); setModal(null); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error saving room'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/rooms/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rooms'] }); toast.success('Room deleted'); setDeleteId(null); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error deleting room'),
  });

  const openCreate = () => { setSelected(null); setForm({ room_type: 'standard', floor: 1, capacity: 1, status: 'available', branch_id: me?.branch_id ?? undefined }); setModal('create'); };
  const openEdit = (r: Room) => { setSelected(r); setForm({ ...r }); setModal('edit'); };
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); save.mutate(form); };

  const filtered = rooms.filter(r => r.room_number.toLowerCase().includes(search.toLowerCase()) || r.tenant_name?.toLowerCase().includes(search.toLowerCase()));

  // Group by branch
  const grouped = filtered.reduce<Record<string, Room[]>>((acc, r) => {
    const key = r.branch_name || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  if (isLoading) return <LoadingSpinner text="Loading rooms..." />;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div><h1 className="page-title">Rooms</h1><p className="page-subtitle">{rooms.length} rooms total</p></div>
        <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> Add Room</button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" placeholder="Search room number or tenant..." />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select w-40">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
        {isSuperAdmin && (
          <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} className="select w-48">
            <option value="">All Branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3">
        {STATUSES.map(s => {
          const count = rooms.filter(r => r.status === s).length;
          const colors: Record<string, string> = { available: 'bg-green-50 text-green-700 border-green-200', occupied: 'bg-blue-50 text-blue-700 border-blue-200', maintenance: 'bg-yellow-50 text-yellow-700 border-yellow-200', reserved: 'bg-purple-50 text-purple-700 border-purple-200' };
          return (
            <button key={s} onClick={() => setFilterStatus(filterStatus === s ? '' : s)} className={`rounded-xl border-2 p-3 text-center transition-all ${colors[s]} ${filterStatus === s ? 'shadow-md scale-105' : 'hover:shadow-sm'}`}>
              <div className="text-2xl font-bold">{count}</div>
              <div className="text-xs capitalize">{s}</div>
            </button>
          );
        })}
      </div>

      {/* Rooms grid by branch */}
      {Object.entries(grouped).map(([branchName, branchRooms]) => (
        <div key={branchName} className="space-y-3">
          {isSuperAdmin && (
            <div className="flex items-center gap-2"><div className="h-px flex-1 bg-gray-200" /><span className="text-sm font-semibold text-gray-600 px-2">{branchName}</span><div className="h-px flex-1 bg-gray-200" /></div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {branchRooms.map(r => (
              <div key={r.id} className={`card p-4 cursor-pointer hover:shadow-md transition-all border-2 ${r.status === 'occupied' ? 'border-blue-200' : r.status === 'available' ? 'border-green-200' : r.status === 'maintenance' ? 'border-yellow-200' : 'border-purple-200'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="text-lg font-bold text-gray-900">{r.room_number}</div>
                  <span className={getStatusColor(r.status)}>{r.status}</span>
                </div>
                <div className="text-xs text-gray-500 mb-1">Floor {r.floor} · <span className="capitalize">{r.room_type}</span></div>
                <div className="text-sm font-semibold text-blue-700">{formatCurrency(r.rent_amount)}</div>
                {r.tenant_name && <div className="text-xs text-gray-600 mt-1 truncate">{r.tenant_name}</div>}
                <div className="flex gap-1 mt-3">
                  <button onClick={() => openEdit(r)} className="btn-secondary btn-sm flex-1 justify-center text-xs"><Edit className="w-3 h-3" /></button>
                  {r.status !== 'occupied' && (
                    <button onClick={() => setDeleteId(r.id)} className="btn-danger btn-sm text-xs"><Trash2 className="w-3 h-3" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="empty-state card py-20"><DoorOpen className="w-12 h-12 text-gray-300 mb-3" /><p className="text-gray-500">No rooms found</p></div>
      )}

      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={selected ? 'Edit Room' : 'Add Room'} size="lg"
        footer={<><button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
          <button form="room-form" type="submit" disabled={save.isPending} className="btn-primary">{save.isPending ? 'Saving...' : selected ? 'Update' : 'Add'}</button></>}>
        <form id="room-form" onSubmit={handleSubmit} className="space-y-4">
          {isSuperAdmin && !selected && (
            <div className="form-group"><label className="label">Branch *</label>
              <select value={form.branch_id || ''} onChange={e => setForm(p => ({ ...p, branch_id: e.target.value }))} className="select" required>
                <option value="">Select branch...</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select></div>
          )}
          <div className="form-grid-2">
            <div className="form-group"><label className="label">Room Number *</label>
              <input value={form.room_number || ''} onChange={e => setForm(p => ({ ...p, room_number: e.target.value }))} className="input" required /></div>
            <div className="form-group"><label className="label">Floor</label>
              <input type="number" min={1} value={form.floor || 1} onChange={e => setForm(p => ({ ...p, floor: +e.target.value }))} className="input" /></div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="label">Room Type</label>
              <select value={form.room_type || 'standard'} onChange={e => setForm(p => ({ ...p, room_type: e.target.value as any }))} className="select">
                {ROOM_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select></div>
            <div className="form-group"><label className="label">Status</label>
              <select value={form.status || 'available'} onChange={e => setForm(p => ({ ...p, status: e.target.value as any }))} className="select">
                {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select></div>
          </div>
          <div className="form-grid-2">
            <div className="form-group"><label className="label">Rent Amount (RWF) *</label>
              <input type="number" min={0} value={form.rent_amount || ''} onChange={e => setForm(p => ({ ...p, rent_amount: +e.target.value }))} className="input" required /></div>
            <div className="form-group"><label className="label">Deposit Amount (RWF)</label>
              <input type="number" min={0} value={form.deposit_amount || ''} onChange={e => setForm(p => ({ ...p, deposit_amount: +e.target.value }))} className="input" /></div>
          </div>
          <div className="form-group"><label className="label">Description</label>
            <textarea value={form.description || ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="input h-16 resize-none" /></div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={() => deleteId && deleteMut.mutate(deleteId)}
        title="Delete Room" message="This will permanently remove this room." confirmLabel="Delete" isLoading={deleteMut.isPending} />
    </div>
  );
}
