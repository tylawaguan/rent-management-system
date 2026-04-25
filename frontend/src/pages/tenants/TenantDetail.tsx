import { Edit, Phone, Mail, DoorOpen, Calendar, CreditCard, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { formatCurrency, formatDate, getStatusColor } from '../../utils/format';
import type { Tenant } from '../../types';

interface Props { tenant: Tenant; onEdit: () => void; }

export default function TenantDetail({ tenant, onEdit }: Props) {
  const paid = tenant.payments?.filter(p => p.status === 'paid').length || 0;
  const overdue = tenant.payments?.filter(p => p.status === 'overdue').length || 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-700 text-2xl font-bold">
            {tenant.first_name.charAt(0)}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{tenant.first_name} {tenant.last_name}</h2>
            <div className="flex items-center gap-3 mt-1">
              <span className={getStatusColor(tenant.status)}>{tenant.status.replace('_', ' ')}</span>
              {tenant.room_number && <span className="flex items-center gap-1 text-sm text-gray-600"><DoorOpen className="w-3 h-3" /> Room {tenant.room_number}</span>}
            </div>
          </div>
        </div>
        <button onClick={onEdit} className="btn-secondary btn-sm"><Edit className="w-3 h-3" /> Edit</button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-green-50 rounded-xl p-3 text-center"><CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" /><div className="text-lg font-bold text-green-700">{paid}</div><div className="text-xs text-green-600">Paid</div></div>
        <div className="bg-yellow-50 rounded-xl p-3 text-center"><Clock className="w-5 h-5 text-yellow-600 mx-auto mb-1" /><div className="text-lg font-bold text-yellow-700">{tenant.unpaid_count || 0}</div><div className="text-xs text-yellow-600">Pending</div></div>
        <div className="bg-red-50 rounded-xl p-3 text-center"><AlertTriangle className="w-5 h-5 text-red-600 mx-auto mb-1" /><div className="text-lg font-bold text-red-700">{overdue}</div><div className="text-xs text-red-600">Overdue</div></div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-600"><Phone className="w-4 h-4 text-gray-400" />{tenant.phone}</div>
          {tenant.email && <div className="flex items-center gap-2 text-gray-600"><Mail className="w-4 h-4 text-gray-400" />{tenant.email}</div>}
          {tenant.national_id && <div className="text-gray-600"><span className="font-medium">ID:</span> {tenant.national_id}</div>}
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-600"><Calendar className="w-4 h-4 text-gray-400" />Moved in: {formatDate(tenant.move_in_date)}</div>
          {tenant.lease_end_date && <div className="text-gray-600">Lease ends: {formatDate(tenant.lease_end_date)}</div>}
          <div className="flex items-center gap-2 text-gray-600"><CreditCard className="w-4 h-4 text-gray-400" />{formatCurrency(tenant.rent_amount)}/month</div>
        </div>
      </div>

      {/* Emergency */}
      {tenant.emergency_contact && (
        <div className="bg-gray-50 rounded-xl p-3 text-sm">
          <div className="font-medium text-gray-700 mb-1">Emergency Contact</div>
          <div className="text-gray-600">{tenant.emergency_contact} — {tenant.emergency_phone}</div>
        </div>
      )}

      {/* Payments */}
      {tenant.payments && tenant.payments.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-2 text-sm">Payment History</h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {tenant.payments.map(p => (
              <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 text-xs">
                <div>
                  <span className="font-medium">{p.month_year}</span>
                  {p.receipt_number && <span className="text-gray-400 ml-2">#{p.receipt_number}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-600">{formatCurrency(p.amount_due)}</span>
                  <span className={getStatusColor(p.status)}>{p.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tenant.notes && (
        <div className="bg-amber-50 rounded-xl p-3 text-sm text-amber-800"><span className="font-medium">Notes: </span>{tenant.notes}</div>
      )}
    </div>
  );
}
