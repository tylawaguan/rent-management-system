import { useState, FormEvent, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Eye, EyeOff, Lock, Mail, ShieldCheck, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

export default function Login() {
  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [email, setEmail] = useState('superadmin@rms.rw');
  const [password, setPassword] = useState('Admin@1234');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [userName, setUserName] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { login, verifyOtp } = useAuth();
  const navigate = useNavigate();

  const handleCredentials = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result?.requires_otp) {
        setTempToken(result.temp_token ?? '');
        setUserName(result.user_name ?? '');
        setStep('otp');
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } else {
        toast.success('Welcome back!');
        navigate('/dashboard');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpInput = (i: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...otpCode];
    next[i] = digit;
    setOtpCode(next);
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
  };

  const handleOtpKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[i] && i > 0) otpRefs.current[i - 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6).split('');
    const next = [...otpCode];
    digits.forEach((d, i) => { next[i] = d; });
    setOtpCode(next);
    const last = Math.min(digits.length, 5);
    otpRefs.current[last]?.focus();
    e.preventDefault();
  };

  const handleOtpSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const code = otpCode.join('');
    if (code.length < 6) return toast.error('Enter all 6 digits');
    setLoading(true);
    try {
      await verifyOtp(tempToken, code);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Invalid OTP code');
      setOtpCode(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Home className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">RENT MANAGEMENT</h1>
          <p className="text-blue-200 text-sm mt-1">SYSTEM — Multi-Branch Platform</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">

          {/* Step 1: Credentials */}
          {step === 'credentials' && (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in to your account</h2>
              <form onSubmit={handleCredentials} className="space-y-4">
                <div className="form-group">
                  <label className="label">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      className="input pl-9" placeholder="email@example.com" required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="label">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      className="input pl-9 pr-10" placeholder="••••••••" required />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 mt-2">
                  {loading ? <><span className="spinner w-4 h-4" /> Signing in...</> : 'Sign In'}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-gray-100">
                <p className="text-xs text-gray-500 font-medium mb-3">Demo Accounts</p>
                <div className="grid grid-cols-1 gap-1.5">
                  {[
                    { label: 'Super Admin', email: 'superadmin@rms.rw', pw: 'Admin@1234', color: 'bg-red-50 text-red-700 hover:bg-red-100' },
                    { label: 'Admin (UBUMWE)', email: 'admin.ubumwe@rms.rw', pw: 'Admin@1234', color: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
                    { label: 'Manager', email: 'manager.ubumwe@rms.rw', pw: 'Manager@1234', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
                  ].map(acc => (
                    <button key={acc.email} type="button"
                      onClick={() => { setEmail(acc.email); setPassword(acc.pw); }}
                      className={`text-left text-xs px-3 py-2 rounded-lg transition-colors font-medium ${acc.color}`}>
                      {acc.label}: {acc.email}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 2: OTP */}
          {step === 'otp' && (
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <ShieldCheck className="w-7 h-7 text-blue-700" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">Two-Factor Authentication</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Enter the 6-digit code from your authenticator app
                </p>
                <p className="text-xs font-medium text-blue-700 mt-1">{userName}</p>
              </div>

              <form onSubmit={handleOtpSubmit} className="space-y-6">
                <div>
                  <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
                    {otpCode.map((digit, i) => (
                      <input
                        key={i}
                        ref={el => { otpRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={e => handleOtpInput(i, e.target.value)}
                        onKeyDown={e => handleOtpKeyDown(i, e)}
                        className={`w-11 h-14 text-center text-xl font-bold border-2 rounded-xl transition-all focus:outline-none
                          ${digit ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-800'}
                          focus:border-blue-500 focus:bg-blue-50`}
                      />
                    ))}
                  </div>
                  <p className="text-center text-xs text-gray-400 mt-3">Open your authenticator app and enter the current code</p>
                </div>

                <button type="submit" disabled={loading || otpCode.join('').length < 6} className="btn-primary w-full justify-center py-3">
                  {loading ? <><span className="spinner w-4 h-4" /> Verifying...</> : 'Verify & Sign In'}
                </button>

                <button type="button" onClick={() => { setStep('credentials'); setOtpCode(['','','','','','']); }}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mx-auto">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to login
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
