import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  Sparkles,
  Database,
  ArrowRight,
  UploadCloud,
  History,
  Cpu,
  Layers,
  Activity,
  Play
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const [scrolled, setScrolled] = useState(false);

  // Monitor scroll for header background blur
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: Cpu,
      title: 'AI Query Generator',
      description: 'Describe what you need in plain English and watch the AI write perfect MySQL queries instantly.',
      color: 'text-indigo-400 bg-indigo-500/10'
    },
    {
      icon: Sparkles,
      title: 'SQL Explanation',
      description: 'Get deep step-by-step logical explanations for any generated query to understand exactly how it works.',
      color: 'text-purple-400 bg-purple-500/10'
    },
    {
      icon: UploadCloud,
      title: 'CSV / Excel Import',
      description: 'Upload CSV and Excel datasets directly, mapping custom column datatypes using our interactive wizard.',
      color: 'text-blue-400 bg-blue-500/10'
    },
    {
      icon: Layers,
      title: 'Schema Generator',
      description: 'Describe your database requirements and let the AI Architect design schemas and execute DDL queries.',
      color: 'text-amber-400 bg-amber-500/10'
    },
    {
      icon: History,
      title: 'Query History',
      description: 'Review execution time logs, query results count, and save templates directly inside your user dashboard.',
      color: 'text-rose-400 bg-rose-500/10'
    },
    {
      icon: Activity,
      title: 'Data Visualization',
      description: 'Render customizable SVG charting metrics (Bar, Line, Area, Pie, Scatter, Histogram) from query outputs.',
      color: 'text-cyan-400 bg-cyan-500/10'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-primary selection:text-white">
      {/* Radial glow background lights */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-screen-2xl h-[600px] bg-gradient-radial from-primary/10 via-transparent to-transparent pointer-events-none z-0" />

      {/* Header Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-350 ${
        scrolled 
          ? 'bg-slate-950/80 backdrop-blur-md border-b border-slate-900/80 shadow-md py-4' 
          : 'bg-transparent py-8'
      }`}>
        <div className="max-w-[1700px] w-11/12 mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20 shadow-inner">
                <Database className="w-5.5 h-5.5 text-primary" />
              </div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
                Query Generator
              </span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#home" className="text-sm font-semibold text-slate-450 hover:text-slate-100 transition-colors">Home</a>
              <a href="#features" className="text-sm font-semibold text-slate-450 hover:text-slate-100 transition-colors">Features</a>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {token ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-1.5 px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-bold transition-all shadow active:scale-95"
              >
                Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="px-5 py-3 text-slate-350 hover:text-white text-sm font-semibold transition-all"
                >
                  Login
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-bold transition-all shadow active:scale-95"
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header id="home" className="relative pt-44 pb-20 px-6 max-w-[1700px] w-11/12 mx-auto z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          {/* Left Text details */}
          <div className="lg:col-span-5 text-left space-y-7">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 border border-indigo-550/20 text-indigo-400 rounded-full text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Query Generator AI
            </div>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-tight bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
              Generate SQL <br />with AI
            </h1>

            <div className="space-y-3.5">
              <p className="text-base font-semibold text-slate-200">
                AI-powered SQL generation, explanation, and execution.
              </p>
              <p className="text-sm text-slate-400 leading-relaxed">
                Import datasets, create schemas, generate SQL queries, explain results, and manage databases using AI. Experience a truly secure, sandboxed playground.
              </p>
            </div>

            <div className="flex items-center gap-4 pt-3">
              <button
                onClick={() => navigate(token ? '/dashboard' : '/register')}
                className="flex items-center gap-1.5 px-7 py-3.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/20 active:scale-95"
              >
                Get Started <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="#demo"
                className="px-7 py-3.5 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-bold transition-all shadow"
              >
                View Demo
              </a>
            </div>
          </div>

          {/* Right actual app preview mockup */}
          <div id="demo" className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-2.5 shadow-2xl relative overflow-hidden backdrop-blur-sm group">
            <div className="rounded-xl overflow-hidden border border-slate-850 bg-slate-950 flex flex-col h-[420px] md:h-[480px]">
              {/* Mockup Header bar */}
              <div className="px-5 py-3.5 bg-slate-900/60 border-b border-slate-855 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs text-slate-500 font-bold ml-2 font-mono">active_db: online_store_db</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-slate-800 border border-slate-700 text-slate-400 font-semibold px-3 py-1 rounded-lg">Safe Mode</span>
                </div>
              </div>

              {/* Mockup Client Workspace Layout */}
              <div className="flex-1 min-h-0 flex bg-slate-950">
                {/* Mockup Sidebar */}
                <div className="w-36 border-r border-slate-850 bg-slate-900/10 p-3.5 hidden sm:flex flex-col gap-4">
                  <div className="h-4.5 w-16 bg-slate-800 rounded opacity-60" />
                  <div className="space-y-2.5">
                    <div className="h-3.5 w-24 bg-slate-800 rounded opacity-40" />
                    <div className="h-3.5 w-20 bg-slate-800 rounded opacity-40" />
                    <div className="h-3.5 w-28 bg-slate-800 rounded opacity-40" />
                  </div>
                </div>

                {/* Mockup Chat pane */}
                <div className="flex-1 p-5 space-y-5 overflow-y-auto custom-scrollbar font-sans">
                  {/* User request */}
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-gradient-to-r from-primary to-indigo-650 text-white rounded-2xl rounded-br-none px-4 py-2.5 text-xs shadow-md">
                      Show all customers in our online shop
                    </div>
                  </div>

                  {/* AI Assistant Output Card */}
                  <div className="flex justify-start">
                    <div className="w-full bg-slate-900 border border-slate-850 text-slate-300 rounded-2xl rounded-bl-none p-4 space-y-3 shadow">
                      <p className="text-xs text-slate-400">
                        I generated the query below to retrieve all customers:
                      </p>

                      {/* SQL Code Block */}
                      <div className="bg-slate-950 border border-slate-850 rounded-lg overflow-hidden text-xs font-mono p-3.5 space-y-1">
                        <div><span className="text-indigo-400">SELECT</span> id, name, email, country</div>
                        <div><span className="text-indigo-400">FROM</span> db_user_5_Customers;</div>
                      </div>

                      {/* Run Query Button */}
                      <div className="flex items-center gap-2">
                        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-650 text-white font-bold rounded-lg text-xs uppercase tracking-wider">
                          <Play className="w-3.5 h-3.5 fill-current" /> Run Query
                        </button>
                        <span className="text-xs text-slate-500 font-mono">10 rows returned</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Features Grid Section */}
      <section id="features" className="py-32 px-6 max-w-[1700px] w-11/12 mx-auto border-t border-slate-900">
        <div className="text-center max-w-4xl mx-auto mb-20">
          <span className="text-primary font-bold text-xs uppercase tracking-widest">Capabilities</span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-slate-100 mt-2">Workspace Features</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f, idx) => (
            <div key={idx} className="p-8 bg-slate-900/60 border border-slate-800 rounded-2xl shadow-sm hover:border-slate-700/80 transition-all duration-300">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${f.color} mb-6`}>
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-200">{f.title}</h3>
              <p className="text-xs text-slate-450 leading-relaxed mt-2.5">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-14 px-6">
        <div className="max-w-[1700px] w-11/12 mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <span className="font-bold text-base tracking-tight text-slate-200">Query Generator AI</span>
          </div>

          <div className="flex items-center gap-7 text-xs text-slate-500">
            <a href="https://github.com" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-slate-350 transition-colors">
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.167 6.839 9.49.5.092.682-.217.682-.48 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.479C19.138 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
              </svg> GitHub
            </a>
            <span className="hover:text-slate-350 transition-colors cursor-pointer">Privacy Policy</span>
            <span className="text-slate-600">&copy; 2026 Query Generator</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
