import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Database, Mail, KeyRound, User, Loader2, Eye, EyeOff } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  const getPasswordStrength = (pass: string) => {
    if (!pass) return { label: 'Empty', color: 'bg-slate-800', width: 'w-0' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) score += 1;

    switch (score) {
      case 1:
        return { label: 'Weak', color: 'bg-rose-500', width: 'w-1/4' };
      case 2:
        return { label: 'Medium', color: 'bg-amber-500', width: 'w-2/4' };
      case 3:
        return { label: 'Strong', color: 'bg-emerald-500', width: 'w-3/4' };
      case 4:
        return { label: 'Very Strong', color: 'bg-cyan-500', width: 'w-full' };
      default:
        return { label: 'Too Short', color: 'bg-rose-600', width: 'w-12' };
    }
  };

  const strength = getPasswordStrength(password);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (!acceptTerms) {
      setError('You must accept the terms of service.');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/register', {
        name,
        email,
        password,
        confirmPassword
      });
      login(response.data.user, response.data.token, response.data.refreshToken);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to register. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 selection:bg-primary selection:text-white">
      {/* Ambient glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[450px] bg-gradient-radial from-indigo-550/10 via-transparent to-transparent pointer-events-none z-0" />

      <div className="w-full max-w-md bg-slate-900/60 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-800 p-8 relative overflow-hidden group z-10">
        <div className="absolute -right-16 -top-16 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />
        
        <div className="flex flex-col items-center mb-6">
          <Link to="/" className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 border border-primary/20">
            <Database className="w-6 h-6 text-primary animate-pulse" />
          </Link>
          <h1 className="text-2xl font-bold text-slate-100">Create an Account</h1>
          <p className="text-slate-450 mt-1.5 text-xs text-center">
            Sign up to get access to your secure, AI-powered SQL workspace.
          </p>
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/20 text-danger px-4 py-3 rounded-xl mb-5 text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Full Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <User className="h-4 w-4 text-slate-500" />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-800 rounded-xl bg-slate-950/60 text-slate-200 placeholder-slate-650 focus:outline-none focus:border-primary transition-all text-xs font-medium"
                placeholder="John Doe"
              />
            </div>
          </div>

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
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-800 rounded-xl bg-slate-955/60 text-slate-200 placeholder-slate-650 focus:outline-none focus:border-primary transition-all text-xs font-medium"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Password</label>
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
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-355"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {/* Password strength indicator */}
            {password && (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  <span>Strength:</span>
                  <span className="text-slate-300">{strength.label}</span>
                </div>
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full transition-all duration-500 ${strength.color} ${strength.width}`} />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Confirm Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <KeyRound className="h-4 w-4 text-slate-500" />
              </div>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-800 rounded-xl bg-slate-955/60 text-slate-200 placeholder-slate-650 focus:outline-none focus:border-primary transition-all text-xs font-medium"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Terms checkbox */}
          <div className="flex items-start gap-2 pt-1.5">
            <input
              id="terms"
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 w-3.5 h-3.5 border border-slate-800 bg-slate-950 text-primary rounded outline-none focus:ring-0 cursor-pointer"
            />
            <label htmlFor="terms" className="text-[11px] text-slate-450 leading-tight cursor-pointer">
              I agree to the <span className="text-slate-200 hover:text-white underline font-semibold">Terms of Service</span> and <span className="text-slate-200 hover:text-white underline font-semibold">Privacy Policy</span>.
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !name || !email || !password || !confirmPassword || !acceptTerms}
            className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-xl shadow-md text-xs font-bold text-white bg-primary hover:bg-primary-hover focus:outline-none transition-all shadow-primary/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Registering...
              </>
            ) : 'Sign Up'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-slate-450">
          Already registered?{' '}
          <Link to="/login" className="font-bold text-primary hover:text-primary-hover transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
