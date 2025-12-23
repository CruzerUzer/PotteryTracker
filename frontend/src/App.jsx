import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import PieceList from './components/PieceList';
import PieceForm from './components/PieceForm';
import PieceDetail from './components/PieceDetail';
import PhaseManager from './components/PhaseManager';
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

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="card loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="container">
        <div className="card loading">Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {user && <Sidebar />}
      <div className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {user && (
          <header>
            <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h1 style={{ margin: 0 }}>PotteryTracker</h1>
              {user && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>{user.username}</span>
                </div>
              )}
            </div>
          </header>
        )}
        <main style={{ flex: 1 }}>
          <div className="container">
            <Routes>
              <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
              <Route path="/register" element={user ? <Navigate to="/" replace /> : <Register />} />
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
                path="/kanban"
                element={
                  <ProtectedRoute>
                    <KanbanView />
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
                path="/pieces/:id/edit"
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
                path="/phases"
                element={
                  <ProtectedRoute>
                    <PhaseManager />
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
                path="/export"
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
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
        {user && <Footer />}
        {user && <BottomNav />}
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
