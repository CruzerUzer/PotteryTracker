import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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

function Navigation() {
  const location = useLocation();
  const { user, logout } = useAuth();
  
  const handleLogout = async () => {
    await logout();
  };
  
  return (
      <nav>
        <ul>
          <li>
            <Link to="/" className={location.pathname === '/' || location.pathname === '/kanban' ? 'active' : ''}>
              Kanban
            </Link>
          </li>
          <li>
            <Link to="/list" className={location.pathname === '/list' ? 'active' : ''}>
              List
            </Link>
          </li>
          <li>
            <Link to="/done" className={location.pathname === '/done' ? 'active' : ''}>
              Done
            </Link>
          </li>
        <li>
          <Link to="/phases" className={location.pathname === '/phases' ? 'active' : ''}>
            Phases
          </Link>
        </li>
        <li>
          <Link to="/materials" className={location.pathname === '/materials' ? 'active' : ''}>
            Materials
          </Link>
        </li>
        <li>
          <Link to="/export" className={location.pathname === '/export' ? 'active' : ''}>
            Export
          </Link>
        </li>
        {user && (
          <li style={{ marginLeft: 'auto' }}>
            <span style={{ padding: '16px 24px', color: '#6b7280' }}>{user.username}</span>
            <button
              onClick={handleLogout}
              style={{
                background: 'none',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                padding: '16px 24px',
                fontSize: 'inherit',
                fontFamily: 'inherit'
              }}
            >
              Logout
            </button>
          </li>
        )}
      </ul>
    </nav>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="card">Loading...</div>;
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
        <div className="card">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <header>
        <div className="container">
          <h1>Pottery tracker</h1>
        </div>
      </header>
      {user && <Navigation />}
      <main>
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;


