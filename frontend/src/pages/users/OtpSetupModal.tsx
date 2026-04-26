import { useState } from 'react';
import { ShieldCheck, ShieldOff, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import type { User } from '../../types';

interface Props {
  user: User & { otp_enabled?: number };
  onClose: () => void;
  onDone: () => void;
}

export default function OtpSetupModal({ user, onClose, onDone }: Props) {
  const [loading, setLoading] = useState(false);
  const isEnabled = !!user.otp_enabled;

  const enableOtp = async () => {
    setLoading(true);
    try {
      await api.post('/auth/enable-otp', { user_id: user.id });
      toast.success(`Email OTP enabled for ${user.name}`);
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to enable OTP');
    } finally {
      setLoading(false);
    }
  };

  const disableOtp = async () => {
    setLoading(true);
    try {
      await api.post('/auth/disable-otp', { user_id: user.id });
      toast.success(`Email OTP disabled for ${user.name}`);
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to disable OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* User info header */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-blue-700" />
        </div>
        <div>
          <div className="font-semibold text-gray-900">{user.name}</div>
          <div className="text-xs text-gray-500">{user.email}</div>
        </div>
        <span className={`ml-auto badge ${isEnabled ? 'badge-green' : 'badge-gray'}`}>
          {isEnabled ? 'OTP Active' : 'No OTP'}
        </span>
      </div>

      {/* Email OTP explanation */}
      <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
        <Mail className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-gray-600">
          When enabled, a <strong>6-digit code</strong> will be sent to{' '}
          <span className="font-medium text-gray-900">{user.email}</span> each time this user logs in.
        </div>
      </div>

      {/* Current status and actions */}
      {isEnabled ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl text-sm text-green-800">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Two-factor authentication via email is <strong>active</strong> for this account.
          </div>
          <button
            onClick={disableOtp}
            disabled={loading}
            className="btn-danger w-full justify-center"
          >
            <ShieldOff className="w-4 h-4" />
            {loading ? 'Disabling...' : 'Disable Email OTP'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Two-factor authentication is currently <strong>disabled</strong> for this account.
          </div>
          <button
            onClick={enableOtp}
            disabled={loading}
            className="btn-primary w-full justify-center"
          >
            <ShieldCheck className="w-4 h-4" />
            {loading ? 'Enabling...' : 'Enable Email OTP'}
          </button>
        </div>
      )}

      <button onClick={onClose} className="btn-secondary w-full justify-center">
        Cancel
      </button>
    </div>
  );
}
