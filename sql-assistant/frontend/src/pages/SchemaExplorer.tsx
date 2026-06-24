import { useState, useEffect } from 'react';
import { Database, Table, Columns, Loader2, ChevronRight, ChevronDown } from 'lucide-react';
import api from '../services/api';

interface DbConnection {
  id: number;
  name: string;
}

interface Column {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  IS_NULLABLE: string;
  COLUMN_KEY: string;
}

interface Schema {
  [tableName: string]: Column[];
}

export default function SchemaExplorer() {
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [selectedDb, setSelectedDb] = useState<number | ''>('');
  const [schema, setSchema] = useState<Schema | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchConnections();
  }, []);

  useEffect(() => {
    if (selectedDb !== '') {
      fetchSchema(selectedDb);
    } else {
      setSchema(null);
    }
  }, [selectedDb]);

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

  const fetchSchema = async (dbId: number) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/database/${dbId}/schema`);
      setSchema(data.schema);
      
      // Auto expand first table
      const firstTable = Object.keys(data.schema)[0];
      if (firstTable) {
        setExpandedTables({ [firstTable]: true });
      } else {
        setExpandedTables({});
      }
    } catch (error) {
      console.error('Failed to fetch schema', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTable = (tableName: string) => {
    setExpandedTables(prev => ({
      ...prev,
      [tableName]: !prev[tableName]
    }));
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Schema Explorer</h1>
          <p className="text-slate-400 mt-1">Visualize your database structure</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-slate-400 hidden sm:block" />
          <select
            value={selectedDb}
            onChange={(e) => setSelectedDb(Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg focus:ring-primary focus:border-primary block w-full p-2.5 outline-none"
          >
            <option value="" disabled>Select a database</option>
            {connections.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p>Analyzing schema...</p>
          </div>
        ) : !schema ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <Database className="w-12 h-12 mb-4 opacity-50" />
            <p>Select a database to view its schema.</p>
          </div>
        ) : Object.keys(schema).length === 0 ? (
           <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <p>No tables found in this database.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Object.entries(schema).map(([tableName, columns]) => (
                <div key={tableName} className="bg-slate-950 rounded-xl border border-slate-800 shadow-sm overflow-hidden flex flex-col">
                  <button
                    onClick={() => toggleTable(tableName)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-slate-900 hover:bg-slate-800 transition-colors border-b border-slate-800"
                  >
                    <div className="flex items-center gap-2">
                      <Table className="w-4 h-4 text-primary" />
                      <span className="font-semibold text-slate-200">{tableName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <span>{columns.length} cols</span>
                      {expandedTables[tableName] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </button>
                  
                  {expandedTables[tableName] && (
                    <div className="p-0 max-h-64 overflow-y-auto custom-scrollbar">
                      <table className="w-full text-left text-sm text-slate-400">
                        <thead className="text-xs uppercase bg-slate-900/50 sticky top-0 backdrop-blur-md">
                          <tr>
                            <th className="px-4 py-2 font-medium text-slate-500">Column</th>
                            <th className="px-4 py-2 font-medium text-slate-500">Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {columns.map(col => (
                            <tr key={col.COLUMN_NAME} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-900/50">
                              <td className="px-4 py-2.5 flex items-center gap-2">
                                {col.COLUMN_KEY === 'PRI' ? (
                                  <span className="w-2 h-2 rounded-full bg-warning" title="Primary Key"></span>
                                ) : (
                                  <Columns className="w-3 h-3 text-slate-600" />
                                )}
                                <span className={col.COLUMN_KEY === 'PRI' ? 'font-medium text-slate-200' : 'text-slate-300'}>
                                  {col.COLUMN_NAME}
                                </span>
                              </td>
                              <td className="px-4 py-2.5">
                                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono">
                                  {col.DATA_TYPE}
                                </span>
                                {col.IS_NULLABLE === 'YES' && (
                                  <span className="ml-2 text-[10px] text-slate-500 uppercase">null</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
