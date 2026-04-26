import { useState, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Home, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('superadmin@rms.rw');
  const [password, setPassword] = useState('Admin@1234');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Home className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">RENT MANAGEMENT</h1>
          <p className="text-blue-200 text-sm mt-1">SYSTEM — Multi-Branch Platform</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in to your account</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <div className="text-center mt-3">
              <Link to="/forgot-password" className="text-sm text-blue-600 hover:text-blue-800">
                Forgot your password?
              </Link>
            </div>
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
        </div>
      </div>
    </div>
  );
}
