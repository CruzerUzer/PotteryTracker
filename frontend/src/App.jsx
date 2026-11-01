import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import PieceList from './components/PieceList';
import PieceForm from './components/PieceForm';
import PieceDetail from './components/PieceDetail';
import WorkflowManager from './components/WorkflowManager';
import MaterialManager from './components/MaterialManager';
import KanbanView from './components/KanbanView';
import DonePieces from './components/DonePieces';
import Login from './components/Login';
import Register from './components/Register';
import ExportData from './components/ExportData';
import Footer from './components/Footer';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import Settings from './components/Settings';
import AppHeader from './components/AppHeader';
import AdminPanel from './components/AdminPanel';
import ResetPassword from './components/ResetPassword';
import InstallPrompt from './components/InstallPrompt';
const StatsDashboard = lazy(() => import('./components/StatsDashboard'));
import { ToastProvider } from './components/ui/toast';
import { ConfirmProvider } from './components/ui/confirm-dialog';
import { useScrollMemory } from './hooks/useScrollMemory';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="card loading">Laddar…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return <div className="card loading">Laddar…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AppContent() {
  const { user, loading } = useAuth();
  const location = useLocation();
  useScrollMemory();

  if (loading) {
    return (
      <div className="container">
        <div className="card loading">Laddar…</div>
      </div>
    );
  }

  return (
    <div className={`app-shell${user ? ' app-shell--authed' : ''}`}>
      {user && <Sidebar />}
      <div className="main-content">
        {user && <AppHeader />}
        <main className="app-main">
          <div className="container page-transition" key={location.pathname}>
            <Routes location={location}>
              <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
              <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <KanbanView />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/list"
                element={
                  <ProtectedRoute>
                    <PieceList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/done"
                element={
                  <ProtectedRoute>
                    <DonePieces />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pieces/new"
                element={
                  <ProtectedRoute>
                    <PieceForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pieces/:id"
                element={
                  <ProtectedRoute>
                    <PieceDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/stats"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<div className="card loading">Laddar statistik…</div>}>
                      <StatsDashboard />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/workflow"
                element={
                  <ProtectedRoute>
                    <WorkflowManager />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/materials"
                element={
                  <ProtectedRoute>
                    <MaterialManager />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/backup"
                element={
                  <ProtectedRoute>
                    <ExportData />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminPanel />
                  </AdminRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
        {user && <Footer />}
        {user && <BottomNav />}
      </div>
      <InstallPrompt />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              <Router>
                <AppContent />
              </Router>
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
