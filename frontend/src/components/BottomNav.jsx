import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, List, Plus, Search, User, Shield } from 'lucide-react';

function BottomNav() {
  const location = useLocation();
  const { user, isAdmin } = useAuth();

  if (!user) return null;

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Kanban' },
    { path: '/list', icon: List, label: 'List' },
    { path: '/pieces/new', icon: Plus, label: 'Add' },
    { path: '/list', icon: Search, label: 'Search' }, // Search goes to list with filters
    ...(isAdmin ? [{ path: '/admin', icon: Shield, label: 'Admin' }] : []),
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/kanban';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="bottom-nav">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
          >
            <Icon className="nav-icon" size={20} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export default BottomNav;
