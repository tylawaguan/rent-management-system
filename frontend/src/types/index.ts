export interface Branch {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  description?: string;
  total_floors: number;
  status: 'active' | 'inactive';
  created_at: string;
  stats?: {
    total_rooms: number;
    occupied_rooms: number;
    active_tenants: number;
    monthly_revenue: number;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'manager' | 'accountant' | 'receptionist' | 'staff';
  branch_id: string | null;
  branch?: Branch | null;
  branch_name?: string;
  permissions: string[];
  status: 'active' | 'inactive';
  last_login?: string;
  created_at: string;
}

export interface Room {
  id: string;
  branch_id: string;
  branch_name?: string;
  room_number: string;
  floor: number;
  room_type: 'standard' | 'deluxe' | 'suite' | 'studio' | 'office' | 'shop';
  capacity: number;
  rent_amount: number;
  deposit_amount: number;
  description?: string;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
  amenities?: string[];
  tenant_name?: string;
  tenant_id?: string;
  current_tenant?: Tenant;
  created_at: string;
}

export interface Tenant {
  id: string;
  branch_id: string;
  branch_name?: string;
  room_id: string | null;
  room_number?: string;
  floor?: number;
  room_type?: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone: string;
  national_id?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  move_in_date: string;
  move_out_date?: string;
  lease_end_date?: string;
  rent_amount: number;
  deposit_paid: number;
  balance: number;
  notes?: string;
  status: 'active' | 'inactive' | 'evicted' | 'moved_out';
  payments?: Payment[];
  unpaid_count?: number;
  created_at: string;
}

export interface Payment {
  id: string;
  tenant_id: string;
  branch_id: string;
  room_id?: string;
  amount: number;
  amount_due: number;
  penalty: number;
  payment_type: 'rent' | 'deposit' | 'penalty' | 'utility' | 'other';
  payment_method: 'cash' | 'bank_transfer' | 'mobile_money' | 'cheque' | 'card' | 'other';
  due_date: string;
  paid_date?: string;
  month_year: string;
  status: 'pending' | 'paid' | 'partial' | 'overdue' | 'waived';
  receipt_number?: string;
  receipt_file?: string;
  notes?: string;
  tenant_name?: string;
  tenant_phone?: string;
  room_number?: string;
  branch_name?: string;
  recorded_by?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  tenant_id?: string;
  branch_id?: string;
  user_id?: string;
  type: 'reminder' | 'overdue' | 'penalty' | 'general' | 'system' | 'payment_received';
  channel: 'in_app' | 'email' | 'sms';
  title: string;
  message: string;
  is_read: number;
  sent_at: string;
  read_at?: string;
  tenant_name?: string;
  branch_name?: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user_name?: string;
  user_role?: string;
  branch_id?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details?: string;
  ip_address?: string;
  status: 'success' | 'failed';
  created_at: string;
}

export interface DashboardData {
  summary: {
    total_branches: number;
    total_rooms: number;
    occupied_rooms: number;
    available_rooms: number;
    total_tenants: number;
    monthly_revenue: number;
    pending_payments: number;
    total_outstanding: number;
    occupancy_rate: number;
    revenue_growth: number;
  };
  revenue_trend: { month: string; revenue: number; collected: number }[];
  unpaid_tenants: { name: string; phone: string; room_number: string; branch_name: string; outstanding: number }[];
  room_breakdown: { status: string; count: number }[];
  payment_stats: { status: string; count: number; total_due: number }[];
}
