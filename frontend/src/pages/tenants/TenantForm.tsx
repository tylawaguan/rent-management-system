import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Tenant, Room, Branch } from '../../types';
import { currentMonthYear } from '../../utils/format';

interface Props { tenant: Tenant | null; onSubmit: (data: any) => void; }

export default function TenantForm({ tenant, onSubmit }: Props) {
  const { isSuperAdmin, user } = useAuth();
  const [form, setForm] = useState<any>({
    first_name: '', last_name: '', email: '', phone: '', national_id: '',
    emergency_contact: '', emergency_phone: '', move_in_date: new Date().toISOString().split('T')[0],
    lease_end_date: '', rent_amount: '', deposit_paid: '', notes: '', status: 'active',
    branch_id: user?.branch_id || '', room_id: '',
  });

  useEffect(() => {
    if (tenant) setForm({ ...tenant, branch_id: tenant.branch_id, room_id: tenant.room_id || '' });
  }, [tenant]);

  const { data: branches = [] } = useQuery<Branch[]>({ queryKey: ['branches'], queryFn: () => api.get('/branches').then(r => r.data), enabled: isSuperAdmin });
  const branchId = form.branch_id || user?.branch_id;
  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ['rooms-available', branchId],
    queryFn: () => api.get('/rooms', { params: { branch_id: branchId, status: 'available' } }).then(r => r.data),
    enabled: !!branchId,
  });

  const allRooms = useQuery<Room[]>({ queryKey: ['rooms', branchId], queryFn: () => api.get('/rooms', { params: { branch_id: branchId } }).then(r => r.data), enabled: !!branchId && !!tenant });
  const availableRooms = tenant ? (allRooms.data || []).filter(r => r.status === 'available' || r.id === tenant.room_id) : rooms;

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));
  const onRoomChange = (roomId: string) => {
    set('room_id', roomId);
    const room = availableRooms.find(r => r.id === roomId);
    if (room && !tenant) set('rent_amount', room.rent_amount);
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSubmit(form); };

  return (
    <form id="tenant-form" onSubmit={handleSubmit} className="space-y-4">
      {isSuperAdmin && !tenant && (
        <div className="form-group"><label className="label">Branch *</label>
          <select value={form.branch_id} onChange={e => set('branch_id', e.target.value)} className="select" required>
            <option value="">Select branch...</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select></div>
      )}
      <div className="form-group"><label className="label">Assign Room</label>
        <select value={form.room_id} onChange={e => onRoomChange(e.target.value)} className="select">
          <option value="">No room assigned</option>
          {availableRooms.map(r => <option key={r.id} value={r.id}>Room {r.room_number} - Floor {r.floor} ({r.room_type}) - {r.rent_amount.toLocaleString()} RWF</option>)}
        </select></div>
      <div className="form-grid-2">
        <div className="form-group"><label className="label">First Name *</label>
          <input value={form.first_name} onChange={e => set('first_name', e.target.value)} className="input" required /></div>
        <div className="form-group"><label className="label">Last Name *</label>
          <input value={form.last_name} onChange={e => set('last_name', e.target.value)} className="input" required /></div>
      </div>
      <div className="form-grid-2">
        <div className="form-group"><label className="label">Phone *</label>
          <input value={form.phone} onChange={e => set('phone', e.target.value)} className="input" required /></div>
        <div className="form-group"><label className="label">Email</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className="input" /></div>
      </div>
      <div className="form-group"><label className="label">National ID</label>
        <input value={form.national_id || ''} onChange={e => set('national_id', e.target.value)} className="input" /></div>
      <div className="form-grid-2">
        <div className="form-group"><label className="label">Emergency Contact</label>
          <input value={form.emergency_contact || ''} onChange={e => set('emergency_contact', e.target.value)} className="input" /></div>
        <div className="form-group"><label className="label">Emergency Phone</label>
          <input value={form.emergency_phone || ''} onChange={e => set('emergency_phone', e.target.value)} className="input" /></div>
      </div>
      <div className="form-grid-2">
        <div className="form-group"><label className="label">Move In Date *</label>
          <input type="date" value={form.move_in_date} onChange={e => set('move_in_date', e.target.value)} className="input" required /></div>
        <div className="form-group"><label className="label">Lease End Date</label>
          <input type="date" value={form.lease_end_date || ''} onChange={e => set('lease_end_date', e.target.value)} className="input" /></div>
      </div>
      <div className="form-grid-2">
        <div className="form-group"><label className="label">Monthly Rent (RWF) *</label>
          <input type="number" min={0} value={form.rent_amount || ''} onChange={e => set('rent_amount', e.target.value)} className="input" required /></div>
        <div className="form-group"><label className="label">Deposit Paid (RWF)</label>
          <input type="number" min={0} value={form.deposit_paid || ''} onChange={e => set('deposit_paid', e.target.value)} className="input" /></div>
      </div>
      {tenant && (
        <div className="form-group"><label className="label">Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
            {['active','inactive','moved_out','evicted'].map(s => <option key={s} value={s} className="capitalize">{s.replace('_',' ')}</option>)}
          </select></div>
      )}
      <div className="form-group"><label className="label">Notes</label>
        <textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} className="input h-16 resize-none" /></div>
    </form>
  );
}
