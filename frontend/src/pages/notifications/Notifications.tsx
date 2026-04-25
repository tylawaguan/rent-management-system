import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, AlertTriangle, Clock, CreditCard, Info, Zap } from 'lucide-react';
import api from '../../utils/api';
import { formatDateTime } from '../../utils/format';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import type { Notification } from '../../types';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const TYPE_ICONS: Record<string, { icon: any; color: string; bg: string }> = {
  reminder: { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  overdue: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100' },
  penalty: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-100' },
  payment_received: { icon: CreditCard, color: 'text-green-600', bg: 'bg-green-100' },
  general: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-100' },
  system: { icon: Zap, color: 'text-purple-600', bg: 'bg-purple-100' },
};

export default function Notifications() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications').then(r => r.data),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.put(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', 'unread-notifications'] }),
  });

  const markAll = useMutation({
    mutationFn: () => api.put('/notifications/mark-all-read'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications', 'unread-notifications'] }); toast.success('All marked as read'); },
  });

  const checkOverdue = useMutation({
    mutationFn: () => api.post('/notifications/check-overdue'),
    onSuccess: (res) => { toast.success(res.data.message); qc.invalidateQueries({ queryKey: ['notifications'] }); },
    onError: (e: any) => toast.error(e.response?.data?.error || 'Error'),
  });

  const unread = notifications.filter(n => !n.is_read).length;

  if (isLoading) return <LoadingSpinner text="Loading notifications..." />;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">{unread > 0 ? <span className="text-blue-600">{unread} unread</span> : 'All caught up'}</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button onClick={() => checkOverdue.mutate()} disabled={checkOverdue.isPending} className="btn-secondary">
              <AlertTriangle className="w-4 h-4" /> Check Overdue
            </button>
          )}
          {unread > 0 && (
            <button onClick={() => markAll.mutate()} disabled={markAll.isPending} className="btn-secondary">
              <CheckCheck className="w-4 h-4" /> Mark All Read
            </button>
          )}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="empty-state card py-20">
          <Bell className="w-12 h-12 text-gray-300 mb-3" />
          <p className="text-gray-500">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const { icon: Icon, color, bg } = TYPE_ICONS[n.type] || TYPE_ICONS.general;
            return (
              <div key={n.id}
                onClick={() => !n.is_read && markRead.mutate(n.id)}
                className={`card p-4 flex items-start gap-4 cursor-pointer transition-all hover:shadow-md ${!n.is_read ? 'border-l-4 border-blue-500 bg-blue-50/30' : ''}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-gray-900 text-sm">{n.title}</div>
                    <div className="text-xs text-gray-400 flex-shrink-0">{formatDateTime(n.sent_at)}</div>
                  </div>
                  <p className="text-gray-600 text-sm mt-0.5">{n.message}</p>
                  {n.tenant_name && <p className="text-xs text-blue-600 mt-1">Tenant: {n.tenant_name}</p>}
                </div>
                {!n.is_read && <div className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-1.5" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
