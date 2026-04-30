import { useAuth } from '../contexts/AuthContext';
import SuperAdminDashboard from './dashboard/SuperAdminDashboard';
import BranchDashboard from './dashboard/BranchDashboard';

export default function Dashboard() {
  const { isSuperAdmin } = useAuth();
  return isSuperAdmin ? <SuperAdminDashboard /> : <BranchDashboard />;
}
