import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import DashboardLayout from './components/DashboardLayout';

import SchemaExplorer from './pages/SchemaExplorer';
import SQLAssistant from './pages/SQLAssistant';
import QueryHistory from './pages/QueryHistory';
import Analytics from './pages/Analytics';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((state) => state.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const UnprotectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = useAuthStore((state) => state.token);
  if (token) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Unprotected SaaS routes */}
        <Route path="/" element={<LandingPage />} />
        
        <Route path="/login" element={
          <UnprotectedRoute>
            <Login />
          </UnprotectedRoute>
        } />
        
        <Route path="/register" element={
          <UnprotectedRoute>
            <Register />
          </UnprotectedRoute>
        } />

        <Route path="/forgot-password" element={
          <UnprotectedRoute>
            <ForgotPassword />
          </UnprotectedRoute>
        } />

        <Route path="/reset-password" element={
          <UnprotectedRoute>
            <ResetPassword />
          </UnprotectedRoute>
        } />

        {/* Protected Dashboard routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardLayout>
              <Analytics />
            </DashboardLayout>
          </ProtectedRoute>
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

        {/* Fallback route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
