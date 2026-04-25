import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Building2, Users, DoorOpen, UserCheck,
  CreditCard, BarChart3, Bell, ClipboardList, Settings, LogOut, ChevronRight, Home
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import api from '../../utils/api';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', roles: ['super_admin','admin','manager','accountant','receptionist','staff'] },
  { to: '/branches', icon: Building2, label: 'Branches', roles: ['super_admin','admin'] },
  { to: '/users', icon: Users, label: 'Users', roles: ['super_admin','admin'] },
  { to: '/rooms', icon: DoorOpen, label: 'Rooms', roles: ['super_admin','admin','manager'] },
  { to: '/tenants', icon: UserCheck, label: 'Tenants', roles: ['super_admin','admin','manager','receptionist'] },
  { to: '/payments', icon: CreditCard, label: 'Payments', roles: ['super_admin','admin','manager','accountant'] },
  { to: '/reports', icon: BarChart3, label: 'Reports', roles: ['super_admin','admin','manager','accountant'] },
  { to: '/notifications', icon: Bell, label: 'Notifications', roles: ['super_admin','admin','manager'] },
  { to: '/audit', icon: ClipboardList, label: 'Audit Logs', roles: ['super_admin','admin'] },
  { to: '/settings', icon: Settings, label: 'Settings', roles: ['super_admin'] },
];

export default function Sidebar() {
  const { user, logout, isSuperAdmin } = useAuth();
  const location = useLocation();

  const { data: unread = { count: 0 } } = useQuery({
    queryKey: ['unread-notifications'],
    queryFn: () => api.get('/notifications/unread-count').then(r => r.data),
    refetchInterval: 30000,
  });

  const visibleItems = navItems.filter(item => user && item.roles.includes(user.role));

  return (
    <aside className="w-64 min-h-screen bg-gradient-to-b from-blue-900 to-blue-800 flex flex-col shadow-xl">
      {/* Logo */}
      <div className="p-5 border-b border-blue-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Home className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-tight">RENT MANAGEMENT</div>
            <div className="text-blue-200 text-xs">SYSTEM</div>
          </div>
        </div>
      </div>

      {/* User info */}
      <div className="px-4 py-3 border-b border-blue-700/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
            {user?.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-white text-sm font-medium truncate">{user?.name}</div>
            <div className="text-blue-300 text-xs capitalize">
              {user?.role.replace('_', ' ')}
              {user?.branch && !isSuperAdmin && (
                <span className="ml-1 text-blue-400">· {user.branch.name}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto scrollbar-hide">
        {visibleItems.map(item => {
          const isActive = location.pathname.startsWith(item.to);
          const isNotif = item.to === '/notifications';
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{item.label}</span>
              {isNotif && unread.count > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {unread.count > 9 ? '9+' : unread.count}
                </span>
              )}
              {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
            </NavLink>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-blue-700/50">
        <button onClick={logout} className="sidebar-link-inactive w-full">
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
