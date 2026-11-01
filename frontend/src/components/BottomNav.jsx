import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  LayoutDashboard,
  List,
  CheckCircle,
  BarChart2,
  MoreHorizontal,
  Settings,
  Database,
  Archive,
  Shield,
  Workflow,
  Plus,
  LogOut,
  Sun,
  Moon,
  MonitorSmartphone,
  ChevronRight,
} from 'lucide-react';
import { Sheet, SheetContent } from './ui/sheet';
import { FRONTEND_VERSION } from '../version';

export const MORE_ITEMS = [
  { path: '/stats', icon: BarChart2, label: 'Statistik', hint: 'Översikt och trender' },
  { path: '/workflow', icon: Workflow, label: 'Arbetsflöde', hint: 'Faser och platser' },
  { path: '/materials', icon: Database, label: 'Material', hint: 'Leror och glasyrer' },
  { path: '/backup', icon: Archive, label: 'Säkerhetskopia', hint: 'Export och import' },
  { path: '/settings', icon: Settings, label: 'Inställningar', hint: 'Konto och utseende' },
];

const THEME_OPTIONS = [
  { value: 'light', label: 'Ljust', icon: Sun },
  { value: 'dark', label: 'Mörkt', icon: Moon },
  { value: 'auto', label: 'Auto', icon: MonitorSmartphone },
];

export function isPathActive(pathname, path) {
  if (path === '/') return pathname === '/' || pathname === '/kanban';
  return pathname.startsWith(path);
}

function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();
  const { settings, updateSettings } = useTheme();
  const [moreOpen, setMoreOpen] = useState(false);

  // Stäng arket när användaren navigerar (t.ex. bakåt)
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  if (!user) return null;

  const moreItems = [
    ...MORE_ITEMS,
    ...(isAdmin ? [{ path: '/admin', icon: Shield, label: 'Admin', hint: 'Användare och arkiv' }] : []),
  ];

  const tabs = [
    { path: '/', icon: LayoutDashboard, label: 'Kanban' },
    { path: '/list', icon: List, label: 'Lista' },
    { path: '/done', icon: CheckCircle, label: 'Färdiga' },
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

  const moreActive = moreItems.some((item) => isPathActive(location.pathname, item.path));

  return (
    <>
      <nav className="bottom-nav" aria-label="Huvudmeny">
        {renderTab(tabs[0])}
        {renderTab(tabs[1])}
        <div className="nav-fab-slot">
          <Link
            to="/pieces/new"
            className={`nav-fab ${location.pathname === '/pieces/new' ? 'active' : ''}`}
            aria-label="Ny pjäs"
          >
            <Plus size={26} strokeWidth={2.2} />
          </Link>
        </div>
        {renderTab(tabs[2])}
        <button
          type="button"
          className={`nav-item ${moreActive || moreOpen ? 'active' : ''}`}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
        >
          <MoreHorizontal className="nav-icon" size={21} />
          <span>Mer</span>
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent title="Mer" className="more-sheet">
          <ul className="more-list">
            {moreItems.map((item) => {
              const Icon = item.icon;
              const active = isPathActive(location.pathname, item.path);
              return (
                <li key={item.path}>
                  <button
                    type="button"
                    className={`more-item ${active ? 'active' : ''}`}
                    onClick={() => {
                      setMoreOpen(false);
                      navigate(item.path);
                    }}
                  >
                    <span className="more-item-icon">
                      <Icon size={19} />
                    </span>
                    <span className="more-item-text">
                      <span className="more-item-label">{item.label}</span>
                      <span className="more-item-hint">{item.hint}</span>
                    </span>
                    <ChevronRight size={16} className="more-item-chevron" />
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="more-section">
            <span className="more-section-label">Tema</span>
            <div className="segmented" role="radiogroup" aria-label="Tema">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={settings.theme === value}
                  className={`segmented-item ${settings.theme === value ? 'active' : ''}`}
                  onClick={() => updateSettings({ theme: value })}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="more-logout"
            onClick={async () => {
              setMoreOpen(false);
              await logout();
            }}
          >
            <LogOut size={17} />
            Logga ut {user.username}
          </button>

          <p className="more-version">PotteryTracker v{FRONTEND_VERSION}</p>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default BottomNav;
