import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Database, Mail, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await api.post('/auth/forgot-password', { email });
      setMessage(response.data.message || 'Reset link generated. Check the backend terminal console log.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to request password reset. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 selection:bg-primary selection:text-white">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-[400px] bg-gradient-radial from-indigo-550/10 via-transparent to-transparent pointer-events-none z-0" />
      
      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10 flex flex-col items-center">
        <Link to="/" className="flex items-center gap-2.5 mb-6">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
            <Database className="w-5 h-5 text-primary" />
          </div>
          <span className="font-bold text-xl text-slate-100">Query Generator</span>
        </Link>
        <h2 className="text-center text-2xl font-extrabold text-slate-100">Reset your password</h2>
        <p className="mt-2 text-center text-xs text-slate-450 max-w-sm">
          Enter your email address and we will generate secure password reset instructions in development mode.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="bg-slate-900/60 border border-slate-800 backdrop-blur-md py-8 px-4 shadow-xl rounded-2xl sm:px-10">
          
          {message ? (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-success mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-350 leading-relaxed font-medium">
                {message}
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all shadow border border-slate-700"
              >
                Back to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 bg-danger/10 border border-danger/25 text-danger rounded-xl text-xs font-semibold">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Email address
                </label>
                <div className="mt-2 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-500" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary transition-all font-medium"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full flex justify-center items-center gap-2 py-2.5 px-4 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow shadow-primary/20 active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Requesting...
                    </>
                  ) : (
                    'Generate Reset Link'
                  )}
                </button>
              </div>

              <div className="flex items-center justify-center">
                <Link to="/login" className="inline-flex items-center gap-1.5 text-xs text-slate-450 hover:text-slate-200 transition-colors font-medium">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to login
                </Link>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
