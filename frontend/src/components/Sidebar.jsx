import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  const navItems = [
    { path: '/', icon: '🏠', label: 'Kanban' },
    { path: '/list', icon: '📋', label: 'List' },
    { path: '/done', icon: '✅', label: 'Done' },
    { path: '/phases', icon: '⚙️', label: 'Phases' },
    { path: '/materials', icon: '📊', label: 'Materials' },
    { path: '/export', icon: '🎨', label: 'Export' },
    { path: '/settings', icon: '⚙️', label: 'Settings' },
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/kanban';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="sidebar">
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
        >
          <span className="sidebar-icon">{item.icon}</span>
          <span>{item.label}</span>
        </Link>
      ))}
      {user && (
        <button
          onClick={handleLogout}
          className="sidebar-item"
          style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <span className="sidebar-icon">🚪</span>
          <span>Logout</span>
        </button>
      )}
    </div>
  );
}

export default Sidebar;



