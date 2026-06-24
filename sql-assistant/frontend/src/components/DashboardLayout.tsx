import { Link, useLocation } from 'react-router-dom';
import { Database, MessageSquare, History, Settings, LogOut, LayoutDashboard, Menu, X, Shield, Users, Terminal, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useState, useEffect } from 'react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Inactivity automatic logout timer (15 minutes)
  useEffect(() => {
    let timeoutId: number;

    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        logout();
      }, 15 * 60 * 1000); // 15 minutes
    };

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    activityEvents.forEach((ev) => {
      window.addEventListener(ev, resetTimer);
    });

    resetTimer();

    return () => {
      window.clearTimeout(timeoutId);
      activityEvents.forEach((ev) => {
        window.removeEventListener(ev, resetTimer);
      });
    };
  }, [logout]);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'SQL Assistant', href: '/assistant', icon: MessageSquare },
    { name: 'Schema Explorer', href: '/schema', icon: Database },
    { name: 'Query History', href: '/history', icon: History },
    ...((user?.role === 'ADMIN' || (user?.role === 'DATABASE_MANAGER' && user?.status === 'APPROVED'))
      ? [{ name: 'Database Settings', href: '/database', icon: Settings }]
      : []),
    ...(user?.role === 'ADMIN'
      ? [
          { name: 'User Management', href: '/admin/users', icon: Users },
          { name: 'Security Dashboard', href: '/admin/security', icon: Shield },
          { name: 'Audit Logs', href: '/admin/audit-logs', icon: Terminal }
        ]
      : [])
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-550 overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-slate-950/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 border-r border-slate-800 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 flex flex-col ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-100">SQL Assistant</span>
          </div>
          <button 
            className="ml-auto lg:hidden text-slate-400 hover:text-slate-100"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-primary/10 text-primary font-medium' 
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-slate-500'}`} />
                {item.name}
              </Link>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-slate-800/50 mb-3 border border-slate-700/50">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 text-sm font-medium text-slate-205">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{user?.email}</p>
              <p className="text-xs text-slate-500 truncate capitalize">{user?.role?.toLowerCase()?.replace('_', ' ')}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center px-4 sm:px-6 lg:px-8 bg-slate-900 border-b border-slate-800 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-2 mr-2 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            <span className="font-bold tracking-tight text-slate-105">SQL Assistant</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-slate-950 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto h-full">
            {user?.role === 'DATABASE_MANAGER' && user?.status === 'PENDING' && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-400 text-sm">Awaiting Administrator Approval</h4>
                  <p className="text-xs text-slate-300 mt-1">
                    Your Database Manager account is pending review. You can run and generate read-only SQL queries, but you cannot connect databases or alter configuration until an administrator activates your status.
                  </p>
                </div>
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
