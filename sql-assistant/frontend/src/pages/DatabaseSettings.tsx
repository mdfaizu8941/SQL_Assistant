import { useState, useEffect } from 'react';
import { Plus, Database, CheckCircle2, XCircle, Loader2, Server, Key, Lock, HardDrive } from 'lucide-react';
import api from '../services/api';

interface DbConnection {
  id: number;
  name: string;
  host: string;
  port: number;
  databaseName: string;
}

export default function DatabaseSettings() {
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(3306);
  const [dbUser, setDbUser] = useState('');
  const [dbPassword, setDbPassword] = useState('');
  const [databaseName, setDatabaseName] = useState('');

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const { data } = await api.get('/database');
      setConnections(data.connections);
    } catch (error) {
      console.error('Failed to fetch connections', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data } = await api.post('/database/test', {
        host, port, dbUser, dbPassword, databaseName
      });
      setTestResult({ success: true, message: data.message });
    } catch (error: any) {
      setTestResult({ success: false, message: error.response?.data?.error || 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/database/add', {
        name, host, port, dbUser, dbPassword, databaseName
      });
      
      // Reset form
      setName('');
      setHost('');
      setPort(3306);
      setDbUser('');
      setDbPassword('');
      setDatabaseName('');
      setTestResult(null);
      
      fetchConnections();
    } catch (error) {
      console.error('Failed to save connection', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Database Connections</h1>
        <p className="text-slate-400 mt-1">Manage your MySQL database connections for the SQL Assistant.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 space-y-4">
          {loading ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 flex justify-center items-center">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : connections.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
              <Database className="w-10 h-10 mx-auto text-slate-600 mb-3" />
              <p>No connections added yet.</p>
            </div>
          ) : (
            connections.map(conn => (
              <div key={conn.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 text-primary">
                  <Database className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-200 truncate">{conn.name}</h3>
                  <p className="text-sm text-slate-400 truncate">{conn.host}:{conn.port}</p>
                  <p className="text-xs text-slate-500 truncate mt-1">DB: {conn.databaseName}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="xl:col-span-2">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold text-slate-200">Add New Connection</h2>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1">Connection Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Production DB"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Host</label>
                  <div className="relative">
                    <Server className="w-5 h-5 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={host}
                      onChange={e => setHost(e.target.value)}
                      placeholder="localhost or ip"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-slate-100 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Port</label>
                  <input
                    type="number"
                    required
                    value={port}
                    onChange={e => setPort(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1">Database Name</label>
                  <div className="relative">
                    <HardDrive className="w-5 h-5 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={databaseName}
                      onChange={e => setDatabaseName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-slate-100 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
                  <div className="relative">
                    <Key className="w-5 h-5 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      required
                      value={dbUser}
                      onChange={e => setDbUser(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-slate-100 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="w-5 h-5 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="password"
                      value={dbPassword}
                      onChange={e => setDbPassword(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-slate-100 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {testResult && (
                <div className={`p-4 rounded-lg flex items-center gap-3 ${testResult.success ? 'bg-success/10 text-success border border-success/20' : 'bg-danger/10 text-danger border border-danger/20'}`}>
                  {testResult.success ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                  <span className="text-sm font-medium">{testResult.message}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing || !host || !dbUser || !databaseName}
                  className="px-4 py-2 rounded-lg font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Test Connection
                </button>
                <button
                  type="submit"
                  disabled={saving || !host || !dbUser || !databaseName || !name}
                  className="px-6 py-2 rounded-lg font-medium text-white bg-primary hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save Connection
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
