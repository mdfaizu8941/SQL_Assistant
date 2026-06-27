import { useState, useEffect, useRef } from 'react';
import {
  Send,
  Play,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,

  Save,
  UploadCloud,
  Plus,
  Search,
  Pin,
  Edit2,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  MessageSquare,
  X
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import api from '../services/api';

interface DbConnection {
  id: number;
  name: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  explanation?: string;
  optimization?: string;
  followUps?: string[];
  results?: any[] | null;
  executionTimeMs?: number | null;
  error?: string | null;
  isExecuting?: boolean;
  isEditingSql?: boolean;
  chartType?: 'none' | 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'histogram';
  xAxisCol?: string;
  yAxisCol?: string;
}

interface ChatSession {
  id: number;
  title: string;
  isPinned: boolean;
  prompt: string;
  generatedSql: string;
  messages: string | null;
  executionResult: string | null;
  databaseUsed: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RiskDetails {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasoning: string;
  sql: string;
}

export default function SQLAssistant() {
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [selectedDb, setSelectedDb] = useState<number | ''>('');
  const [prompt, setPrompt] = useState('');
  
  // Chatting State
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [generating, setGenerating] = useState(false);
  const [editingChatId, setEditingChatId] = useState<number | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState('');
  
  // Prompt Edit & Resend States
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingMsgText, setEditingMsgText] = useState('');

  // Security & Confirmations
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [riskDetails, setRiskDetails] = useState<RiskDetails | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [confirmCallback, setConfirmCallback] = useState<(() => void) | null>(null);

  // Save Query Modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveQueryName, setSaveQueryName] = useState('');
  const [saveQuerySql, setSaveQuerySql] = useState('');
  const [savingQueryStatus, setSavingQueryStatus] = useState(false);

  // Upload Dataset Modal (2-Step Wizard)
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadStep, setUploadStep] = useState<1 | 2>(1); // 1 = upload/analyze, 2 = configure schema
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [importTableName, setImportTableName] = useState('');
  const [importConnectionId, setImportConnectionId] = useState<number | ''>('');
  const [importingFile, setImportingFile] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [analyzedColumns, setAnalyzedColumns] = useState<{ logical: string; raw: string; type: string }[]>([]);
  const [analyzedRows, setAnalyzedRows] = useState<any[]>([]);
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileSize, setUploadFileSize] = useState(0);

  // AI Schema Generator Modal
  const [showAiSchemaModal, setShowAiSchemaModal] = useState(false);
  const [aiSchemaPrompt, setAiSchemaPrompt] = useState('');
  const [aiSchemaLoading, setAiSchemaLoading] = useState(false);
  const [aiSchemaResult, setAiSchemaResult] = useState<{
    explanation: string;
    sql: string;
    proposedTables: { name: string; columns: { name: string; type: string; details: string }[] }[];
  } | null>(null);
  const [executingAiSchema, setExecutingAiSchema] = useState(false);
  const [aiSchemaError, setAiSchemaError] = useState('');
  const [aiSchemaSuccess, setAiSchemaSuccess] = useState('');
  const [aiSchemaConnectionId, setAiSchemaConnectionId] = useState<number | ''>('');

  // Copy Feedback UI States
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (promptRef.current) {
      promptRef.current.style.height = 'auto';
      promptRef.current.style.height = `${promptRef.current.scrollHeight}px`;
    }
  }, [prompt]);

  useEffect(() => {
    fetchConnections();
    fetchChatHistory();
    
    // Check for replayed SQL from Query History page
    const replaySql = localStorage.getItem('replay_sql');
    if (replaySql) {
      localStorage.removeItem('replay_sql');
      const userMsgId = Math.random().toString(36).substring(7);
      const assistantMsgId = Math.random().toString(36).substring(7);
      setMessages([
        { id: userMsgId, role: 'user', content: 'Replay SQL query' },
        {
          id: assistantMsgId,
          role: 'assistant',
          content: 'I loaded your replayed query in the editor below. You can run it directly.',
          sql: replaySql,
          chartType: 'none',
          xAxisCol: '',
          yAxisCol: ''
        }
      ]);
    }
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, generating]);

  const fetchConnections = async () => {
    try {
      const { data } = await api.get('/database');
      setConnections(data.connections);
      if (data.connections.length > 0) {
        setSelectedDb(data.connections[0].id);
        setImportConnectionId(data.connections[0].id);
        setAiSchemaConnectionId(data.connections[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch connections', error);
    }
  };

  const fetchChatHistory = async (search = '') => {
    try {
      const { data } = await api.get(`/ai-chat?search=${encodeURIComponent(search)}`);
      setChatHistory(data.chats);
    } catch (error) {
      console.error('Failed to fetch chat history', error);
    }
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    fetchChatHistory(val);
  };

  const handleNewChat = async () => {
    try {
      const { data } = await api.post('/ai-chat/create');
      const newChat: ChatSession = data.chat;
      setActiveChatId(newChat.id);
      setMessages([]);
      fetchChatHistory(searchQuery);
    } catch (error) {
      console.error('Failed to create new chat:', error);
    }
  };

  const selectChat = async (chat: ChatSession) => {
    try {
      setActiveChatId(chat.id);
      if (chat.databaseUsed) {
        setSelectedDb(Number(chat.databaseUsed));
      }
      if (chat.messages) {
        setMessages(JSON.parse(chat.messages));
      } else {
        const msgs: ChatMessage[] = [];
        if (chat.prompt) {
          msgs.push({ id: '1-old', role: 'user', content: chat.prompt });
        }
        if (chat.generatedSql) {
          let resultsObj = null;
          if (chat.executionResult) {
            try { resultsObj = JSON.parse(chat.executionResult); } catch (e) {}
          }
          msgs.push({
            id: '2-old',
            role: 'assistant',
            content: 'I generated this query previously.',
            sql: chat.generatedSql,
            results: resultsObj,
            chartType: 'none'
          });
        }
        setMessages(msgs);
      }
    } catch (e) {
      console.error('Failed to select chat:', e);
      setMessages([]);
    }
  };

  const handleRenameSubmit = async (id: number) => {
    if (!editingChatTitle.trim()) return;
    try {
      await api.put(`/ai-chat/${id}/rename`, { title: editingChatTitle.trim() });
      setEditingChatId(null);
      setEditingChatTitle('');
      fetchChatHistory(searchQuery);
    } catch (error) {
      console.error('Failed to rename chat:', error);
    }
  };

  const handlePinToggle = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.post(`/ai-chat/${id}/pin`);
      fetchChatHistory(searchQuery);
    } catch (error) {
      console.error('Failed to pin/unpin chat:', error);
    }
  };

  const handleDeleteChat = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this chat session?')) return;
    try {
      await api.delete(`/ai-chat/${id}`);
      if (activeChatId === id) {
        setActiveChatId(null);
        setMessages([]);
      }
      fetchChatHistory(searchQuery);
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  // Main chat prompt submission
  const handleSubmitPrompt = async (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const targetPrompt = customPrompt || prompt;
    if (!targetPrompt.trim() || !selectedDb) return;

    let currentChatId = activeChatId;
    let updatedMessages = [...messages];

    // 1. Create a session if none is active
    if (!currentChatId) {
      try {
        const { data } = await api.post('/ai-chat/create');
        currentChatId = data.chat.id;
        setActiveChatId(currentChatId);
      } catch (err) {
        console.error('Failed to initialize session:', err);
        return;
      }
    }

    // 2. Add User message
    const userMsgId = Math.random().toString(36).substring(7);
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: targetPrompt.trim()
    };
    updatedMessages = [...updatedMessages, userMsg];
    setMessages(updatedMessages);
    setPrompt(''); // Clear input
    setGenerating(true);

    // 3. Create dummy assistant message for typing indicator
    const assistantMsgId = Math.random().toString(36).substring(7);
    const dummyAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: ''
    };
    setMessages(prev => [...prev, dummyAssistantMsg]);

    try {
      // Send chat log payload to enable memory context on backend
      const { data } = await api.post('/ai/generate', {
        prompt: targetPrompt.trim(),
        connectionId: selectedDb,
        history: updatedMessages.slice(0, -1) // Excludes userMsg
      });

      // Update assistant message with response details
      const responseMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: data.message,
        sql: data.sql,
        explanation: data.explanation,
        optimization: data.optimization,
        followUps: data.followUps,
        chartType: 'none',
        xAxisCol: '',
        yAxisCol: ''
      };

      updatedMessages = [...updatedMessages, responseMsg];
      setMessages(updatedMessages);

      // Save updated messages JSON in DB
      await api.post('/ai-chat/save', {
        chatId: currentChatId,
        messages: updatedMessages,
        prompt: targetPrompt.trim(),
        generatedSql: data.sql,
        databaseUsed: String(selectedDb)
      });

      fetchChatHistory(searchQuery);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: 'Error: Failed to generate SQL from AI.',
        error: err.response?.data?.error || 'Unable to connect to AI translator.'
      };
      setMessages(prev => prev.map(m => m.id === assistantMsgId ? errorMsg : m));
    } finally {
      setGenerating(false);
    }
  };

  // Re-generate response
  const handleRegenerate = async (msgIndex: number) => {
    if (msgIndex <= 0 || !selectedDb) return;
    const userPrompt = messages[msgIndex - 1].content;
    const previousHistory = messages.slice(0, msgIndex - 1);
    
    setGenerating(true);
    const sliced = messages.slice(0, msgIndex);
    const assistantMsgId = messages[msgIndex].id;
    setMessages(prev => prev.slice(0, msgIndex).concat([{ id: assistantMsgId, role: 'assistant', content: '' }]));

    try {
      const { data } = await api.post('/ai/generate', {
        prompt: userPrompt,
        connectionId: selectedDb,
        history: previousHistory
      });

      const responseMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: data.message,
        sql: data.sql,
        explanation: data.explanation,
        optimization: data.optimization,
        followUps: data.followUps,
        chartType: 'none',
        xAxisCol: '',
        yAxisCol: ''
      };

      const updated = sliced.concat([responseMsg]);
      setMessages(updated);

      if (activeChatId) {
        await api.post('/ai-chat/save', {
          chatId: activeChatId,
          messages: updated,
          prompt: userPrompt,
          generatedSql: data.sql,
          databaseUsed: String(selectedDb)
        });
      }
      fetchChatHistory(searchQuery);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: 'Error: Failed to regenerate response.',
        error: err.response?.data?.error || 'Unable to connect to AI.'
      };
      setMessages(prev => prev.map(m => m.id === assistantMsgId ? errorMsg : m));
    } finally {
      setGenerating(false);
    }
  };

  // Inline SQL Execution inside message bubble
  const handleExecuteBubble = async (messageId: string, customSql?: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg || !selectedDb) return;
    const targetSql = customSql || msg.sql;
    if (!targetSql) return;



    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isExecuting: true, error: null, results: null } : m));

    const executeCall = async () => {
      try {
        const { data } = await api.post('/ai/execute', {
          sql: targetSql,
          connectionId: selectedDb,
          prompt: msg.content,
          dryRun: false,
          confirmed: true
        });

        if (data.requiresConfirmation) {
          setRiskDetails({
            riskLevel: data.riskLevel,
            reasoning: data.reasoning,
            sql: data.sql
          });
          setConfirmCallback(() => () => handleExecuteBubble(messageId, targetSql));
          setShowConfirmationModal(true);
          setMessages(prev => prev.map(m => m.id === messageId ? { ...m, isExecuting: false } : m));
          return;
        }

        let xCol = '';
        let yCol = '';
        if (data.results && data.results.length > 0) {
          const cols = Object.keys(data.results[0]);
          if (cols.length > 1) {
            xCol = cols[0];
            yCol = cols[1];
          }
        }

        setMessages(prev => {
          const updated = prev.map(m => m.id === messageId ? {
            ...m,
            isExecuting: false,
            results: data.results,
            executionTimeMs: data.executionTimeMs,
            xAxisCol: xCol,
            yAxisCol: yCol,
            chartType: xCol && yCol ? 'bar' as const : 'none' as const
          } : m);

          if (activeChatId) {
            api.post('/ai-chat/save', {
              chatId: activeChatId,
              messages: updated,
              prompt: msg.content,
              generatedSql: targetSql,
              databaseUsed: String(selectedDb)
            }).catch(e => console.error(e));
          }
          return updated;
        });

      } catch (err: any) {
        setMessages(prev => prev.map(m => m.id === messageId ? {
          ...m,
          isExecuting: false,
          error: err.response?.data?.error || 'Execution failed.'
        } : m));
      }
    };

    executeCall();
  };

  const handleExport = async (format: 'csv' | 'xlsx' | 'json', dataRows: any[]) => {
    if (!dataRows || dataRows.length === 0) return;
    try {
      const response = await api.post('/dataset/export', { format, results: dataRows }, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `query_export.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Failed to export', err);
    }
  };

  const handleSaveQuerySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveQueryName.trim() || !saveQuerySql.trim()) return;

    setSavingQueryStatus(true);
    try {
      await api.post('/saved-query/save', {
        queryName: saveQueryName.trim(),
        sql: saveQuerySql
      });
      setShowSaveModal(false);
      setSaveQueryName('');
      setSaveQuerySql('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save query');
    } finally {
      setSavingQueryStatus(false);
    }
  };

  // Step 1: Analyze dataset file structure
  const handleAnalyzeFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !importConnectionId) return;

    setImportingFile(true);
    setImportError('');
    setImportSuccess('');

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const { data } = await api.post('/dataset/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAnalyzedColumns(data.columns);
      setAnalyzedRows(data.rows);
      setImportTableName(data.suggestedTableName);
      setUploadFileName(data.fileName);
      setUploadFileSize(data.fileSize);
      setUploadStep(2);
    } catch (err: any) {
      setImportError(err.response?.data?.error || 'Failed to analyze dataset structure.');
    } finally {
      setImportingFile(false);
    }
  };

  // Step 2: Configure logical schema mapping and complete import
  const handleCompleteImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importTableName.trim() || !importConnectionId || analyzedColumns.length === 0) return;

    setImportingFile(true);
    setImportError('');
    setImportSuccess('');

    try {
      const { data } = await api.post('/dataset/import', {
        tableName: importTableName.trim(),
        connectionId: String(importConnectionId),
        columns: analyzedColumns,
        rows: analyzedRows,
        fileName: uploadFileName,
        fileSize: uploadFileSize
      });

      setImportSuccess(data.message);
      setUploadFile(null);
      
      setTimeout(() => {
        setSelectedDb(Number(importConnectionId));
        setShowUploadModal(false);
        setUploadStep(1);
        setImportSuccess('');
        setPrompt(`Describe the newly imported table: ${importTableName}`);
      }, 1500);
    } catch (err: any) {
      setImportError(err.response?.data?.error || 'Failed to complete dataset import.');
    } finally {
      setImportingFile(false);
    }
  };

  // AI Schema Generation Submit
  const handleGenerateSchema = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiSchemaPrompt.trim()) return;

    setAiSchemaLoading(true);
    setAiSchemaError('');
    setAiSchemaSuccess('');

    try {
      const { data } = await api.post('/ai/generate-schema', {
        prompt: aiSchemaPrompt.trim()
      });
      setAiSchemaResult(data);
    } catch (err: any) {
      setAiSchemaError(err.response?.data?.error || 'Failed to generate schema design.');
    } finally {
      setAiSchemaLoading(false);
    }
  };

  // Execute Generated Schema
  const handleExecuteSchema = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiSchemaResult?.sql || !aiSchemaConnectionId) return;

    setExecutingAiSchema(true);
    setAiSchemaError('');
    setAiSchemaSuccess('');

    try {
      const { data } = await api.post('/ai/execute-schema', {
        sql: aiSchemaResult.sql,
        connectionId: aiSchemaConnectionId
      });
      setAiSchemaSuccess(data.message);
      
      setTimeout(() => {
        setShowAiSchemaModal(false);
        setAiSchemaPrompt('');
        setAiSchemaResult(null);
        setAiSchemaSuccess('');
        setPrompt('Show all tables');
      }, 2000);
    } catch (err: any) {
      setAiSchemaError(err.response?.data?.error || 'Failed to execute schema DDL.');
    } finally {
      setExecutingAiSchema(false);
    }
  };

  const copyToClipboard = (text: string, elementId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(elementId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getPinnedChats = () => chatHistory.filter(c => c.isPinned);
  const getRecentChats = () => chatHistory.filter(c => !c.isPinned);

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col space-y-4">
      {/* Upper header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 bg-slate-900/60 p-4 border border-slate-800 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5.5 h-5.5 text-primary animate-pulse" /> Query Generator
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Generate, explain and execute SQL queries using AI.</p>
        </div>

        <div className="flex items-center">
          <button
            onClick={() => {
              setUploadStep(1);
              setShowUploadModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <UploadCloud className="w-4 h-4" /> Import Dataset
          </button>
        </div>
      </div>

      {/* Workspace split */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Left Sidebar */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-full shadow-sm">
          {/* New Chat & Search */}
          <div className="p-3 border-b border-slate-800 space-y-2">
            <button
              onClick={handleNewChat}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <Plus className="w-4 h-4" /> New Chat
            </button>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                className="w-full bg-slate-955 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Chats scroll list */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
            {chatHistory.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-8 h-8 text-slate-700 mx-auto mb-2 opacity-40" />
                <p className="text-xs text-slate-500 italic">No chat sessions found.</p>
              </div>
            ) : (
              <>
                {/* Pinned section */}
                {getPinnedChats().length > 0 && (
                  <div>
                    <div className="px-2 pb-1 text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      <Pin className="w-2.5 h-2.5 fill-current animate-pulse text-indigo-400" /> Pinned
                    </div>
                    <div className="space-y-1">
                      {getPinnedChats().map(chat => (
                        <div
                          key={chat.id}
                          onClick={() => selectChat(chat)}
                          className={`group flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all border ${
                            activeChatId === chat.id
                              ? 'bg-slate-950 border-primary/40 text-slate-100'
                              : 'bg-slate-950/40 border-slate-850 hover:bg-slate-950/70 text-slate-355'
                          }`}
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            {editingChatId === chat.id ? (
                              <input
                                type="text"
                                value={editingChatTitle}
                                onChange={e => setEditingChatTitle(e.target.value)}
                                onBlur={() => handleRenameSubmit(chat.id)}
                                onKeyDown={e => e.key === 'Enter' && handleRenameSubmit(chat.id)}
                                autoFocus
                                className="w-full bg-slate-900 text-slate-200 text-xs px-1 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                            ) : (
                              <p className="text-xs font-medium truncate">{chat.title || 'New Chat'}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => handlePinToggle(chat.id, e)}
                              className="p-1 text-slate-500 hover:text-slate-200"
                              title="Unpin Chat"
                            >
                              <Pin className="w-3 h-3 fill-current text-primary" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingChatId(chat.id);
                                setEditingChatTitle(chat.title);
                              }}
                              className="p-1 text-slate-500 hover:text-slate-200"
                              title="Rename Chat"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteChat(chat.id, e)}
                              className="p-1 text-slate-550 hover:text-danger"
                              title="Delete Chat"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent section */}
                <div>
                  {getPinnedChats().length > 0 && (
                    <div className="px-2 pt-2 pb-1 text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                      Recent Chats
                    </div>
                  )}
                  <div className="space-y-1">
                    {getRecentChats().map(chat => (
                      <div
                        key={chat.id}
                        onClick={() => selectChat(chat)}
                        className={`group flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all border ${
                          activeChatId === chat.id
                            ? 'bg-slate-950 border-primary/40 text-slate-100'
                            : 'bg-slate-950/45 border-slate-850 hover:bg-slate-950/70 text-slate-355'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          {editingChatId === chat.id ? (
                            <input
                              type="text"
                              value={editingChatTitle}
                              onChange={e => setEditingChatTitle(e.target.value)}
                              onBlur={() => handleRenameSubmit(chat.id)}
                              onKeyDown={e => e.key === 'Enter' && handleRenameSubmit(chat.id)}
                              autoFocus
                              className="w-full bg-slate-900 text-slate-200 text-xs px-1 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          ) : (
                            <p className="text-xs font-medium truncate">{chat.title || 'New Chat'}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handlePinToggle(chat.id, e)}
                            className="p-1 text-slate-500 hover:text-slate-200"
                            title="Pin Chat"
                          >
                            <Pin className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingChatId(chat.id);
                              setEditingChatTitle(chat.title);
                            }}
                            className="p-1 text-slate-550 hover:text-slate-200"
                            title="Rename Chat"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteChat(chat.id, e)}
                            className="p-1 text-slate-550 hover:text-danger"
                            title="Delete Chat"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Main conversation panel */}
        <div className="lg:col-span-10 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col h-full shadow-sm relative">
          
          {/* Messages list container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth custom-scrollbar">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col justify-center items-center text-center max-w-3xl mx-auto py-12 space-y-6">
                <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center text-primary">
                  <Sparkles className="w-8 h-8 text-primary animate-pulse" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-200">Welcome to Database AI</h2>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Ask questions in plain English to search, group, chart, or alter tables. Our safe-mode checks protect your schema operations, and you can export results directly.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full pt-4">
                  {[
                    'Show all tables',
                    'Describe schema details',
                    'Top 10 highest revenue items',
                    'List active database statistics'
                  ].map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSubmitPrompt(undefined, s)}
                      className="p-3 bg-slate-955 hover:bg-slate-850 border border-slate-800 rounded-xl text-left text-xs font-semibold text-slate-350 hover:text-slate-100 transition-all hover:-translate-y-0.5 duration-200"
                    >
                      {s} &rarr;
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((msg, msgIndex) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`rounded-2xl p-4 shadow-sm space-y-3 ${
                        isUser
                          ? 'max-w-[85%] bg-gradient-to-r from-primary to-indigo-650 text-white rounded-br-none'
                          : 'w-full bg-slate-950 border border-slate-850/50 text-slate-200 rounded-bl-none'
                      }`}>
                        
                        {/* User Message Content with Edit Option */}
                        {isUser ? (
                          editingMsgId === msg.id ? (
                            <div className="flex flex-col gap-2 w-full min-w-[240px]">
                              <textarea
                                value={editingMsgText}
                                onChange={(e) => setEditingMsgText(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                rows={3}
                              />
                              <div className="flex justify-end gap-2 text-[10px]">
                                <button
                                  type="button"
                                  onClick={() => setEditingMsgId(null)}
                                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-450 font-bold rounded animate-fade"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const newText = editingMsgText.trim();
                                    if (!newText) return;
                                    setEditingMsgId(null);
                                    const idx = messages.findIndex(m => m.id === msg.id);
                                    if (idx !== -1) {
                                      const slicedHistory = messages.slice(0, idx);
                                      setMessages(slicedHistory);
                                      handleSubmitPrompt(undefined, newText);
                                    }
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold rounded"
                                >
                                  Save & Submit
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="group relative pr-8">
                              <div className="text-xs leading-relaxed font-normal whitespace-pre-wrap">
                                {msg.content}
                              </div>
                              <button
                                onClick={() => {
                                  setEditingMsgId(msg.id);
                                  setEditingMsgText(msg.content);
                                }}
                                className="absolute right-0 top-0.5 opacity-0 group-hover:opacity-100 p-0.5 text-slate-200 hover:text-white transition-opacity bg-slate-805/40 rounded"
                                title="Edit Prompt"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )
                        ) : (
                          <div className="text-xs leading-relaxed font-normal whitespace-pre-wrap">
                            {msg.content}
                          </div>
                        )}

                        {/* If assistant error */}
                        {msg.error && (
                          <div className="p-3 bg-danger/10 border border-danger/25 text-danger rounded-xl text-xs flex items-start gap-2 font-medium animate-shake">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{msg.error}</span>
                          </div>
                        )}

                        {/* Assistant Generated SQL Block */}
                        {!isUser && msg.sql && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center bg-slate-900 border border-slate-850 rounded-xl px-3 py-1.5">
                              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wide font-mono">Generated SQL</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => copyToClipboard(msg.sql || '', msg.id)}
                                  className="p-1 rounded text-slate-450 hover:text-slate-200 hover:bg-slate-805 transition-colors"
                                  title="Copy Query"
                                >
                                  {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  onClick={() => {
                                    setSaveQuerySql(msg.sql || '');
                                    setShowSaveModal(true);
                                  }}
                                  className="p-1 rounded text-slate-455 hover:text-slate-202 hover:bg-slate-800 transition-colors"
                                  title="Save to Saved Queries"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, isEditingSql: !m.isEditingSql } : m));
                                  }}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider text-slate-450 hover:text-slate-200 hover:bg-slate-800 transition-colors border border-slate-800"
                                >
                                  {msg.isEditingSql ? 'Close Editor' : 'Edit SQL'}
                                </button>
                              </div>
                            </div>

                            {/* SQL Editor inside bubble */}
                            <div className="rounded-xl overflow-hidden border border-slate-850 text-xs">
                              {msg.isEditingSql ? (
                                <CodeMirror
                                  value={msg.sql}
                                  extensions={[sql()]}
                                  theme={vscodeDark}
                                  onChange={(val) => {
                                    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, sql: val } : m));
                                  }}
                                  basicSetup={{ lineNumbers: true }}
                                />
                              ) : (
                                <pre className="bg-slate-900 p-3 overflow-x-auto text-[11px] font-mono text-slate-350 select-text whitespace-pre-wrap leading-relaxed">
                                  <code>{msg.sql}</code>
                                </pre>
                              )}
                            </div>

                            {/* Collapsible details / optimizations */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] leading-relaxed">
                              {msg.explanation && (
                                <div className="p-3 bg-slate-900 border border-slate-855 rounded-xl">
                                  <strong className="text-slate-400 font-bold block mb-1">How it works:</strong>
                                  <span className="text-slate-350">{msg.explanation}</span>
                                </div>
                              )}
                              {msg.optimization && (
                                <div className="p-3 bg-slate-900 border border-slate-855 rounded-xl">
                                  <strong className="text-slate-400 font-bold block mb-1">Optimizations & Recommendations:</strong>
                                  <span className="text-slate-350">{msg.optimization}</span>
                                </div>
                              )}
                            </div>

                            {/* Trigger Execution Button */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleExecuteBubble(msg.id)}
                                disabled={msg.isExecuting}
                                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-650 hover:bg-indigo-550 disabled:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all tracking-wider uppercase active:scale-95 disabled:opacity-50"
                              >
                                {msg.isExecuting ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Executing...
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-3.5 h-3.5 fill-current" /> Run Query
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleRegenerate(msgIndex)}
                                disabled={generating}
                                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-xl text-xs font-semibold"
                                title="Regenerate SQL"
                              >
                                <RefreshCw className="w-3.5 h-3.5" /> Retry
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Inline Results rendering inside the bubble */}
                        {!isUser && msg.results && (
                          <div className="border border-slate-850/60 rounded-2xl bg-slate-950/60 overflow-hidden space-y-3">
                            <div className="flex justify-between items-center bg-slate-900/60 px-4 py-2 border-b border-slate-850/50">
                              <div className="flex gap-4">
                                <button
                                  onClick={() => {
                                    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, chartType: 'none' } : m));
                                  }}
                                  className={`text-[10px] uppercase font-bold tracking-wider ${
                                    msg.chartType === 'none' || !msg.chartType ? 'text-primary border-b border-primary pb-0.5' : 'text-slate-500 hover:text-slate-350'
                                  }`}
                                >
                                  Table
                                </button>
                                <button
                                  onClick={() => {
                                    const firstCol = Object.keys(msg.results?.[0] || {})[0] || '';
                                    const secondCol = Object.keys(msg.results?.[0] || {})[1] || '';
                                    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, chartType: 'bar', xAxisCol: firstCol, yAxisCol: secondCol } : m));
                                  }}
                                  className={`text-[10px] uppercase font-bold tracking-wider ${
                                    msg.chartType && msg.chartType !== 'none' ? 'text-primary border-b border-primary pb-0.5' : 'text-slate-500 hover:text-slate-350'
                                  }`}
                                >
                                  Chart View
                                </button>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="text-[10px] text-slate-600 font-mono">
                                  {msg.results.length} rows ({msg.executionTimeMs || 0}ms)
                                </span>
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => handleExport('csv', msg.results || [])}
                                    className="px-1.5 py-0.5 hover:bg-slate-800 text-[9px] uppercase font-bold text-slate-500 hover:text-slate-205 border border-slate-800 rounded"
                                  >
                                    CSV
                                  </button>
                                  <button
                                    onClick={() => handleExport('xlsx', msg.results || [])}
                                    className="px-1.5 py-0.5 hover:bg-slate-800 text-[9px] uppercase font-bold text-slate-500 hover:text-slate-205 border border-slate-800 rounded"
                                  >
                                    Excel
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="p-3">
                              {msg.chartType === 'none' || !msg.chartType ? (
                                msg.results.length === 0 ? (
                                  <p className="text-xs text-slate-650 text-center py-4">Query completed successfully. Empty result set.</p>
                                ) : (
                                  <div className="max-h-72 overflow-auto border border-slate-850 rounded-xl custom-scrollbar">
                                    <table className="w-full text-left text-xs text-slate-400">
                                      <thead className="bg-slate-900 text-slate-500 uppercase tracking-wider text-[9px] border-b border-slate-850 font-bold sticky top-0">
                                        <tr>
                                          {Object.keys(msg.results[0]).map(k => (
                                            <th key={k} className="px-3 py-2 font-semibold">{k}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-850/50">
                                        {msg.results.map((row, idx) => (
                                          <tr key={idx} className="hover:bg-slate-900/40">
                                            {Object.values(row).map((val: any, colIdx) => (
                                              <td key={colIdx} className="px-3 py-2 font-mono text-slate-350 whitespace-nowrap">
                                                {val === null ? <span className="text-slate-700 italic">NULL</span> : String(val)}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )
                              ) : (
                                /* Custom Chart configuration inputs and chart display */
                                <div className="space-y-3">
                                  <div className="flex flex-wrap items-center gap-3 bg-slate-905 p-2 rounded-xl border border-slate-850/60">
                                    <select
                                      value={msg.chartType}
                                      onChange={(e) => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, chartType: e.target.value as any } : m))}
                                      className="bg-slate-950 border border-slate-850 text-slate-350 text-[10px] rounded p-1 outline-none font-bold uppercase tracking-wider cursor-pointer"
                                    >
                                      <option value="bar">Bar Chart</option>
                                      <option value="line">Line Chart</option>
                                      <option value="pie">Pie Chart</option>
                                      <option value="area">Area Chart</option>
                                      <option value="scatter">Scatter Plot</option>
                                      <option value="histogram">Histogram</option>
                                    </select>
                                    
                                    <div className="flex gap-2">
                                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                        <span>X Axis:</span>
                                        <select
                                          value={msg.xAxisCol}
                                          onChange={(e) => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, xAxisCol: e.target.value } : m))}
                                          className="bg-slate-950 border border-slate-850 text-slate-300 text-[10px] rounded p-0.5 outline-none cursor-pointer"
                                        >
                                          {Object.keys(msg.results[0]).map(k => (
                                            <option key={k} value={k}>{k}</option>
                                          ))}
                                        </select>
                                      </div>

                                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                        <span>Y Axis:</span>
                                        <select
                                          value={msg.yAxisCol}
                                          onChange={(e) => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, yAxisCol: e.target.value } : m))}
                                          className="bg-slate-955 border border-slate-850 text-slate-300 text-[10px] rounded p-0.5 outline-none cursor-pointer"
                                        >
                                          {Object.keys(msg.results[0]).map(k => (
                                            <option key={k} value={k}>{k}</option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>
                                  </div>

                                  <CustomChart
                                    data={msg.results}
                                    type={msg.chartType}
                                    xKey={msg.xAxisCol || ''}
                                    yKey={msg.yAxisCol || ''}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Suggested follow-up prompts inside latest message */}
                        {!isUser && msgIndex === messages.length - 1 && msg.followUps && msg.followUps.length > 0 && (
                          <div className="pt-2 border-t border-slate-850/30">
                            <span className="text-[10px] font-bold text-slate-550 uppercase tracking-widest block mb-2">Suggested follow-ups</span>
                            <div className="flex flex-wrap gap-2">
                              {msg.followUps.map((promptText, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => handleSubmitPrompt(undefined, promptText)}
                                  className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-350 hover:text-slate-200 rounded-xl text-[10px] font-medium transition-colors"
                                >
                                  {promptText}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {/* Generating typing indicator */}
            {generating && (
              <div className="flex justify-start">
                <div className="bg-slate-950 border border-slate-850/50 rounded-2xl p-4 rounded-bl-none text-slate-400 text-xs flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>AI Assistant is writing SQL & explaining...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom input area */}
          <div className="p-4 border-t border-slate-800 bg-slate-900/40 shrink-0">
            <form onSubmit={handleSubmitPrompt} className="relative bg-slate-950 border border-slate-800 rounded-2xl p-2 flex items-end gap-2 focus-within:border-primary transition-colors">
              <button
                type="button"
                onClick={() => {
                  setUploadStep(1);
                  setShowUploadModal(true);
                }}
                className="p-2 text-slate-500 hover:text-primary rounded-xl transition-colors shrink-0 mb-0.5"
                title="Attach CSV/Excel Dataset"
              >
                <UploadCloud className="w-5 h-5" />
              </button>

              <textarea
                ref={promptRef}
                rows={1}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitPrompt();
                  }
                }}
                placeholder="Ask your database assistant anything (e.g. generate schemas, run queries, render charts)..."
                className="flex-1 bg-transparent border-0 text-slate-200 placeholder-slate-650 focus:outline-none focus:ring-0 text-sm resize-none py-2 px-1 max-h-32 custom-scrollbar min-h-[36px]"
              />

              <button
                type="submit"
                disabled={generating || !prompt.trim() || !selectedDb}
                className="p-2 bg-primary hover:bg-primary-hover disabled:bg-slate-855 text-white rounded-xl transition-all shadow active:scale-95 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

        </div>
      </div>

      {/* Dangerous Confirmation Modal */}
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

            <div className="mt-4 bg-slate-955 p-3 rounded-lg border border-slate-850 font-mono text-xs text-slate-400 overflow-x-auto max-h-[120px]">
              <code>{riskDetails.sql}</code>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-455 uppercase tracking-wider mb-2">
                  Type <span className="text-rose-400 font-mono font-bold">CONFIRM</span> to proceed
                </label>
                <input
                  type="text"
                  placeholder="CONFIRM"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  className="w-full bg-slate-955 border border-slate-850 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-750 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-mono uppercase tracking-wider text-center"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowConfirmationModal(false);
                    setConfirmationInput('');
                    setRiskDetails(null);
                    setConfirmCallback(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-850 hover:bg-slate-750 text-slate-350 font-semibold rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={confirmationInput !== 'CONFIRM'}
                  onClick={() => {
                    setShowConfirmationModal(false);
                    setConfirmationInput('');
                    if (confirmCallback) confirmCallback();
                    setConfirmCallback(null);
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

      {/* Save Query Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <form onSubmit={handleSaveQuerySubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-semibold text-slate-200">Save Query</h3>
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-bold">Query Name / Description</label>
              <input
                type="text"
                required
                value={saveQueryName}
                onChange={e => setSaveQueryName(e.target.value)}
                placeholder="Find Monthly Active Users"
                className="w-full bg-slate-955 border border-slate-850 rounded-lg px-4 py-2 text-slate-100 focus:outline-none focus:border-primary text-sm"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowSaveModal(false);
                  setSaveQueryName('');
                }}
                className="px-4 py-2 rounded-lg text-slate-400 bg-slate-800 hover:bg-slate-700 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingQueryStatus || !saveQueryName.trim()}
                className="px-4 py-2 rounded-lg text-white bg-primary hover:bg-primary-hover text-sm font-medium disabled:opacity-50"
              >
                {savingQueryStatus ? 'Saving...' : 'Save SQL'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upload Dataset Modal (2-Step Wizard) */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-905 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-primary animate-pulse" />
                <h3 className="text-lg font-bold text-slate-200">Import Dataset (2-Step Wizard)</h3>
              </div>
              <span className="text-[10px] bg-primary/20 text-primary border border-primary/30 px-2.5 py-0.5 rounded-full font-bold">
                Step {uploadStep} of 2
              </span>
            </div>

            {uploadStep === 1 ? (
              <form onSubmit={handleAnalyzeFile} className="space-y-4">
                <p className="text-xs text-slate-450 leading-relaxed">
                  Step 1: Select your target database and upload your `.csv` or `.xlsx` file. We will analyze the data structure and propose column datatypes.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Target Connection</label>
                    <select
                      value={importConnectionId}
                      onChange={(e) => setImportConnectionId(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none"
                    >
                      {connections.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Select File (.csv, .xlsx)</label>
                    <input
                      type="file"
                      required
                      accept=".csv,.xlsx,.xls"
                      onChange={e => setUploadFile(e.target.files ? e.target.files[0] : null)}
                      className="w-full text-xs text-slate-450 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
                    />
                  </div>
                </div>

                {importError && (
                  <div className="p-3 bg-danger/10 border border-danger/20 text-danger text-xs rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadFile(null);
                      setImportError('');
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 text-xs font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={importingFile || !uploadFile || !importConnectionId}
                    className="px-4 py-2 rounded-lg text-white bg-primary hover:bg-primary-hover text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {importingFile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Analyze File
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCompleteImport} className="space-y-4">
                <p className="text-xs text-slate-450 leading-relaxed">
                  Step 2: Review and customize the table schema logical metadata. You can change Table Name and select exact datatypes for each column.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1">Destination Table Name</label>
                    <input
                      type="text"
                      required
                      value={importTableName}
                      onChange={e => setImportTableName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="w-full bg-slate-950 border border-slate-855 rounded-lg px-3 py-2 text-slate-100 text-xs focus:outline-none"
                      placeholder="quarterly_revenue"
                    />
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-slate-850 rounded-xl p-3 bg-slate-950 space-y-3">
                    <label className="block text-xs font-bold text-slate-400 border-b border-slate-800 pb-1.5 mb-2">Column Data-Type Configurations</label>
                    {analyzedColumns.map((col, idx) => (
                      <div key={idx} className="flex gap-2 items-center text-xs">
                        <span className="text-slate-505 font-mono w-24 truncate" title={col.raw}>{col.raw}</span>
                        <span className="text-slate-600">&rarr;</span>
                        <input
                          type="text"
                          value={col.logical}
                          onChange={e => {
                            const updated = [...analyzedColumns];
                            updated[idx].logical = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
                            setAnalyzedColumns(updated);
                          }}
                          className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none flex-1 max-w-[140px]"
                          placeholder="column_name"
                        />
                        <select
                          value={col.type}
                          onChange={e => {
                            const updated = [...analyzedColumns];
                            updated[idx].type = e.target.value;
                            setAnalyzedColumns(updated);
                          }}
                          className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none"
                        >
                          <option value="INT">INT (Integer)</option>
                          <option value="DOUBLE">DOUBLE (Decimal)</option>
                          <option value="VARCHAR(255)">VARCHAR (Text)</option>
                          <option value="TEXT">TEXT (Long Text)</option>
                          <option value="DATE">DATE (Date Only)</option>
                          <option value="DATETIME">DATETIME (Timestamp)</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {importError && (
                  <div className="p-3 bg-danger/10 border border-danger/20 text-danger text-xs rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{importError}</span>
                  </div>
                )}

                {importSuccess && (
                  <div className="p-3 bg-success/10 border border-success/20 text-success text-xs rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{importSuccess}</span>
                  </div>
                )}

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadStep(1);
                      setImportError('');
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-705 rounded-lg text-slate-300 text-xs font-medium"
                  >
                    Back to Upload
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUploadModal(false);
                        setUploadFile(null);
                        setImportError('');
                        setImportSuccess('');
                        setUploadStep(1);
                      }}
                      className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={importingFile || !importTableName.trim()}
                      className="px-4 py-2 rounded-lg text-white bg-primary hover:bg-primary-hover text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {importingFile ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Confirm & Import Table
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* AI Schema Generator Modal */}
      {showAiSchemaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl relative flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                <h3 className="text-lg font-bold text-slate-200">AI Database Architect</h3>
              </div>
              <button
                onClick={() => {
                  setShowAiSchemaModal(false);
                  setAiSchemaPrompt('');
                  setAiSchemaResult(null);
                  setAiSchemaError('');
                  setAiSchemaSuccess('');
                }}
                className="text-slate-400 hover:text-slate-202"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!aiSchemaResult ? (
              <form onSubmit={handleGenerateSchema} className="space-y-4">
                <p className="text-xs text-slate-450 leading-relaxed">
                  Describe the database you want to build (e.g. "An online store system with customer users, items, and shopping cart orders linked by keys"). The AI Architect will write the optimal tables, columns, indexes, and relationships.
                </p>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Database Description</label>
                  <textarea
                    required
                    value={aiSchemaPrompt}
                    onChange={e => setAiSchemaPrompt(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                    rows={5}
                    placeholder="ecommerce database with customers, products, and order items..."
                  />
                </div>

                {aiSchemaError && (
                  <div className="p-3 bg-danger/10 border border-danger/20 text-danger text-xs rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{aiSchemaError}</span>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAiSchemaModal(false)}
                    className="px-4 py-2 rounded-lg text-slate-400 bg-slate-800 hover:bg-slate-700 text-xs font-medium"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={aiSchemaLoading || !aiSchemaPrompt.trim()}
                    className="px-4 py-2 rounded-lg text-white bg-primary hover:bg-primary-hover text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {aiSchemaLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Generate Schema
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 overflow-y-auto flex-1 pr-1 custom-scrollbar">
                <div className="bg-slate-955 p-4 rounded-xl border border-slate-850">
                  <h4 className="text-xs font-bold text-slate-350 mb-1.5">Architect Design Explanation</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{aiSchemaResult.explanation}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-355 mb-2">Proposed Logical Tables</h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-850 rounded-xl p-2.5 bg-slate-955">
                      {aiSchemaResult.proposedTables.map((t, idx) => (
                        <div key={idx} className="text-xs border-b border-slate-900 pb-1.5 last:border-b-0 last:pb-0">
                          <strong className="text-primary">{t.name}</strong>
                          <div className="pl-2.5 text-[10px] text-slate-400 space-y-0.5 mt-0.5">
                            {t.columns.map((c, colIdx) => (
                              <div key={colIdx}>- {c.name} <span className="text-slate-600">({c.type})</span></div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-355 mb-2">Generated SQL Script Preview</h4>
                    <div className="font-mono text-[9px] text-slate-450 bg-slate-955 border border-slate-850 rounded-xl p-2.5 max-h-48 overflow-y-auto whitespace-pre-wrap leading-normal">
                      {aiSchemaResult.sql}
                    </div>
                  </div>
                </div>

                <form onSubmit={handleExecuteSchema} className="border-t border-slate-800 pt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-450 mb-1">Execute Target Connection</label>
                      <select
                        required
                        value={aiSchemaConnectionId}
                        onChange={(e) => setAiSchemaConnectionId(Number(e.target.value))}
                        className="w-full bg-slate-955 border border-slate-850 rounded-lg px-3 py-1.5 text-slate-100 text-xs focus:outline-none"
                      >
                        <option value="">Select connection</option>
                        {connections.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {aiSchemaError && (
                    <div className="p-3 bg-danger/10 border border-danger/20 text-danger text-xs rounded-lg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{aiSchemaError}</span>
                    </div>
                  )}

                  {aiSchemaSuccess && (
                    <div className="p-3 bg-success/10 border border-success/20 text-success text-xs rounded-lg flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{aiSchemaSuccess}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setAiSchemaResult(null);
                        setAiSchemaError('');
                        setAiSchemaSuccess('');
                      }}
                      className="px-3 py-1.5 bg-slate-805 hover:bg-slate-700 rounded-lg text-slate-300 text-xs font-medium"
                    >
                      Back to Prompt
                    </button>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAiSchemaModal(false);
                          setAiSchemaPrompt('');
                          setAiSchemaResult(null);
                          setAiSchemaError('');
                          setAiSchemaSuccess('');
                        }}
                        className="px-4 py-2 rounded-lg text-slate-450 hover:text-slate-200 text-xs font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={executingAiSchema || !aiSchemaConnectionId}
                        className="px-4 py-2 rounded-lg text-white bg-indigo-650 hover:bg-indigo-550 text-xs font-medium disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {executingAiSchema ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        Execute & Create Schema
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface CustomChartProps {
  data: any[];
  type: 'bar' | 'line' | 'pie' | 'area' | 'scatter' | 'histogram';
  xKey: string;
  yKey: string;
}

function CustomChart({ data, type, xKey, yKey }: CustomChartProps) {
  const width = 500;
  const height = 300;
  const padding = 45;

  if (!data || data.length === 0 || !xKey || !yKey) return null;

  const points = data
    .map((item) => {
      const label = String(item[xKey] === null ? 'NULL' : item[xKey]);
      const val = parseFloat(item[yKey]);
      return { label, val };
    })
    .filter((p) => !isNaN(p.val));

  if (points.length === 0) {
    return <p className="text-xs text-slate-500 text-center py-6">No numeric values found in column "{yKey}" for charting.</p>;
  }

  const maxVal = Math.max(...points.map((p) => p.val), 0) || 1;
  const minVal = Math.min(...points.map((p) => p.val), 0);
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;
  const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#06b6d4'];

  // 1. Pie Chart
  if (type === 'pie') {
    const total = points.reduce((sum, p) => sum + p.val, 0) || 1;
    let accumulatedAngle = 0;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(graphWidth, graphHeight) / 2;

    return (
      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col md:flex-row items-center justify-center gap-6 animate-fade">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-48 h-48 overflow-visible">
          {points.map((p, idx) => {
            const percentage = p.val / total;
            const angle = percentage * 360;
            const x1 = centerX + radius * Math.cos((accumulatedAngle - 90) * Math.PI / 180);
            const y1 = centerY + radius * Math.sin((accumulatedAngle - 90) * Math.PI / 180);
            
            accumulatedAngle += angle;
            
            const x2 = centerX + radius * Math.cos((accumulatedAngle - 90) * Math.PI / 180);
            const y2 = centerY + radius * Math.sin((accumulatedAngle - 90) * Math.PI / 180);
            
            const largeArcFlag = angle > 180 ? 1 : 0;
            const pathData = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
            
            const color = colors[idx % colors.length];

            return (
              <path
                key={idx}
                d={pathData}
                fill={color}
                stroke="#0f172a"
                strokeWidth="1.5"
                className="hover:opacity-90 transition-opacity"
              >
                <title>{p.label}: {p.val} ({Math.round(percentage * 100)}%)</title>
              </path>
            );
          })}
        </svg>

        <div className="flex flex-wrap gap-2 max-w-[220px] max-h-48 overflow-y-auto custom-scrollbar">
          {points.map((p, idx) => {
            const color = colors[idx % colors.length];
            return (
              <div key={idx} className="flex items-center gap-1.5 text-[10px] text-slate-355">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="truncate max-w-[80px] font-medium" title={p.label}>{p.label}:</span>
                <span className="font-mono text-slate-500">{p.val}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 2. Line Chart
  if (type === 'line') {
    const pointsFormatted = points.map((p, idx) => {
      const x = padding + (idx / (points.length - 1 || 1)) * graphWidth;
      const y = padding + graphHeight - (p.val / maxVal) * graphHeight;
      return { x, y, label: p.label, val: p.val };
    });

    const pathString = pointsFormatted.reduce((path, p, idx) => {
      return path + `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
    }, '');

    return (
      <div className="p-4 bg-slate-950 rounded-xl border border-slate-805 animate-fade">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
            const y = padding + graphHeight * p;
            const labelVal = Math.round(maxVal * (1 - p));
            return (
              <g key={idx}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#1e293b" strokeDasharray="3,3" strokeWidth="0.5" />
                <text x={padding - 6} y={y + 3} fill="#475569" fontSize="8" textAnchor="end">{labelVal}</text>
              </g>
            );
          })}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#334155" strokeWidth="1" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#334155" strokeWidth="1" />

          {pointsFormatted.length > 0 && <path d={pathString} fill="none" stroke="#6366f1" strokeWidth="2" />}

          {pointsFormatted.map((p, idx) => (
            <g key={idx}>
              <circle cx={p.x} cy={p.y} r="3.5" fill="#10b981" stroke="#0f172a" strokeWidth="1.5" />
              <title>{p.label}: {p.val}</title>
              {pointsFormatted.length < 15 && (
                <text x={p.x} y={height - padding + 12} fill="#475569" fontSize="7" textAnchor="middle" className="font-medium">
                  {p.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    );
  }

  // 3. Area Chart
  if (type === 'area') {
    const pointsFormatted = points.map((p, idx) => {
      const x = padding + (idx / (points.length - 1 || 1)) * graphWidth;
      const y = padding + graphHeight - (p.val / maxVal) * graphHeight;
      return { x, y, label: p.label, val: p.val };
    });

    const pathString = pointsFormatted.reduce((path, p, idx) => {
      return path + `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
    }, '');

    const areaPathString = pointsFormatted.length > 0
      ? `${pathString} L ${pointsFormatted[pointsFormatted.length - 1].x} ${height - padding} L ${pointsFormatted[0].x} ${height - padding} Z`
      : '';

    return (
      <div className="p-4 bg-slate-955 rounded-xl border border-slate-805 animate-fade">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          <defs>
            <linearGradient id="copilotAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
            const y = padding + graphHeight * p;
            const labelVal = Math.round(maxVal * (1 - p));
            return (
              <g key={idx}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#1e293b" strokeDasharray="3,3" strokeWidth="0.5" />
                <text x={padding - 6} y={y + 3} fill="#475569" fontSize="8" textAnchor="end">{labelVal}</text>
              </g>
            );
          })}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#334155" strokeWidth="1" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#334155" strokeWidth="1" />

          {areaPathString && <path d={areaPathString} fill="url(#copilotAreaGrad)" />}
          {pathString && <path d={pathString} fill="none" stroke="#6366f1" strokeWidth="2.5" />}

          {pointsFormatted.map((p, idx) => (
            <g key={idx}>
              <circle cx={p.x} cy={p.y} r="3.5" fill="#10b981" stroke="#0f172a" strokeWidth="1.5" />
              <title>{p.label}: {p.val}</title>
              {pointsFormatted.length < 15 && (
                <text x={p.x} y={height - padding + 12} fill="#475569" fontSize="7" textAnchor="middle" className="font-medium">
                  {p.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    );
  }

  // 4. Scatter Plot
  if (type === 'scatter') {
    const pointsFormatted = points.map((p, idx) => {
      const x = padding + (idx / (points.length - 1 || 1)) * graphWidth;
      const y = padding + graphHeight - (p.val / maxVal) * graphHeight;
      return { x, y, label: p.label, val: p.val };
    });

    return (
      <div className="p-4 bg-slate-955 rounded-xl border border-slate-805 animate-fade">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
            const y = padding + graphHeight * p;
            const labelVal = Math.round(maxVal * (1 - p));
            return (
              <g key={idx}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#1e293b" strokeDasharray="3,3" strokeWidth="0.5" />
                <text x={padding - 6} y={y + 3} fill="#475569" fontSize="8" textAnchor="end">{labelVal}</text>
              </g>
            );
          })}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#334155" strokeWidth="1" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#334155" strokeWidth="1" />

          {pointsFormatted.map((p, idx) => (
            <g key={idx}>
              <circle cx={p.x} cy={p.y} r="5" fill="#f59e0b" stroke="#0f172a" strokeWidth="1" className="hover:fill-amber-400 transition-colors" />
              <title>{p.label}: {p.val}</title>
              {pointsFormatted.length < 15 && (
                <text x={p.x} y={height - padding + 12} fill="#475569" fontSize="7" textAnchor="middle" className="font-medium">
                  {p.label}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    );
  }

  // 5. Histogram
  if (type === 'histogram') {
    const values = points.map(p => p.val).sort((a, b) => a - b);
    const maxValActual = values[values.length - 1];
    const range = (maxValActual - minVal) || 1;
    const binCount = Math.min(5, values.length);
    const binSize = range / binCount;
    
    const binRanges = Array(binCount).fill(null).map((_, idx) => {
      const start = minVal + idx * binSize;
      const end = start + binSize;
      return { start, end, count: 0 };
    });

    values.forEach(v => {
      let binIdx = Math.floor((v - minVal) / binSize);
      if (binIdx >= binCount) binIdx = binCount - 1;
      if (binIdx < 0) binIdx = 0;
      binRanges[binIdx].count++;
    });

    const maxCount = Math.max(...binRanges.map(b => b.count), 1);
    const histBarWidth = (graphWidth / binCount) * 0.85;
    const histBarGap = (graphWidth / binCount) * 0.15;

    return (
      <div className="p-4 bg-slate-950 rounded-xl border border-slate-805 animate-fade">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
            const y = padding + graphHeight * p;
            const labelVal = Math.round(maxCount * (1 - p));
            return (
              <g key={idx}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#1e293b" strokeDasharray="3,3" strokeWidth="0.5" />
                <text x={padding - 6} y={y + 3} fill="#475569" fontSize="8" textAnchor="end">{labelVal}</text>
              </g>
            );
          })}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#334155" strokeWidth="1" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#334155" strokeWidth="1" />

          {binRanges.map((bin, idx) => {
            const binHeight = (bin.count / maxCount) * graphHeight;
            const x = padding + idx * (histBarWidth + histBarGap) + histBarGap / 2;
            const y = padding + graphHeight - binHeight;
            const label = `${Math.round(bin.start)}-${Math.round(bin.end)}`;

            return (
              <g key={idx}>
                <rect
                  x={x}
                  y={y}
                  width={histBarWidth}
                  height={binHeight}
                  fill="#10b981"
                  rx="1.5"
                  className="hover:fill-emerald-400 transition-colors"
                >
                  <title>{label}: {bin.count} items</title>
                </rect>
                <text x={x + histBarWidth / 2} y={height - padding + 12} fill="#475569" fontSize="7" textAnchor="middle" className="font-medium">
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  // 6. Bar Chart (Default fallback)
  const barWidth = Math.max((graphWidth / points.length) * 0.7, 4);
  const barGap = (graphWidth / points.length) * 0.3;

  return (
    <div className="p-4 bg-slate-950 rounded-xl border border-slate-805 animate-fade">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
        {[0, 0.25, 0.5, 0.75, 1].map((p, idx) => {
          const y = padding + graphHeight * p;
          const labelVal = Math.round(maxVal * (1 - p));
          return (
            <g key={idx}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#1e293b" strokeDasharray="3,3" strokeWidth="0.5" />
              <text x={padding - 6} y={y + 3} fill="#475569" fontSize="8" textAnchor="end">{labelVal}</text>
            </g>
          );
        })}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#334155" strokeWidth="1" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#334155" strokeWidth="1" />

        {points.map((p, idx) => {
          const barHeight = (p.val / maxVal) * graphHeight;
          const x = padding + idx * (barWidth + barGap) + barGap / 2;
          const y = padding + graphHeight - barHeight;

          return (
            <g key={idx}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill="#6366f1"
                rx="1.5"
                className="hover:fill-indigo-400 transition-colors"
              >
                <title>{p.label}: {p.val}</title>
              </rect>
              {points.length < 15 && (
                <text x={x + barWidth / 2} y={height - padding + 12} fill="#475569" fontSize="7" textAnchor="middle" className="font-medium">
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
