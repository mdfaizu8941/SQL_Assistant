import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History,
  Loader2,
  Code,
  Terminal,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Trash2,
  Play,
  Star,
  Trash
} from 'lucide-react';
import api from '../services/api';

interface QueryRecord {
  id: number;
  prompt: string;
  generatedSql: string;
  executionTimeMs: number | null;
  status: string;
  createdAt: string;
}

export default function QueryHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<QueryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'ERROR'>('ALL');
  
  // Favorite state feedbacks
  const [favoritedIds, setFavoritedIds] = useState<number[]>([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const { data } = await api.get('/history');
      setHistory(data.history);
    } catch (error) {
      console.error('Failed to fetch history', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm('Are you sure you want to delete this history item?')) return;
    try {
      await api.delete(`/history/${id}`);
      setHistory(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('Failed to delete history item:', error);
    }
  };

  const handleClearAllHistory = async () => {
    if (!confirm('Are you sure you want to clear your entire query history? This action cannot be undone.')) return;
    try {
      await api.delete('/history');
      setHistory([]);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  const handleReplayQuery = (sqlText: string) => {
    localStorage.setItem('replay_sql', sqlText);
    navigate('/assistant');
  };

  const handleFavoriteQuery = async (record: QueryRecord) => {
    try {
      await api.post('/saved-query/save', {
        queryName: record.prompt.substring(0, 50) || 'Favorited Query',
        sql: record.generatedSql
      });
      setFavoritedIds(prev => [...prev, record.id]);
      alert('Query saved to saved queries successfully!');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save query');
    }
  };

  // Filter history records
  const filteredHistory = history.filter(record => {
    const matchesSearch = 
      record.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.generatedSql.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = 
      statusFilter === 'ALL' || 
      record.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <History className="w-6 h-6 text-primary" /> Query History
          </h1>
          <p className="text-slate-400 mt-1">Review, replay, and manage your past generated and executed queries</p>
        </div>

        {history.length > 0 && (
          <button
            onClick={handleClearAllHistory}
            className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-800 hover:border-danger/30 hover:bg-danger/10 hover:text-danger rounded-xl text-slate-350 transition-colors text-xs font-semibold self-end sm:self-center"
          >
            <Trash className="w-4 h-4" /> Clear All History
          </button>
        )}
      </div>

      {/* Search and Filters panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search prompt or SQL query..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-primary"
          />
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUCCESS">Success Only</option>
            <option value="ERROR">Error Only</option>
          </select>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center items-center p-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex flex-col justify-center items-center p-12 text-slate-500">
            <History className="w-12 h-12 mb-4 opacity-50 text-slate-600" />
            <p className="text-sm font-semibold">No query history found matching your filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {filteredHistory.map((record) => (
              <div key={record.id} className="p-5 hover:bg-slate-800/20 transition-colors">
                <div className="flex flex-col lg:flex-row gap-4 items-start">
                  
                  {/* Prompt and Meta info */}
                  <div className="flex-1 space-y-3 min-w-0">
                    <div className="flex items-start gap-2.5">
                      <Terminal className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <h3 className="font-semibold text-slate-200 text-sm leading-relaxed">{record.prompt || 'Manual Query Execution'}</h3>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${
                        record.status === 'SUCCESS' ? 'bg-success/10 text-success border border-success/20' : 
                        record.status === 'ERROR' ? 'bg-danger/10 text-danger border border-danger/20' : 
                        'bg-warning/10 text-warning border border-warning/20'
                      }`}>
                        {record.status === 'SUCCESS' ? <CheckCircle2 className="w-3.5 h-3.5" /> : 
                         record.status === 'ERROR' ? <XCircle className="w-3.5 h-3.5" /> : 
                         <Clock className="w-3.5 h-3.5 animate-spin" />}
                        {record.status}
                      </div>
                      
                      {record.executionTimeMs !== null && (
                        <div className="flex items-center gap-1.5 text-slate-450">
                          <Clock className="w-3.5 h-3.5" />
                          {record.executionTimeMs}ms
                        </div>
                      )}
                      
                      <div className="text-slate-500">
                        {new Date(record.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
 
                  {/* SQL Render Block */}
                  <div className="w-full lg:w-1/2 flex flex-col space-y-2">
                    <div className="bg-slate-950 rounded-xl p-3 border border-slate-800/60 relative group max-h-48 overflow-y-auto">
                      <div className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Code className="w-4 h-4 text-slate-650" />
                      </div>
                      <pre className="text-xs text-slate-350 font-mono overflow-x-auto whitespace-pre-wrap select-text leading-relaxed">
                        <code>{record.generatedSql}</code>
                      </pre>
                    </div>

                    {/* Operational controls */}
                    <div className="flex items-center justify-end gap-2 text-xs">
                      <button
                        onClick={() => handleReplayQuery(record.generatedSql)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 font-bold rounded-xl transition-colors"
                        title="Load in SQL Assistant"
                      >
                        <Play className="w-3 h-3 fill-current" /> Replay
                      </button>
                      <button
                        onClick={() => handleFavoriteQuery(record)}
                        disabled={favoritedIds.includes(record.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-bold transition-colors ${
                          favoritedIds.includes(record.id)
                            ? 'bg-success/10 text-success'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                        title="Save to Favorite Queries"
                      >
                        <Star className={`w-3.5 h-3.5 ${favoritedIds.includes(record.id) ? 'fill-current' : ''}`} /> 
                        {favoritedIds.includes(record.id) ? 'Saved' : 'Save SQL'}
                      </button>
                      <button
                        onClick={() => handleDeleteItem(record.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-danger/10 hover:text-danger hover:border hover:border-danger/20 rounded-xl text-slate-400 transition-colors"
                        title="Delete History Entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
