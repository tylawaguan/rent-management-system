import { useState } from 'react';
import { ShieldCheck, ShieldOff, Copy, CheckCircle, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../utils/api';
import type { User } from '../../types';

interface Props {
  user: User & { otp_enabled?: number };
  onClose: () => void;
  onDone: () => void;
}

type Phase = 'idle' | 'loading' | 'scan' | 'confirm' | 'done';

export default function OtpSetupModal({ user, onClose, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [disabling, setDisabling] = useState(false);

  const isEnabled = !!user.otp_enabled;

  const startSetup = async () => {
    setPhase('loading');
    try {
      const res = await api.post('/auth/setup-otp', { user_id: user.id });
      setQrCode(res.data.qr_code);
      setSecret(res.data.secret);
      setPhase('scan');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to generate OTP');
      setPhase('idle');
    }
  };

  const confirmOtp = async () => {
    if (otpCode.replace(/\s/g, '').length < 6) return toast.error('Enter the 6-digit code from your app');
    setPhase('loading');
    try {
      await api.post('/auth/enable-otp', { user_id: user.id, otp_code: otpCode });
      setPhase('done');
      toast.success(`OTP enabled for ${user.name}`);
      onDone();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Invalid OTP code');
      setOtpCode('');
      setPhase('scan');
    }
  };

  const disableOtp = async () => {
    setDisabling(true);
    try {
      await api.post('/auth/disable-otp', { user_id: user.id });
      toast.success(`OTP disabled for ${user.name}`);
      onDone();
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to disable OTP');
    } finally {
      setDisabling(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    toast.success('Secret copied to clipboard');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
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

      {/* Already enabled — offer disable or re-setup */}
      {isEnabled && phase === 'idle' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl text-sm text-green-800">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Two-factor authentication is active for this account.
          </div>
          <div className="flex gap-2">
            <button onClick={startSetup} className="btn-secondary flex-1 justify-center text-sm">
              Re-generate QR Code
            </button>
            <button onClick={disableOtp} disabled={disabling} className="btn-danger flex-1 justify-center text-sm">
              <ShieldOff className="w-4 h-4" />
              {disabling ? 'Disabling...' : 'Disable OTP'}
            </button>
          </div>
        </div>
      )}

      {/* Not enabled — start setup */}
      {!isEnabled && phase === 'idle' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            Enable two-factor authentication. The user will need to scan a QR code with
            <span className="font-medium"> Google Authenticator</span> or a compatible app.
          </p>
          <button onClick={startSetup} className="btn-primary w-full justify-center">
            <ShieldCheck className="w-4 h-4" /> Set Up OTP
          </button>
        </div>
      )}

      {/* Loading */}
      {phase === 'loading' && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm text-gray-500">Generating secure OTP...</p>
        </div>
      )}

      {/* QR Code scan step */}
      {phase === 'scan' && (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700 mb-1">Step 1 — Scan this QR code</p>
            <p className="text-xs text-gray-500 mb-3">Open your authenticator app and scan the code below</p>
            <div className="inline-block p-3 bg-white border-2 border-gray-200 rounded-2xl shadow-sm">
              <img src={qrCode} alt="OTP QR Code" className="w-48 h-48" />
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1 text-center">Or enter this secret manually:</p>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <code className="flex-1 text-xs text-gray-700 font-mono break-all">{secret}</code>
              <button onClick={copySecret} className="p-1 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0">
                <Copy className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Step 2 — Enter the 6-digit code to confirm</p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000 000"
              className="input text-center text-2xl font-mono tracking-widest"
              autoFocus
            />
          </div>

          <div className="flex gap-2">
            <button onClick={() => { setPhase('idle'); setOtpCode(''); }} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={confirmOtp} disabled={otpCode.length < 6} className="btn-primary flex-1 justify-center">
              Confirm & Enable
            </button>
          </div>
        </div>
      )}

      {/* Done */}
      {phase === 'done' && (
        <div className="text-center space-y-3 py-4">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <p className="font-semibold text-gray-900">OTP Successfully Enabled!</p>
          <p className="text-sm text-gray-500">{user.name} will now need to enter a 6-digit OTP code every time they log in.</p>
          <button onClick={onClose} className="btn-primary mx-auto">Done</button>
        </div>
      )}
    </div>
  );
}
