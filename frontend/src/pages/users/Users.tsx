import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users as UsersIcon, Plus, Edit, UserX, Search, Shield, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate, getRoleColor, getRoleLabel, getStatusColor } from '../../utils/format';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import type { User, Branch } from '../../types';

const ROLES_BY_CREATOR: Record<string, string[]> = {
  super_admin: ['admin', 'manager', 'accountant', 'receptionist', 'staff'],
  admin: ['manager', 'accountant', 'receptionist', 'staff'],
};

export default function Users() {
  const qc = useQueryClient();
  const { user: me, isSuperAdmin } = useAuth();
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [selected, setSelected] = useState<User | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<any>({});

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(r => r.data),
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: () => api.get('/branches').then(r => r.data),
    enabled: isSuperAdmin,
  });

  const save = useMutation({
    mutationFn: (data: any) => selected ? api.put(`/users/${selected.id}`, data) : api.post('/users', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success(selected ? 'User updated' : 'User created'); setModal(null); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error saving user'),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast.success('User deactivated'); setDeactivateId(null); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error deactivating user'),
  });

  const openCreate = () => { setSelected(null); setForm({ role: 'manager', status: 'active', password: '' }); setModal('create'); };
  const openEdit = (u: User) => { setSelected(u); setForm({ name: u.name, email: u.email, role: u.role, branch_id: u.branch_id, status: u.status, permissions: u.permissions }); setModal('edit'); };
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); save.mutate(form); };

  const filtered = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));
  const availableRoles = ROLES_BY_CREATOR[me?.role || ''] || [];

  if (isLoading) return <LoadingSpinner text="Loading users..." />;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">{users.length} total users</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> Add User</button>
      </div>

      <div className="card">
        <div className="card-header flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" placeholder="Search users..." />
          </div>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr><th>User</th><th>Role</th><th>Branch</th><th>Status</th><th>Last Login</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{u.name}</div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={getRoleColor(u.role)}>{getRoleLabel(u.role)}</span></td>
                  <td>
                    {u.branch_name
                      ? <div className="flex items-center gap-1 text-xs"><Building2 className="w-3 h-3 text-gray-400" />{u.branch_name}</div>
                      : <span className="flex items-center gap-1 text-xs text-purple-600"><Shield className="w-3 h-3" />All Branches</span>
                    }
                  </td>
                  <td><span className={getStatusColor(u.status)}>{u.status}</span></td>
                  <td className="text-xs text-gray-500">{formatDate(u.last_login)}</td>
                  <td>
                    {u.id !== me?.id && (
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(u)} className="btn-secondary btn-sm"><Edit className="w-3 h-3" /></button>
                        {u.role !== 'super_admin' && (
                          <button onClick={() => setDeactivateId(u.id)} className="btn-danger btn-sm"><UserX className="w-3 h-3" /></button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400"><UsersIcon className="w-8 h-8 mx-auto mb-2 opacity-40" /><div>No users found</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={!!modal} onClose={() => setModal(null)} title={selected ? 'Edit User' : 'Add New User'}
        footer={<><button onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
          <button form="user-form" type="submit" disabled={save.isPending} className="btn-primary">{save.isPending ? 'Saving...' : selected ? 'Update' : 'Create'}</button></>}>
        <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group"><label className="label">Full Name *</label>
            <input value={form.name || ''} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))} className="input" required /></div>
          <div className="form-group"><label className="label">Email *</label>
            <input type="email" value={form.email || ''} onChange={e => setForm((p: any) => ({ ...p, email: e.target.value }))} className="input" required={!selected} /></div>
          <div className="form-group"><label className="label">Password {selected ? '(leave blank to keep current)' : '*'}</label>
            <input type="password" value={form.password || ''} onChange={e => setForm((p: any) => ({ ...p, password: e.target.value }))} className="input" required={!selected} minLength={8} placeholder="Min 8 characters" /></div>
          <div className="form-grid-2">
            <div className="form-group"><label className="label">Role *</label>
              <select value={form.role || 'manager'} onChange={e => setForm((p: any) => ({ ...p, role: e.target.value }))} className="select" required>
                {availableRoles.map(r => <option key={r} value={r}>{getRoleLabel(r)}</option>)}
              </select></div>
            {isSuperAdmin && (
              <div className="form-group"><label className="label">Branch</label>
                <select value={form.branch_id || ''} onChange={e => setForm((p: any) => ({ ...p, branch_id: e.target.value || null }))} className="select">
                  <option value="">All Branches (Super Admin)</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select></div>
            )}
          </div>
          <div className="form-group"><label className="label">Status</label>
            <select value={form.status || 'active'} onChange={e => setForm((p: any) => ({ ...p, status: e.target.value }))} className="select">
              <option value="active">Active</option><option value="inactive">Inactive</option>
            </select></div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deactivateId} onClose={() => setDeactivateId(null)} onConfirm={() => deactivateId && deactivate.mutate(deactivateId)}
        title="Deactivate User" message="This user will no longer be able to log in. You can reactivate them later."
        confirmLabel="Deactivate" isLoading={deactivate.isPending} />
    </div>
  );
}
