export function formatCurrency(amount: number, currency = 'RWF'): string {
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatMonthYear(my: string): string {
  const [y, m] = my.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

export function currentMonthYear(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getRoleColor(role: string): string {
  const colors: Record<string, string> = {
    super_admin: 'badge-red',
    admin: 'badge-orange',
    manager: 'badge-blue',
    accountant: 'badge-green',
    receptionist: 'badge-yellow',
    staff: 'badge-gray',
  };
  return colors[role] || 'badge-gray';
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    manager: 'Manager',
    accountant: 'Accountant',
    receptionist: 'Receptionist',
    staff: 'Staff',
  };
  return labels[role] || role;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'badge-green', available: 'badge-green', paid: 'badge-green',
    inactive: 'badge-gray', maintenance: 'badge-yellow', reserved: 'badge-blue',
    occupied: 'badge-blue', partial: 'badge-yellow',
    pending: 'badge-yellow', overdue: 'badge-red', evicted: 'badge-red',
    moved_out: 'badge-gray', waived: 'badge-gray',
  };
  return colors[status] || 'badge-gray';
}
