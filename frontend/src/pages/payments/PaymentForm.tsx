import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Paperclip, X, FileText, Image } from 'lucide-react';
import api from '../../utils/api';
import { currentMonthYear, formatCurrency } from '../../utils/format';
import type { Tenant } from '../../types';

interface Props { onSubmit: (data: FormData) => void; defaultMonth?: string; }

export default function PaymentForm({ onSubmit, defaultMonth }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    tenant_id: '', amount: '', amount_due: '', penalty: '0',
    payment_type: 'rent', payment_method: 'cash',
    due_date: `${defaultMonth || currentMonthYear()}-05`,
    paid_date: new Date().toISOString().split('T')[0],
    month_year: defaultMonth || currentMonthYear(), notes: '',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ['tenants-active'],
    queryFn: () => api.get('/tenants', { params: { status: 'active' } }).then(r => r.data),
  });

  const onTenantChange = (tenantId: string) => {
    const t = tenants.find(t => t.id === tenantId);
    setForm(p => ({ ...p, tenant_id: tenantId, amount_due: t ? String(t.rent_amount) : '', amount: '' }));
  };

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setReceiptFile(file);
  };

  const removeFile = () => {
    setReceiptFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v));
    if (receiptFile) fd.append('receipt_file', receiptFile);
    onSubmit(fd);
  };

  const selectedTenant = tenants.find(t => t.id === form.tenant_id);

  const isImage = receiptFile && receiptFile.type.startsWith('image/');
  const isPdf = receiptFile && receiptFile.type === 'application/pdf';

  return (
    <form id="payment-form" onSubmit={handleSubmit} className="space-y-4">
      {/* Tenant selector */}
      <div className="form-group">
        <label className="label">Tenant *</label>
        <select value={form.tenant_id} onChange={e => onTenantChange(e.target.value)} className="select" required>
          <option value="">Select tenant...</option>
          {tenants.map(t => (
            <option key={t.id} value={t.id}>
              {t.first_name} {t.last_name}{t.room_number ? ` — Room ${t.room_number}` : ''}
            </option>
          ))}
        </select>
      </div>

      {selectedTenant && (
        <div className="bg-blue-50 rounded-lg p-3 text-sm">
          <span className="text-blue-700 font-medium">Monthly Rent: </span>
          <span className="text-blue-900 font-bold">{formatCurrency(selectedTenant.rent_amount)}</span>
        </div>
      )}

      <div className="form-grid-2">
        <div className="form-group">
          <label className="label">Amount Due (RWF) *</label>
          <input type="number" min={0} value={form.amount_due} onChange={e => set('amount_due', e.target.value)} className="input" required />
        </div>
        <div className="form-group">
          <label className="label">Amount Paid (RWF)</label>
          <input type="number" min={0} value={form.amount} onChange={e => set('amount', e.target.value)} className="input" />
        </div>
      </div>

      <div className="form-grid-2">
        <div className="form-group">
          <label className="label">Penalty (RWF)</label>
          <input type="number" min={0} value={form.penalty} onChange={e => set('penalty', e.target.value)} className="input" />
        </div>
        <div className="form-group">
          <label className="label">Month / Year *</label>
          <input type="month" value={form.month_year} onChange={e => set('month_year', e.target.value)} className="input" required />
        </div>
      </div>

      <div className="form-grid-2">
        <div className="form-group">
          <label className="label">Payment Type</label>
          <select value={form.payment_type} onChange={e => set('payment_type', e.target.value)} className="select">
            {['rent','deposit','penalty','utility','other'].map(t => (
              <option key={t} value={t} className="capitalize">{t}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="label">Payment Method</label>
          <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)} className="select">
            {['cash','bank_transfer','mobile_money','cheque','card','other'].map(m => (
              <option key={m} value={m} className="capitalize">{m.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-grid-2">
        <div className="form-group">
          <label className="label">Due Date *</label>
          <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} className="input" required />
        </div>
        <div className="form-group">
          <label className="label">Paid Date</label>
          <input type="date" value={form.paid_date} onChange={e => set('paid_date', e.target.value)} className="input" />
        </div>
      </div>

      {/* Receipt file upload */}
      <div className="form-group">
        <label className="label">Attach Receipt (PDF or Image)</label>
        {!receiptFile ? (
          <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer bg-gray-50 hover:bg-blue-50 hover:border-blue-400 transition-all">
            <div className="flex flex-col items-center gap-1">
              <Paperclip className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-500">Click to attach receipt</span>
              <span className="text-xs text-gray-400">PDF, JPG, PNG up to 5MB</span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={handleFile}
              className="hidden"
            />
          </label>
        ) : (
          <div className="flex items-center gap-3 p-3 border border-green-200 rounded-xl bg-green-50">
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm flex-shrink-0">
              {isImage ? <Image className="w-5 h-5 text-blue-500" /> : <FileText className="w-5 h-5 text-red-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">{receiptFile.name}</div>
              <div className="text-xs text-gray-500">{(receiptFile.size / 1024).toFixed(1)} KB · {isPdf ? 'PDF Document' : 'Image'}</div>
            </div>
            <button type="button" onClick={removeFile} className="p-1 hover:bg-red-100 rounded-lg transition-colors">
              <X className="w-4 h-4 text-red-500" />
            </button>
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="label">Notes</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} className="input h-16 resize-none" />
      </div>
    </form>
  );
}
