import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, List, CheckCircle, BarChart2, Plus, GraduationCap } from 'lucide-react';
import { isPathActive } from './MoreMenu';

export { isPathActive };

/**
 * Bottenmenyn på mobil: två flikar, Ny pjäs i mitten, två flikar.
 * Övriga sidor ligger i Mer-menyn i headern (MoreMenu).
 */
function BottomNav() {
  const location = useLocation();
  const { user, studyEnabled } = useAuth();

  if (!user) return null;

  // Alltid fem platser så att plusknappen sitter i mitten
  const left = [
    { path: '/', icon: LayoutDashboard, label: 'Kanban' },
    { path: '/list', icon: List, label: 'Lista' },
  ];
  const right = studyEnabled
    ? [
        { path: '/studie', icon: GraduationCap, label: 'Studie' },
        { path: '/done', icon: CheckCircle, label: 'Färdiga' },
      ]
    : [
        { path: '/done', icon: CheckCircle, label: 'Färdiga' },
        { path: '/stats', icon: BarChart2, label: 'Statistik' },
      ];

  const onTabClick = (e, path) => {
    // Tryck på aktiv flik = scrolla till toppen
    const onSamePage = path === '/' ? isPathActive(location.pathname, '/') : location.pathname === path;
    if (onSamePage) {
      e.preventDefault();
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    }
  };

  const renderTab = (item) => {
    const Icon = item.icon;
    const active = isPathActive(location.pathname, item.path);
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`nav-item ${active ? 'active' : ''}`}
        aria-current={active ? 'page' : undefined}
        onClick={(e) => onTabClick(e, item.path)}
      >
        <Icon className="nav-icon" size={21} strokeWidth={active ? 2.2 : 1.8} />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <nav className="bottom-nav" aria-label="Huvudmeny">
      {left.map(renderTab)}
      <div className="nav-fab-slot">
        <Link
          to="/pieces/new"
          className={`nav-fab ${location.pathname === '/pieces/new' ? 'active' : ''}`}
          aria-label="Ny pjäs"
        >
          <Plus size={26} strokeWidth={2.2} />
        </Link>
      </div>
      {right.map(renderTab)}
    </nav>
  );
}

export default BottomNav;
