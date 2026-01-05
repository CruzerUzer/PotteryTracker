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
    </div>
  );
}

export default Sidebar;
