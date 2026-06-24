import { useState, useEffect } from 'react';
import { Activity, Database, CheckCircle2, TrendingUp, Loader2, Terminal } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface AnalyticsData {
  totalQueries: number;
  successfulQueries: number;
  successRate: number;
  recentQueries: any[];
}

export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await api.get('/history/analytics');
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex justify-center items-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
        <p className="text-slate-400 mt-1">Overview of your SQL Assistant activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-primary/5 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400 mb-1">Total Queries</p>
              <h2 className="text-3xl font-bold text-slate-100">{data?.totalQueries || 0}</h2>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-success/5 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center text-success border border-success/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400 mb-1">Successful</p>
              <h2 className="text-3xl font-bold text-slate-100">{data?.successfulQueries || 0}</h2>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-warning/5 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center text-warning border border-warning/20">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-400 mb-1">Success Rate</p>
              <h2 className="text-3xl font-bold text-slate-100">{data?.successRate || 0}%</h2>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-lg font-semibold text-slate-200">Quick Actions</h2>
          </div>
          <div className="p-6 grid gap-4">
            <Link to="/assistant" className="flex items-center gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-primary/50 hover:bg-slate-900 transition-all group">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-slate-200">New Query</h3>
                <p className="text-sm text-slate-500">Ask the AI a new data question</p>
              </div>
            </Link>
            
            <Link to="/database" className="flex items-center gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-primary/50 hover:bg-slate-900 transition-all group">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-medium text-slate-200">Add Database</h3>
                <p className="text-sm text-slate-500">Connect a new MySQL database</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent Queries */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-200">Recent Queries</h2>
            <Link to="/history" className="text-sm font-medium text-primary hover:text-primary-hover">View all</Link>
          </div>
          <div className="divide-y divide-slate-800">
            {data?.recentQueries && data.recentQueries.length > 0 ? (
              data.recentQueries.map((query) => (
                <div key={query.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                  <div className="min-w-0 pr-4 flex-1">
                    <p className="text-sm font-medium text-slate-300 truncate">{query.prompt}</p>
                    <p className="text-xs text-slate-500 mt-1">{new Date(query.createdAt).toLocaleString()}</p>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    query.status === 'SUCCESS' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                  }`}>
                    {query.status}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                No queries executed yet.
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
