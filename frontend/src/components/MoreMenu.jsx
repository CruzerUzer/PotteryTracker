import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  BarChart2,
  Settings,
  Database,
  Archive,
  Shield,
  Workflow,
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

/** Är någon av Mer-menyns sidor öppen? Används för att markera knappen. */
export function useMoreActive() {
  const { pathname } = useLocation();
  const { isAdmin } = useAuth();
  return MORE_ITEMS.some((item) => isPathActive(pathname, item.path)) || (isAdmin && isPathActive(pathname, '/admin'));
}

/** Mer-arket: övriga sidor, tema och utloggning. Öppnas från knappen i headern. */
export default function MoreSheet({ open, onOpenChange }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, logout } = useAuth();
  const { settings, updateSettings } = useTheme();

  const moreItems = [
    ...MORE_ITEMS,
    ...(isAdmin ? [{ path: '/admin', icon: Shield, label: 'Admin', hint: 'Användare och arkiv' }] : []),
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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
                    onOpenChange(false);
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
            onOpenChange(false);
            await logout();
          }}
        >
          <LogOut size={17} />
          Logga ut {user.username}
        </button>

        <p className="more-version">PotteryTracker v{FRONTEND_VERSION}</p>
      </SheetContent>
    </Sheet>
  );
}
