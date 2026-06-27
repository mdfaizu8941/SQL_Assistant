import { useState, useEffect } from 'react';
import { Activity, Database, CheckCircle2, Loader2, Terminal, BarChart3, DatabaseZap } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface TrendItem {
  date: string;
  success: number;
  failed: number;
  avgTimeMs: number;
  successRate: number;
}

interface AnalyticsData {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  successRate: number;
  recentQueries: any[];
  totalDatabases: number;
  totalTables: number;
  aiChatsCount: number;
  totalDatasets: number;
  recentlyUsedDatabases: string[];
  trendData: TrendItem[];
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

  // Fallback / Sample Trend Data if empty
  const trendData = data?.trendData && data.trendData.length > 0
    ? data.trendData
    : [
        { date: 'Mon', success: 0, failed: 0, avgTimeMs: 0, successRate: 0 },
        { date: 'Tue', success: 0, failed: 0, avgTimeMs: 0, successRate: 0 },
        { date: 'Wed', success: 0, failed: 0, avgTimeMs: 0, successRate: 0 },
        { date: 'Thu', success: 0, failed: 0, avgTimeMs: 0, successRate: 0 },
        { date: 'Fri', success: 0, failed: 0, avgTimeMs: 0, successRate: 0 },
        { date: 'Sat', success: 0, failed: 0, avgTimeMs: 0, successRate: 0 },
        { date: 'Sun', success: 0, failed: 0, avgTimeMs: 0, successRate: 0 }
      ];

  // Calculations for Success Trend SVG
  const maxQueries = Math.max(...trendData.map(d => d.success + d.failed), 5);
  const barChartHeight = 120;
  const barChartWidth = 440;
  const successPoints = trendData.map((d, i) => {
    const total = d.success + d.failed;
    const x = 30 + i * (barChartWidth / trendData.length);
    const successHeight = total > 0 ? (d.success / maxQueries) * barChartHeight : 0;
    const failedHeight = total > 0 ? (d.failed / maxQueries) * barChartHeight : 0;
    return { x, successHeight, failedHeight, success: d.success, failed: d.failed, label: d.date.split('-')[2] || d.date };
  });

  // Calculations for Execution Time Trend SVG
  const maxTime = Math.max(...trendData.map(d => d.avgTimeMs), 100);
  const timeChartHeight = 120;
  const timeChartWidth = 440;
  
  const timePoints = trendData.map((d, i) => {
    const x = 40 + i * ((timeChartWidth - 60) / (trendData.length - 1 || 1));
    const y = 140 - (d.avgTimeMs / maxTime) * timeChartHeight;
    return { x, y, val: d.avgTimeMs, label: d.date.split('-')[2] || d.date };
  });

  const timePathD = timePoints.length > 0 
    ? `M ${timePoints[0].x} ${timePoints[0].y} ` + timePoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
    : '';

  const timeAreaD = timePoints.length > 0
    ? `${timePathD} L ${timePoints[timePoints.length - 1].x} 140 L ${timePoints[0].x} 140 Z`
    : '';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">SQL Assistant Dashboard</h1>
          <p className="text-slate-400 mt-1">Real-time metrics, schema insights, and execution trend analysis</p>
        </div>
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Active Workspace Session
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-primary/5 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary border border-primary/20">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">Total Queries</p>
              <h2 className="text-2xl font-bold text-slate-100">{data?.totalQueries || 0}</h2>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-500/5 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">Success Rate</p>
              <h2 className="text-2xl font-bold text-slate-100">{data?.successRate || 0}%</h2>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-sky-500/5 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-sky-500/10 rounded-xl flex items-center justify-center text-sky-400 border border-sky-500/20">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">Databases / Tables</p>
              <h2 className="text-2xl font-bold text-slate-100">
                {data?.totalDatabases || 0} <span className="text-sm font-normal text-slate-500">/ {data?.totalTables || 0}</span>
              </h2>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-violet-500/5 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-violet-500/10 rounded-xl flex items-center justify-center text-violet-400 border border-violet-500/20">
              <DatabaseZap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-400 mb-1">Uploaded Datasets</p>
              <h2 className="text-2xl font-bold text-slate-100">{data?.totalDatasets || 0}</h2>
            </div>
          </div>
        </div>
      </div>

      {/* SVG Trend Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Success vs Error Trend Stacked Bar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-base font-semibold text-slate-200">Query Success Trend</h3>
              <p className="text-xs text-slate-500 mt-0.5">Stacked count of executions per day</p>
            </div>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" /> Success
              </div>
              <div className="flex items-center gap-1.5 text-rose-400">
                <span className="w-2.5 h-2.5 bg-rose-500 rounded-sm" /> Failed
              </div>
            </div>
          </div>
          
          <div className="flex-1 min-h-[220px] flex items-center justify-center">
            <svg viewBox="0 0 480 180" className="w-full h-full overflow-visible">
              {/* Horizontal Gridlines */}
              <line x1="30" y1="20" x2="450" y2="20" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="30" y1="80" x2="450" y2="80" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="30" y1="140" x2="450" y2="140" stroke="#334155" />

              {/* Y Axis Label */}
              <text x="20" y="24" className="fill-slate-500 text-[10px] text-right font-medium">{maxQueries}</text>
              <text x="20" y="84" className="fill-slate-500 text-[10px] text-right font-medium">{Math.round(maxQueries / 2)}</text>
              <text x="20" y="144" className="fill-slate-500 text-[10px] text-right font-medium">0</text>

              {successPoints.map((p, idx) => (
                <g key={idx} className="group/bar cursor-pointer">
                  {/* Total queries tooltip trigger box */}
                  <rect 
                    x={p.x - 12} 
                    y="10" 
                    width="24" 
                    height="130" 
                    fill="transparent" 
                  />
                  {/* Success part */}
                  <rect
                    x={p.x - 8}
                    y={140 - p.successHeight}
                    width="16"
                    height={p.successHeight}
                    className="fill-emerald-500/80 group-hover/bar:fill-emerald-400 transition-colors"
                    rx="2"
                  />
                  {/* Failed part (stacked above success) */}
                  <rect
                    x={p.x - 8}
                    y={140 - p.successHeight - p.failedHeight}
                    width="16"
                    height={p.failedHeight}
                    className="fill-rose-500/80 group-hover/bar:fill-rose-400 transition-colors"
                    rx="2"
                  />
                  {/* Date label */}
                  <text
                    x={p.x}
                    y="160"
                    textAnchor="middle"
                    className="fill-slate-400 text-[10px] font-medium"
                  >
                    {p.label}
                  </text>
                  {/* Hover count details */}
                  <title>{`Success: ${p.success}, Failed: ${p.failed}`}</title>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Avg Execution Time Trend Area */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-base font-semibold text-slate-200">Execution Speed Trend</h3>
              <p className="text-xs text-slate-500 mt-0.5">Average query response latency in milliseconds</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-sky-400 font-medium">
              <BarChart3 className="w-3.5 h-3.5" /> Avg Speed (ms)
            </div>
          </div>
          
          <div className="flex-1 min-h-[220px] flex items-center justify-center">
            <svg viewBox="0 0 480 180" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="timeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Gridlines */}
              <line x1="40" y1="20" x2="450" y2="20" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="40" y1="80" x2="450" y2="80" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="40" y1="140" x2="450" y2="140" stroke="#334155" />

              {/* Y Axis Label */}
              <text x="30" y="24" className="fill-slate-500 text-[10px] text-right font-medium">{maxTime} ms</text>
              <text x="30" y="84" className="fill-slate-500 text-[10px] text-right font-medium">{Math.round(maxTime / 2)} ms</text>
              <text x="30" y="144" className="fill-slate-500 text-[10px] text-right font-medium">0 ms</text>

              {/* Area path */}
              {timeAreaD && (
                <path d={timeAreaD} fill="url(#timeGrad)" />
              )}

              {/* Line path */}
              {timePathD && (
                <path d={timePathD} fill="none" stroke="#0ea5e9" strokeWidth="2.5" />
              )}

              {/* Tooltip & Point circles */}
              {timePoints.map((p, idx) => (
                <g key={idx} className="group/node cursor-pointer">
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="4"
                    className="fill-slate-900 stroke-sky-400 stroke-[2] group-hover/node:r-6 transition-all"
                  />
                  <text
                    x={p.x}
                    y="160"
                    textAnchor="middle"
                    className="fill-slate-400 text-[10px] font-medium"
                  >
                    {p.label}
                  </text>
                  <title>{`Avg Speed: ${p.val} ms`}</title>
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-800">
            <h2 className="text-lg font-semibold text-slate-200">AI SQL Tools</h2>
          </div>
          <div className="p-6 grid gap-4">
            <Link to="/assistant" className="flex items-center gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-primary/50 hover:bg-slate-900 transition-all group">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Terminal className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-slate-200">Vibrant AI Copilot</h3>
                <p className="text-sm text-slate-500">Generate schema designs or query data in natural language</p>
              </div>
            </Link>
            
            <Link to="/schema" className="flex items-center gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-primary/50 hover:bg-slate-900 transition-all group">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <Database className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-slate-200">Schema Explorer</h3>
                <p className="text-sm text-slate-500">Inspect tables, edit definitions, and manage columns</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent Queries */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-slate-200">Recent Query History</h2>
            <Link to="/history" className="text-sm font-medium text-primary hover:text-primary-hover">View all history</Link>
          </div>
          <div className="divide-y divide-slate-800 flex-1 overflow-y-auto max-h-[300px] min-h-[240px]">
            {data?.recentQueries && data.recentQueries.length > 0 ? (
              data.recentQueries.map((query) => (
                <div key={query.id} className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors">
                  <div className="min-w-0 pr-4 flex-1">
                    <p className="text-sm font-medium text-slate-350 truncate">{query.prompt || 'Manual Query Execution'}</p>
                    <p className="text-xs text-slate-500 mt-1">{new Date(query.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {query.executionTimeMs && (
                      <span className="text-xs text-slate-500">{query.executionTimeMs}ms</span>
                    )}
                    <div className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                      query.status === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-danger/10 text-danger'
                    }`}>
                      {query.status}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500 text-sm">
                No query history recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
