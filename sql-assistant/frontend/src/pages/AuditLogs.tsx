import { useState, useEffect } from 'react';
import { Terminal, Shield, CheckCircle2, AlertOctagon, Ban, Calendar, User, Database, Globe, Filter } from 'lucide-react';
import api from '../services/api';

interface AuditLog {
  id: number;
  userId: number;
  email: string;
  role: string;
  connectionName: string;
  query: string;
  ipAddress: string | null;
  status: 'SUCCESS' | 'ERROR' | 'BLOCKED';
  rowsAffected: number | null;
  createdAt: string;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchEmail, setSearchEmail] = useState('');

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.get('/history/audit-logs');
      setLogs(data.auditLogs);
    } catch (err: any) {
      console.error('Failed to load audit logs:', err);
      setError(err.response?.data?.error || 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: 'SUCCESS' | 'ERROR' | 'BLOCKED') => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            SUCCESS
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-450 border border-rose-500/20">
            <AlertOctagon className="w-3 h-3" />
            ERROR
          </span>
        );
      case 'BLOCKED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Ban className="w-3 h-3" />
            BLOCKED
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-6rem)] flex flex-col items-center justify-center text-slate-400">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-medium">Loading system audit trail...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-6rem)] flex flex-col items-center justify-center p-6 text-center">
        <Shield className="w-16 h-16 text-rose-500/20 mb-4" />
        <h2 className="text-xl font-semibold text-slate-200">Load Failed</h2>
        <p className="text-slate-400 mt-2 max-w-md">{error}</p>
        <button
          onClick={fetchAuditLogs}
          className="mt-6 px-4 py-2 bg-primary hover:bg-primary-hover text-white font-medium rounded-lg transition-colors"
        >
          Retry Load
        </button>
      </div>
    );
  }

  // Filter logs by status and email search
  const filteredLogs = logs.filter(log => {
    const matchesStatus = filterStatus === 'ALL' || log.status === filterStatus;
    const matchesSearch = log.email.toLowerCase().includes(searchEmail.toLowerCase()) || 
                          log.query.toLowerCase().includes(searchEmail.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Terminal className="w-6 h-6 text-primary" />
            Security Audit Trail
          </h1>
          <p className="text-slate-400 mt-1">Trace database commands and security policy validations</p>
        </div>
        <button 
          onClick={fetchAuditLogs}
          className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700/50 rounded-lg transition-all"
        >
          Refresh Logs
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-lg">
        
        {/* Filters and search */}
        <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search by email or query statement..."
              value={searchEmail}
              onChange={e => setSearchEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-450 font-semibold bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-850">
              <Filter className="w-3.5 h-3.5" />
              Filter:
            </div>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-850">
              {['ALL', 'SUCCESS', 'BLOCKED', 'ERROR'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1 text-xs font-semibold transition-all ${
                    filterStatus === st 
                      ? 'bg-primary text-white shadow-sm rounded-md' 
                      : 'text-slate-450 hover:text-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredLogs.length > 0 ? (
            <table className="w-full text-left text-sm text-slate-355 border-collapse">
              <thead className="text-xs uppercase bg-slate-950/60 sticky top-0 text-slate-400 border-b border-slate-850">
                <tr>
                  <th className="px-5 py-3 font-semibold">User</th>
                  <th className="px-5 py-3 font-semibold">Connection</th>
                  <th className="px-5 py-3 font-semibold">Query</th>
                  <th className="px-5 py-3 font-semibold text-center">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Rows</th>
                  <th className="px-5 py-3 font-semibold">IP Address</th>
                  <th className="px-5 py-3 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-955/30 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap font-medium text-slate-300">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-500" />
                        <div>
                          <p className="max-w-[200px] truncate" title={log.email}>{log.email}</p>
                          <p className="text-[10px] text-slate-500 capitalize">{log.role.toLowerCase()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-300 max-w-[130px] truncate" title={log.connectionName}>
                          {log.connectionName}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="max-w-[320px] lg:max-w-[420px] font-mono text-xs text-slate-400 bg-slate-950/70 p-2 rounded border border-slate-850 overflow-x-auto scrollbar-thin">
                        <code>{log.query}</code>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-center">
                      {getStatusBadge(log.status)}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-right text-slate-300">
                      {log.rowsAffected !== null ? (
                        <span className="font-semibold">{log.rowsAffected.toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-500 italic">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-400 font-mono text-xs">
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-slate-600" />
                        {log.ipAddress || 'Internal'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-slate-400 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-600" />
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-slate-500">
              <Shield className="w-12 h-12 text-slate-800 mb-2" />
              <p>No audit logs matching search or filters found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
