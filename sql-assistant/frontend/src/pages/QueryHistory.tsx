import { useState, useEffect } from 'react';
import { History, Loader2, Code, Terminal, Clock, CheckCircle2, XCircle } from 'lucide-react';
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
  const [history, setHistory] = useState<QueryRecord[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Query History</h1>
        <p className="text-slate-400 mt-1">Review your past generated and executed queries</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center p-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col justify-center items-center p-12 text-slate-500">
            <History className="w-12 h-12 mb-4 opacity-50" />
            <p>No query history found.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/50">
            {history.map((record) => (
              <div key={record.id} className="p-6 hover:bg-slate-800/20 transition-colors">
                <div className="flex flex-col lg:flex-row gap-6">
                  
                  {/* Prompt and Meta */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-primary" />
                      <h3 className="font-medium text-slate-200">{record.prompt}</h3>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-medium">
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${
                        record.status === 'SUCCESS' ? 'bg-success/10 text-success' : 
                        record.status === 'ERROR' ? 'bg-danger/10 text-danger' : 
                        'bg-warning/10 text-warning'
                      }`}>
                        {record.status === 'SUCCESS' ? <CheckCircle2 className="w-3.5 h-3.5" /> : 
                         record.status === 'ERROR' ? <XCircle className="w-3.5 h-3.5" /> : 
                         <Clock className="w-3.5 h-3.5" />}
                        {record.status}
                      </div>
                      
                      {record.executionTimeMs !== null && (
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Clock className="w-3.5 h-3.5" />
                          {record.executionTimeMs}ms
                        </div>
                      )}
                      
                      <div className="text-slate-500">
                        {new Date(record.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* SQL */}
                  <div className="flex-1 bg-slate-950 rounded-lg p-3 border border-slate-800/50 relative group">
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Code className="w-4 h-4 text-slate-500" />
                    </div>
                    <pre className="text-sm text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap custom-scrollbar">
                      {record.generatedSql}
                    </pre>
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
