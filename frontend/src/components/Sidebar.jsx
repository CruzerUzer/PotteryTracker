import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  List, 
  CheckCircle, 
  Settings, 
  Database, 
  FileDown, 
  LogOut 
} from 'lucide-react';

function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Kanban' },
    { path: '/list', icon: List, label: 'List' },
    { path: '/done', icon: CheckCircle, label: 'Done' },
    { path: '/phases', icon: Settings, label: 'Phases' },
    { path: '/materials', icon: Database, label: 'Materials' },
    { path: '/export', icon: FileDown, label: 'Export' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/kanban';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="sidebar">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
          >
            <Icon className="sidebar-icon" size={20} />
            <span>{item.label}</span>
          </Link>
        );
      })}
      {user && (
        <button
          onClick={handleLogout}
          className="sidebar-item"
          style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <LogOut className="sidebar-icon" size={20} />
          <span>Logout</span>
        </button>
      )}
    </div>
  );
}

export default Sidebar;
