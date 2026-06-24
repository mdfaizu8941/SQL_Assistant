import { useState, useEffect } from 'react';
import { Shield, CheckCircle, Ban, AlertTriangle, Users, UserCheck, KeyRound, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface AuditLog {
  id: number;
  userId: number;
  email: string;
  role: string;
  query: string;
  ipAddress: string | null;
  status: 'SUCCESS' | 'ERROR' | 'BLOCKED';
  createdAt: string;
}

interface SecurityStats {
  totalUsers: number;
  activeUsers: number;
  totalQueries: number;
  blockedCount: number;
  failedLogins: number;
  pendingApprovals: number;
  recentAuditLogs: AuditLog[];
}

export default function SecurityDashboard() {
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const fetchSecurityData = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.get('/history/security-stats');
      setStats(data);
    } catch (err: any) {
      console.error('Failed to load security statistics:', err);
      setError(err.response?.data?.error || 'Failed to load security stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-6rem)] flex flex-col items-center justify-center text-slate-400">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-medium">Loading security widgets...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-6rem)] flex flex-col items-center justify-center p-6 text-center">
        <Shield className="w-16 h-16 text-rose-500/20 mb-4" />
        <h2 className="text-xl font-semibold text-slate-200">Security Stats Load Failed</h2>
        <p className="text-slate-400 mt-2 max-w-md">{error}</p>
        <button
          onClick={fetchSecurityData}
          className="mt-6 px-4 py-2 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors"
        >
          Retry Load
        </button>
      </div>
    );
  }

  const recentLogs = stats?.recentAuditLogs || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Security Dashboard
          </h1>
          <p className="text-slate-400 mt-1">Real-time system state, logins, and request checks</p>
        </div>
        <button
          onClick={fetchSecurityData}
          className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all"
        >
          Refresh Widgets
        </button>
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Total Users */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Total Registered Users</p>
              <h3 className="text-3xl font-bold text-slate-100 mt-2">{stats?.totalUsers}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-500 opacity-60"></div>
        </div>

        {/* Active Users */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Active User Accounts</p>
              <h3 className="text-3xl font-bold text-emerald-400 mt-2">{stats?.activeUsers}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-60"></div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Pending Manager Approvals</p>
              <h3 className="text-3xl font-bold text-amber-500 mt-2">{stats?.pendingApprovals}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500 opacity-60"></div>
        </div>

        {/* Total Queries Executed */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Queries Executed</p>
              <h3 className="text-3xl font-bold text-sky-400 mt-2">{stats?.totalQueries}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center border border-sky-500/20 text-sky-400">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 to-blue-500 opacity-60"></div>
        </div>

        {/* Blocked Dangerous Queries */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Blocked Dangerous Queries</p>
              <h3 className="text-3xl font-bold text-rose-500 mt-2">{stats?.blockedCount}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-450">
              <Ban className="w-5 h-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 to-pink-500 opacity-60"></div>
        </div>

        {/* Failed Login Attempts */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Failed Login Attempts</p>
              <h3 className="text-3xl font-bold text-orange-500 mt-2">{stats?.failedLogins}</h3>
            </div>
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20 text-orange-400">
              <KeyRound className="w-5 h-5" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-red-500 opacity-60"></div>
        </div>

      </div>

      {/* Activity Log Summary */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-md">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Recent Security Activity
          </h2>
          <Link
            to="/admin/audit-logs"
            className="text-xs font-semibold text-primary hover:text-primary-hover flex items-center gap-1 transition-colors"
          >
            Full Audit Logs
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="divide-y divide-slate-850">
          {recentLogs.length > 0 ? (
            recentLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-950/20 transition-colors flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-lg border mt-0.5 ${
                    log.status === 'BLOCKED'
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-450'
                      : log.status === 'ERROR'
                      ? 'bg-amber-500/10 border-amber-500/20 text-amber-450'
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450'
                  }`}>
                    {log.status === 'BLOCKED' ? (
                      <Ban className="w-4 h-4" />
                    ) : log.status === 'ERROR' ? (
                      <AlertTriangle className="w-4 h-4" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      {log.email} <span className="text-xs text-slate-500 font-mono">({log.role})</span>
                    </p>
                    <p className="font-mono text-xs text-slate-450 mt-1 max-w-xl truncate">
                      <code>{log.query}</code>
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                    log.status === 'BLOCKED'
                      ? 'bg-rose-500/15 text-rose-400'
                      : log.status === 'ERROR'
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-emerald-500/15 text-emerald-400'
                  }`}>
                    {log.status}
                  </span>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-500 text-sm">
              No recent security activity found.
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
