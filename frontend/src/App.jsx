import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import PieceList from './components/PieceList';
import PieceForm from './components/PieceForm';
import PieceDetail from './components/PieceDetail';
import PhaseManager from './components/PhaseManager';
import MaterialManager from './components/MaterialManager';
import KanbanView from './components/KanbanView';

function Navigation() {
  const location = useLocation();
  
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
          <Link to="/phases" className={location.pathname === '/phases' ? 'active' : ''}>
            Phases
          </Link>
        </li>
        <li>
          <Link to="/materials" className={location.pathname === '/materials' ? 'active' : ''}>
            Materials
          </Link>
        </li>
      </ul>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <header>
        <div className="container">
          <h1>Pottery tracker</h1>
        </div>
      </header>
      <Navigation />
      <main>
        <div className="container">
          <Routes>
            <Route path="/" element={<KanbanView />} />
            <Route path="/list" element={<PieceList />} />
            <Route path="/kanban" element={<KanbanView />} />
            <Route path="/pieces/new" element={<PieceForm />} />
            <Route path="/pieces/:id/edit" element={<PieceForm />} />
            <Route path="/pieces/:id" element={<PieceDetail />} />
            <Route path="/phases" element={<PhaseManager />} />
            <Route path="/materials" element={<MaterialManager />} />
          </Routes>
        </div>
      </main>
    </Router>
  );
}

export default App;


