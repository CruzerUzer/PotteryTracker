import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, List, CheckCircle, Search, MoreVertical, Settings, Database, FileDown, Shield } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();

  if (!user) return null;

  const mainNavItems = [
    { path: '/', icon: LayoutDashboard, label: 'Kanban' },
    { path: '/list', icon: List, label: 'List' },
    { path: '/done', icon: CheckCircle, label: 'Done' },
    { path: '/list', icon: Search, label: 'Search' }, // Search goes to list with filters
  ];

  const subMenuItems = [
    { path: '/workflow', icon: Settings, label: 'Workflow' },
    { path: '/materials', icon: Database, label: 'Materials' },
    { path: '/export', icon: FileDown, label: 'Export' },
    ...(isAdmin ? [{ path: '/admin', icon: Shield, label: 'Admin' }] : []),
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/kanban';
    }
    if (path === '/list') {
      return location.pathname === '/list' || location.pathname.startsWith('/pieces');
    }
    return location.pathname.startsWith(path);
  };

  const handleSubMenuItemClick = (path) => {
    navigate(path);
  };

  return (
    <div className="bottom-nav">
      {mainNavItems.map((item) => {
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={`nav-item ${subMenuItems.some(item => isActive(item.path)) ? 'active' : ''}`}>
            <MoreVertical className="nav-icon" size={20} />
            <span>More</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" className="mb-2">
          {subMenuItems.map((item) => {
            const Icon = item.icon;
            return (
              <DropdownMenuItem
                key={item.path}
                onClick={() => handleSubMenuItemClick(item.path)}
                className={isActive(item.path) ? 'bg-[var(--color-surface-hover)]' : ''}
              >
                <Icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default BottomNav;
