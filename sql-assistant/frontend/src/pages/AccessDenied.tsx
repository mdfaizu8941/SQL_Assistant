import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AccessDenied() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 mb-6 border border-rose-500/20 animate-pulse">
        <ShieldAlert className="w-8 h-8" />
      </div>
      
      <h1 className="text-3xl font-extrabold text-slate-100 tracking-tight">Access Denied</h1>
      <p className="text-slate-400 mt-3 max-w-md text-sm leading-relaxed">
        You do not have the required permissions or authentication clearance to view this page. If you are a database manager, please check if your account is awaiting admin approval.
      </p>

      <div className="mt-8 flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => navigate('/')}
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold rounded-lg text-sm border border-slate-700/50 transition-all flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
