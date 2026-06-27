import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Database, Mail, KeyRound, Loader2, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      login(response.data.user, response.data.token, response.data.refreshToken);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 selection:bg-primary selection:text-white">
      {/* ambient glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[400px] bg-gradient-radial from-indigo-550/10 via-transparent to-transparent pointer-events-none z-0" />

      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-800 p-8 relative overflow-hidden group z-10">
        <div className="absolute -right-16 -top-16 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
        
        <div className="flex flex-col items-center mb-8">
          <Link to="/" className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 border border-primary/20">
            <Database className="w-6 h-6 text-primary animate-pulse" />
          </Link>
          <h1 className="text-2xl font-bold text-slate-100">Log in to your workspace</h1>
          <p className="text-slate-450 mt-1.5 text-xs text-center">
            Enter your credentials below to access your AI SQL client.
          </p>
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/20 text-danger px-4 py-3 rounded-xl mb-6 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Email Address</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-slate-500" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-800 rounded-xl bg-slate-950/60 text-slate-200 placeholder-slate-650 focus:outline-none focus:border-primary transition-all text-xs font-medium"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Password</label>
              <Link to="/forgot-password" className="text-xs text-primary hover:text-primary-hover font-semibold transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <KeyRound className="h-4 w-4 text-slate-500" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="block w-full pl-10 pr-10 py-2.5 border border-slate-800 rounded-xl bg-slate-955/60 text-slate-200 placeholder-slate-650 focus:outline-none focus:border-primary transition-all text-xs font-medium"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-350"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-xl shadow-md text-xs font-bold text-white bg-primary hover:bg-primary-hover focus:outline-none transition-all shadow-primary/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Logging in...
              </>
            ) : 'Log In'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-450">
          New here?{' '}
          <Link to="/register" className="font-bold text-primary hover:text-primary-hover transition-colors">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
