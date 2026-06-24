import { useState, useEffect } from 'react';
import { Database, Send, Play, Sparkles, Loader2, Info, AlertTriangle, Code, Terminal, CheckCircle2, Shield, Eye } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface DbConnection {
  id: number;
  name: string;
}

interface DryRunResult {
  rowsAffected: number | null;
  executionTimeMs: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasoning: string;
}

interface RiskDetails {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasoning: string;
  sql: string;
}

export default function SQLAssistant() {
  const { user } = useAuthStore();
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [selectedDb, setSelectedDb] = useState<number | ''>('');
  const [prompt, setPrompt] = useState('');
  
  const [generating, setGenerating] = useState(false);
  const [generatedSql, setGeneratedSql] = useState('');
  
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState('');
  
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [error, setError] = useState('');

  // Security Enhancements State
  const [safeMode, setSafeMode] = useState(true);
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [riskDetails, setRiskDetails] = useState<RiskDetails | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const { data } = await api.get('/database');
      setConnections(data.connections);
      if (data.connections.length > 0) {
        setSelectedDb(data.connections[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch connections', error);
    }
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim() || !selectedDb) return;

    setGenerating(true);
    setError('');
    setGeneratedSql('');
    setExplanation('');
    setResults(null);
    setExecutionTime(null);
    setDryRunResult(null);

    try {
      const { data } = await api.post('/ai/generate', {
        prompt,
        connectionId: selectedDb
      });
      setGeneratedSql(data.sql);
      handleExplain(data.sql);
      
      // If backend returned risk, display it in dryRunResult or error if critical
      if (data.risk) {
        setDryRunResult({
          rowsAffected: null,
          executionTimeMs: 0,
          riskLevel: data.risk.riskLevel,
          reasoning: data.risk.reasoning
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate SQL');
    } finally {
      setGenerating(false);
    }
  };

  const handleExplain = async (sqlToExplain: string) => {
    setExplaining(true);
    try {
      const { data } = await api.post('/ai/explain', { sql: sqlToExplain });
      setExplanation(data.explanation);
    } catch (err) {
      console.error('Failed to explain query', err);
    } finally {
      setExplaining(false);
    }
  };

  const handleExecute = async (confirmed = false, dryRun = false) => {
    if (!generatedSql.trim() || !selectedDb) return;

    const isReadOnly = (sqlText: string): boolean => {
      const clean = sqlText.trim().replace(/\/\*[\s\S]*?\*\//g, '').replace(/(--|#).*$/gm, '').trim().toLowerCase();
      if (!clean) return true;
      const firstWord = clean.split(/\s+/)[0];
      const allowed = ['select', 'show', 'describe', 'explain', 'use'];
      return allowed.includes(firstWord);
    };

    // 1. Strict USER role block (cannot run writes under any configuration)
    if (user?.role === 'USER' && !dryRun) {
      if (!isReadOnly(generatedSql)) {
        setError('Access Restricted: Users with Read-Only USER role are strictly prohibited from executing schema modification or write (INSERT, UPDATE, DELETE, ALTER, DROP, TRUNCATE) commands.');
        return;
      }
    }

    // 2. Frontend Safe Mode Check
    if (safeMode && !dryRun) {
      if (!isReadOnly(generatedSql)) {
        setError('Blocked by Safe Mode: DML and DDL commands (INSERT, UPDATE, DELETE, ALTER, DROP, TRUNCATE) are blocked. Toggle "Safe Mode" in the header to execute this query if you have the required access permissions.');
        return;
      }
    }

    setExecuting(true);
    setError('');

    if (!dryRun) {
      setResults(null);
      setExecutionTime(null);
      if (!confirmed) {
        setDryRunResult(null);
      }
    } else {
      setDryRunResult(null);
    }

    try {
      const { data } = await api.post('/ai/execute', {
        sql: generatedSql,
        connectionId: selectedDb,
        prompt,
        dryRun,
        confirmed
      });

      // Handle Risk Interception
      if (data.requiresConfirmation) {
        setRiskDetails({
          riskLevel: data.riskLevel,
          reasoning: data.reasoning,
          sql: data.sql
        });
        setShowConfirmationModal(true);
        setExecuting(false);
        return;
      }

      if (dryRun) {
        setDryRunResult({
          rowsAffected: data.rowsAffected,
          executionTimeMs: data.executionTimeMs,
          riskLevel: data.riskLevel,
          reasoning: data.reasoning
        });
        setResults(data.results);
      } else {
        setResults(data.results);
        setExecutionTime(data.executionTimeMs);
        setDryRunResult(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to execute query');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            SQL Assistant
          </h1>
          <p className="text-slate-400 mt-1">Generate, analyze, and execute queries with AI</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Safe Mode Switch Toggle */}
          <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-lg px-3 py-2">
            <span className={`w-2 h-2 rounded-full ${safeMode ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
            <label className="text-xs font-semibold text-slate-350 cursor-pointer select-none" htmlFor="safe-mode-toggle">
              Safe Mode (Read-Only)
            </label>
            <input
              type="checkbox"
              id="safe-mode-toggle"
              checked={safeMode}
              onChange={(e) => setSafeMode(e.target.checked)}
              className="ml-1 w-4 h-4 rounded border-slate-700 bg-slate-950 text-primary focus:ring-primary cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-500 hidden sm:block" />
            <select
              value={selectedDb}
              onChange={(e) => setSelectedDb(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none"
            >
              <option value="" disabled>Select target database</option>
              {connections.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-6">
        
        {/* Left Column: Input and Results */}
        <div className="flex-1 flex flex-col min-w-0 space-y-6">
          {/* Prompt Input */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shrink-0 shadow-sm relative">
            <form onSubmit={handleGenerate} className="flex flex-col">
              <label className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Ask a question about your data
              </label>
              <div className="relative flex items-end">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Find the top 5 customers with the highest total purchases last month"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-4 pr-16 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none min-h-[80px]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleGenerate();
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={generating || !prompt.trim() || !selectedDb}
                  className="absolute right-3 bottom-3 p-2 rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </form>
          </div>

          {/* Execution Results */}
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900 rounded-t-xl shrink-0">
              <div className="flex items-center gap-2 text-slate-200">
                <Terminal className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">Query Results</span>
              </div>
              {executionTime !== null && (
                <span className="text-xs text-slate-500 flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-md">
                  <CheckCircle2 className="w-3 h-3 text-success" />
                  Executed in {executionTime}ms
                </span>
              )}
            </div>

            {/* Dry Run Banner */}
            {dryRunResult !== null && (
              <div className="mx-4 mt-3 px-4 py-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm text-indigo-300 shadow-inner">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div>
                    <span className="font-semibold">Impact Assessment (Dry Run) Succeeded</span>
                    {dryRunResult.rowsAffected !== null && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        This statement would affect <span className="text-indigo-400 font-bold font-mono">{dryRunResult.rowsAffected.toLocaleString()}</span> rows in the database.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="text-xs bg-slate-950/80 px-2.5 py-1 rounded-md border border-indigo-500/20 font-semibold">
                    Risk Level: {dryRunResult.riskLevel}
                  </span>
                  {dryRunResult.executionTimeMs > 0 && (
                    <span className="text-xs bg-slate-950/80 px-2 py-1 rounded-md border border-indigo-500/20 font-mono">
                      {dryRunResult.executionTimeMs}ms
                    </span>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex-1 overflow-auto p-0 relative bg-slate-950 rounded-b-xl mt-1">
              {executing ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                  <p>Processing query...</p>
                </div>
              ) : results ? (
                Array.isArray(results) && results.length > 0 ? (
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="text-xs uppercase bg-slate-900/80 sticky top-0 backdrop-blur-md shadow-sm z-10 text-slate-400">
                      <tr>
                        {Object.keys(results[0]).map((key) => (
                          <th key={key} className="px-4 py-3 font-medium whitespace-nowrap">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-880/50">
                      {results.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-900/50 transition-colors">
                          {Object.values(row).map((val: any, j) => (
                            <td key={j} className="px-4 py-2.5 whitespace-nowrap max-w-[300px] truncate" title={String(val)}>
                              {val === null ? <span className="text-slate-600 italic">null</span> : String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                    {Array.isArray(results) ? 'Query returned 0 rows.' : 'Query executed successfully.'}
                  </div>
                )
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-600 italic text-sm">
                  Generated results will appear here
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: SQL Editor & Explanation */}
        <div className="w-full lg:w-[450px] flex flex-col shrink-0 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col flex-1 min-h-[300px]">
             <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900 rounded-t-xl shrink-0">
                <div className="flex items-center gap-2 text-slate-200">
                  <Code className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">Generated SQL</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExecute(false, true)}
                    disabled={!generatedSql.trim() || executing || generating}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-750 transition-all border border-slate-700/60 flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Dry Run
                  </button>
                  <button
                    onClick={() => handleExecute(false, false)}
                    disabled={!generatedSql.trim() || executing || generating}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-success hover:bg-success/90 transition-all flex items-center gap-1 shadow-sm"
                  >
                    {executing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Execute
                  </button>
                </div>
             </div>
             <div className="flex-1 overflow-hidden rounded-b-xl border-none">
                <CodeMirror
                  value={generatedSql}
                  height="100%"
                  extensions={[sql()]}
                  theme={vscodeDark}
                  onChange={(val) => setGeneratedSql(val)}
                  className="h-full text-sm [&_.cm-editor]:h-full [&_.cm-scroller]:custom-scrollbar"
                />
             </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shrink-0 shadow-sm relative min-h-[150px]">
             <div className="flex items-center gap-2 text-slate-200 mb-3 border-b border-slate-800 pb-2">
                <Info className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">AI Explanation & Risk</span>
             </div>
             
             {error ? (
                <div className="flex items-start gap-2 text-danger bg-danger/10 p-3 rounded-lg border border-danger/20 text-sm">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
             ) : explaining ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  Analyzing query details...
                </div>
             ) : explanation ? (
                <div className="space-y-4">
                  {dryRunResult?.reasoning && (
                    <div className={`flex items-start gap-2 p-3 rounded-lg border text-xs ${
                      dryRunResult.riskLevel === 'CRITICAL' || dryRunResult.riskLevel === 'HIGH'
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-450'
                        : dryRunResult.riskLevel === 'MEDIUM'
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-450'
                        : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450'
                    }`}>
                      <Shield className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold">Risk: {dryRunResult.riskLevel}</strong>
                        <p className="mt-0.5">{dryRunResult.reasoning}</p>
                      </div>
                    </div>
                  )}
                  <div className="text-slate-350 text-sm leading-relaxed prose prose-invert max-w-none">
                    {explanation}
                  </div>
                </div>
             ) : (
                <div className="text-slate-650 text-sm italic">
                  Run or generate a query to see details.
                </div>
             )}
          </div>
        </div>

      </div>

      {/* Dangerous Query Warning Modal */}
      {showConfirmationModal && riskDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl relative">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-100">High Risk Query Detected</h3>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/20 mt-1">
                  Risk Level: {riskDetails.riskLevel}
                </span>
                <p className="text-slate-450 text-sm mt-3 leading-relaxed">
                  {riskDetails.reasoning}
                </p>
              </div>
            </div>

            <div className="mt-4 bg-slate-950 p-3 rounded-lg border border-slate-850 font-mono text-xs text-slate-400 overflow-x-auto max-h-[120px] scrollbar-thin">
              <code>{riskDetails.sql}</code>
            </div>

            <div className="mt-6 space-y-4">
              {user?.role !== 'ADMIN' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-450 uppercase tracking-wider mb-2">
                    Type <span className="text-rose-400 font-mono font-bold">CONFIRM</span> to proceed
                  </label>
                  <input
                    type="text"
                    placeholder="CONFIRM"
                    value={confirmationInput}
                    onChange={(e) => setConfirmationInput(e.target.value)}
                    className="w-full bg-slate-955 border border-slate-850 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-700 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-mono uppercase tracking-wider text-center"
                  />
                </div>
              ) : (
                <div className="text-xs text-slate-450 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-850">
                  ⚠️ Administrators are authorized to override write safety warnings. Verify query safety before proceeding.
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowConfirmationModal(false);
                    setConfirmationInput('');
                    setRiskDetails(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-850 hover:bg-slate-750 text-slate-300 font-semibold rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={user?.role !== 'ADMIN' && confirmationInput !== 'CONFIRM'}
                  onClick={() => {
                    setShowConfirmationModal(false);
                    setConfirmationInput('');
                    handleExecute(true, false);
                  }}
                  className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-550 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Confirm & Execute
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
