import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();

  if (!user) return null;

  const navItems = [
    { path: '/', icon: '🏠', label: 'Kanban' },
    { path: '/list', icon: '📋', label: 'List' },
    { path: '/pieces/new', icon: '➕', label: 'Add' },
    { path: '/list', icon: '🔍', label: 'Search' }, // Search goes to list with filters
    { path: '/settings', icon: '👤', label: 'Profile' },
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/kanban';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="bottom-nav">
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
        >
          <span className="nav-icon">{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}
    </div>
  );
}

export default BottomNav;

