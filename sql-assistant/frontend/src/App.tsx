import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Register from './pages/Register';
import DashboardLayout from './components/DashboardLayout';

import DatabaseSettings from './pages/DatabaseSettings';
import SchemaExplorer from './pages/SchemaExplorer';
import SQLAssistant from './pages/SQLAssistant';
import QueryHistory from './pages/QueryHistory';
import Analytics from './pages/Analytics';
import SecurityDashboard from './pages/SecurityDashboard';
import UserManagement from './pages/UserManagement';
import AuditLogs from './pages/AuditLogs';
import AccessDenied from './pages/AccessDenied';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((state) => state.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const ManagerRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  if (!token) return <Navigate to="/login" replace />;
  const isApprovedManager = user?.role === 'DATABASE_MANAGER' && user?.status === 'APPROVED';
  const isAdmin = user?.role === 'ADMIN';
  if (!isApprovedManager && !isAdmin) return <Navigate to="/access-denied" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  if (!token) return <Navigate to="/login" replace />;
  if (user?.role !== 'ADMIN') return <Navigate to="/access-denied" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/access-denied" element={<AccessDenied />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <DashboardLayout>
              <Analytics />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/database" element={
          <ManagerRoute>
            <DashboardLayout>
              <DatabaseSettings />
            </DashboardLayout>
          </ManagerRoute>
        } />
        
        <Route path="/schema" element={
          <ProtectedRoute>
            <DashboardLayout>
              <SchemaExplorer />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/assistant" element={
          <ProtectedRoute>
            <DashboardLayout>
              <SQLAssistant />
            </DashboardLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/history" element={
          <ProtectedRoute>
            <DashboardLayout>
              <QueryHistory />
            </DashboardLayout>
          </ProtectedRoute>
        } />

        <Route path="/admin/users" element={
          <AdminRoute>
            <DashboardLayout>
              <UserManagement />
            </DashboardLayout>
          </AdminRoute>
        } />

        <Route path="/admin/security" element={
          <AdminRoute>
            <DashboardLayout>
              <SecurityDashboard />
            </DashboardLayout>
          </AdminRoute>
        } />

        <Route path="/admin/audit-logs" element={
          <AdminRoute>
            <DashboardLayout>
              <AuditLogs />
            </DashboardLayout>
          </AdminRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;
