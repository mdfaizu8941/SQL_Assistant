import { useState, useEffect } from 'react';
import { Database, Table, Columns, Loader2, ChevronRight, ChevronDown, Trash2, Edit2, DownloadCloud } from 'lucide-react';
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

interface Index {
  INDEX_NAME: string;
  COLUMN_NAME: string;
  NON_UNIQUE: number;
}

interface TableDetails {
  columns: Column[];
  indexes: Index[];
}

interface Schema {
  [tableName: string]: TableDetails;
}

export default function SchemaExplorer() {
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [selectedDb, setSelectedDb] = useState<number | ''>('');
  const [schema, setSchema] = useState<Schema | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedTables, setExpandedTables] = useState<Record<string, boolean>>({});

  // Column Add inputs mapping
  const [newColNames, setNewColNames] = useState<Record<string, string>>({});
  const [newColTypes, setNewColTypes] = useState<Record<string, string>>({});

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

  // Alteration Actions
  const handleRenameTable = async (oldName: string) => {
    const newName = prompt(`Enter new table name for "${oldName}":`, oldName);
    if (!newName || newName === oldName) return;
    try {
      await api.post(`/database/${selectedDb}/table/${oldName}/rename`, { newTableName: newName });
      fetchSchema(Number(selectedDb));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to rename table');
    }
  };

  const handleDeleteTable = async (tableName: string) => {
    if (!confirm(`Are you sure you want to drop/delete table "${tableName}"? This action is permanent and cannot be undone.`)) return;
    try {
      await api.delete(`/database/${selectedDb}/table/${tableName}`);
      fetchSchema(Number(selectedDb));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete table');
    }
  };

  const handleRenameColumn = async (tableName: string, oldColName: string, type: string) => {
    const newColName = prompt(`Enter new column name for "${oldColName}":`, oldColName);
    if (!newColName || newColName === oldColName) return;
    try {
      await api.post(`/database/${selectedDb}/table/${tableName}/column/${oldColName}/rename`, {
        newColumnName: newColName,
        dataType: type
      });
      fetchSchema(Number(selectedDb));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to rename column');
    }
  };

  const handleDeleteColumn = async (tableName: string, colName: string) => {
    if (!confirm(`Are you sure you want to delete column "${colName}" from table "${tableName}"?`)) return;
    try {
      await api.delete(`/database/${selectedDb}/table/${tableName}/column/${colName}`);
      fetchSchema(Number(selectedDb));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete column');
    }
  };

  const handleAddColumn = async (tableName: string) => {
    const colName = newColNames[tableName]?.trim();
    const colType = newColTypes[tableName] || 'VARCHAR(255)';
    if (!colName) return;
    try {
      await api.post(`/database/${selectedDb}/table/${tableName}/column/add`, {
        columnName: colName,
        dataType: colType,
        isNullable: true
      });
      setNewColNames(prev => ({ ...prev, [tableName]: '' }));
      fetchSchema(Number(selectedDb));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to add column');
    }
  };

  // Schema Export SQL download trigger
  const handleExportSchema = async () => {
    if (selectedDb === '') return;
    try {
      const response = await api.get(`/database/${selectedDb}/schema/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const connName = connections.find(c => c.id === Number(selectedDb))?.name || 'db';
      link.setAttribute('download', `schema_export_${connName.toLowerCase().replace(/\s+/g, '_')}.sql`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export schema:', err);
    }
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Schema Explorer</h1>
          <p className="text-slate-400 mt-1">Visualize, alter, and manage database structural metadata</p>
        </div>
        
        <div className="flex items-center gap-3">
          {selectedDb && (
            <button
              onClick={handleExportSchema}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 hover:text-slate-100 hover:bg-slate-800/80 transition-colors"
              title="Download Schema SQL Script"
            >
              <DownloadCloud className="w-4 h-4 text-primary" /> Export Schema
            </button>
          )}

          <div className="relative">
            <select
              value={selectedDb}
              onChange={(e) => setSelectedDb(Number(e.target.value))}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-sm rounded-xl focus:ring-primary focus:border-primary block p-2.5 outline-none font-medium cursor-pointer"
            >
              <option value="" disabled>Select a database</option>
              {connections.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-sm">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p>Analyzing schema details & index metadata...</p>
          </div>
        ) : !schema ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <Database className="w-12 h-12 mb-4 opacity-50 text-slate-700" />
            <p>Select a database to browse structure and run adjustments.</p>
          </div>
        ) : Object.keys(schema).length === 0 ? (
           <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <p>No tables found in this workspace database.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {Object.entries(schema).map(([tableName, details]) => {
                const columns = details.columns || [];
                const indexes = details.indexes || [];
                return (
                  <div key={tableName} className="bg-slate-950 rounded-xl border border-slate-800 shadow-sm overflow-hidden flex flex-col">
                    
                    {/* Table Card Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
                      <button
                        onClick={() => toggleTable(tableName)}
                        className="flex items-center gap-2 text-left flex-1 min-w-0"
                      >
                        <Table className="w-4 h-4 text-primary shrink-0" />
                        <span className="font-semibold text-slate-200 truncate">{tableName}</span>
                        {expandedTables[tableName] ? <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />}
                      </button>
                      
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-500 font-mono">{columns.length} cols</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleRenameTable(tableName)}
                            className="p-1 text-slate-500 hover:text-slate-200"
                            title="Rename Table"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTable(tableName)}
                            className="p-1 text-slate-505 hover:text-danger"
                            title="Delete Table"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {expandedTables[tableName] && (
                      <div className="flex-1 flex flex-col min-h-0 divide-y divide-slate-800">
                        {/* Columns List Table */}
                        <div className="p-0 max-h-60 overflow-y-auto custom-scrollbar">
                          <table className="w-full text-left text-xs text-slate-400">
                            <thead className="bg-slate-900 sticky top-0 font-bold uppercase text-[9px] text-slate-500 tracking-wider">
                              <tr>
                                <th className="px-4 py-2 font-medium">Column</th>
                                <th className="px-4 py-2 font-medium">Type</th>
                                <th className="px-4 py-2 font-medium text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900/60">
                              {columns.map(col => (
                                <tr key={col.COLUMN_NAME} className="hover:bg-slate-900/40">
                                  <td className="px-4 py-2 flex items-center gap-1.5">
                                    {col.COLUMN_KEY === 'PRI' ? (
                                      <span className="w-2 h-2 rounded-full bg-warning shrink-0" title="Primary Key"></span>
                                    ) : (
                                      <Columns className="w-3 h-3 text-slate-600 shrink-0" />
                                    )}
                                    <span className={`font-mono truncate max-w-[120px] ${col.COLUMN_KEY === 'PRI' ? 'font-bold text-slate-200' : 'text-slate-300'}`} title={col.COLUMN_NAME}>
                                      {col.COLUMN_NAME}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 font-mono text-[10px] text-slate-400">
                                    {col.DATA_TYPE} {col.IS_NULLABLE === 'YES' && 'NULL'}
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    <div className="inline-flex gap-1.5">
                                      <button
                                        onClick={() => handleRenameColumn(tableName, col.COLUMN_NAME, col.DATA_TYPE)}
                                        className="p-0.5 text-slate-500 hover:text-slate-200"
                                        title="Rename Column"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteColumn(tableName, col.COLUMN_NAME)}
                                        className="p-0.5 text-slate-505 hover:text-danger"
                                        title="Delete Column"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Indexes List */}
                        {indexes && indexes.length > 0 && (
                          <div className="p-3 bg-slate-950">
                            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Indexes</h4>
                            <div className="space-y-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                              {indexes.map((idx, iIndex) => (
                                <div key={iIndex} className="flex justify-between items-center bg-slate-900 border border-slate-850 px-2 py-1 rounded text-[10px] font-mono text-slate-400">
                                  <span className="truncate max-w-[140px] text-slate-300 font-medium" title={idx.INDEX_NAME}>{idx.INDEX_NAME}</span>
                                  <span className="text-slate-500">on ({idx.COLUMN_NAME}) {idx.NON_UNIQUE === 0 ? 'UNIQUE' : ''}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Add Column Inline Form */}
                        <div className="p-3 bg-slate-900/30 flex gap-2">
                          <input
                            type="text"
                            placeholder="new_col"
                            value={newColNames[tableName] || ''}
                            onChange={e => setNewColNames(prev => ({ ...prev, [tableName]: e.target.value }))}
                            className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 outline-none flex-1 max-w-[100px]"
                          />
                          <select
                            value={newColTypes[tableName] || 'VARCHAR(255)'}
                            onChange={e => setNewColTypes(prev => ({ ...prev, [tableName]: e.target.value }))}
                            className="bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-[10px] text-slate-350 outline-none cursor-pointer"
                          >
                            <option value="INT">INT</option>
                            <option value="DOUBLE">DOUBLE</option>
                            <option value="VARCHAR(255)">VARCHAR</option>
                            <option value="TEXT">TEXT</option>
                            <option value="DATE">DATE</option>
                            <option value="DATETIME">DATETIME</option>
                          </select>
                          <button
                            onClick={() => handleAddColumn(tableName)}
                            disabled={!newColNames[tableName]?.trim()}
                            className="px-2.5 py-1 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded disabled:opacity-50"
                          >
                            Add Col
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
