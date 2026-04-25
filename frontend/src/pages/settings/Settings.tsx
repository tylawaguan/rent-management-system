import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon, Save, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const SETTINGS_CONFIG = [
  { key: 'system_name', label: 'System Name', type: 'text', desc: 'Display name for the system' },
  { key: 'system_currency', label: 'Currency', type: 'text', desc: 'Currency code (e.g., RWF, USD)' },
  { key: 'penalty_rate', label: 'Late Penalty Rate (%)', type: 'number', desc: 'Percentage penalty for late payments' },
  { key: 'penalty_grace_days', label: 'Grace Period (Days)', type: 'number', desc: 'Days before penalty applies after due date' },
  { key: 'reminder_days_before', label: 'Reminder Days Before Due', type: 'number', desc: 'Days before due date to send payment reminder' },
];

export default function Settings() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });

  const { data: rawSettings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
  });

  useEffect(() => { if (rawSettings) setSettings({ ...rawSettings }); }, [rawSettings]);

  const saveSettings = useMutation({
    mutationFn: (data: Record<string, string>) => api.put('/settings', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast.success('Settings saved'); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error saving settings'),
  });

  const changePw = useMutation({
    mutationFn: (data: any) => api.put('/auth/change-password', data),
    onSuccess: () => { toast.success('Password changed'); setPwForm({ current: '', newPw: '', confirm: '' }); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error changing password'),
  });

  const handlePwSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPw !== pwForm.confirm) return toast.error('Passwords do not match');
    changePw.mutate({ current_password: pwForm.current, new_password: pwForm.newPw });
  };

  if (isLoading) return <LoadingSpinner text="Loading settings..." />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div><h1 className="page-title">Settings</h1><p className="page-subtitle">System configuration</p></div>

      {/* System Settings */}
      {user?.role === 'super_admin' && (
        <div className="card">
          <div className="card-header flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold">System Settings</h3>
          </div>
          <div className="card-body space-y-4">
            {SETTINGS_CONFIG.map(s => (
              <div key={s.key} className="form-group">
                <label className="label">{s.label}</label>
                <input
                  type={s.type}
                  value={settings[s.key] || ''}
                  onChange={e => setSettings(p => ({ ...p, [s.key]: e.target.value }))}
                  className="input"
                />
                <p className="text-xs text-gray-400 mt-1">{s.desc}</p>
              </div>
            ))}
            <button onClick={() => saveSettings.mutate(settings)} disabled={saveSettings.isPending} className="btn-primary">
              <Save className="w-4 h-4" /> {saveSettings.isPending ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Profile Info */}
      <div className="card">
        <div className="card-header"><h3 className="font-semibold">My Profile</h3></div>
        <div className="card-body space-y-3 text-sm">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700 text-2xl font-bold">
              {user?.name.charAt(0)}
            </div>
            <div>
              <div className="font-semibold text-lg">{user?.name}</div>
              <div className="text-gray-500">{user?.email}</div>
              <div className="text-xs text-blue-600 capitalize mt-0.5">{user?.role.replace('_', ' ')}</div>
            </div>
          </div>
          {user?.branch && (
            <div className="bg-blue-50 rounded-lg p-3">
              <span className="text-blue-700 font-medium">Assigned Branch: </span>
              <span className="text-blue-900">{user.branch.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Change Password */}
      <div className="card">
        <div className="card-header flex items-center gap-2">
          <Lock className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold">Change Password</h3>
        </div>
        <div className="card-body">
          <form onSubmit={handlePwSubmit} className="space-y-4">
            <div className="form-group"><label className="label">Current Password</label>
              <input type="password" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} className="input" required /></div>
            <div className="form-group"><label className="label">New Password</label>
              <input type="password" value={pwForm.newPw} onChange={e => setPwForm(p => ({ ...p, newPw: e.target.value }))} className="input" required minLength={8} /></div>
            <div className="form-group"><label className="label">Confirm New Password</label>
              <input type="password" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} className="input" required minLength={8} /></div>
            <button type="submit" disabled={changePw.isPending} className="btn-primary">
              <Lock className="w-4 h-4" /> {changePw.isPending ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
