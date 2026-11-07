import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LogOut, MoreHorizontal, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import MoreSheet, { useMoreActive } from './MoreMenu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

/** Kompakt glas-header som krymper när sidan scrollas. */
function AppHeader() {
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = useMoreActive();
  const location = useLocation();
  const ref = useRef(null);

  // Stäng Mer-arket när användaren navigerar (t.ex. bakåt)
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  // Exponera headerns höjd som CSS-variabel så att fasta element kan lägga sig under den
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const set = () =>
      document.documentElement.style.setProperty('--app-header-h', `${el.getBoundingClientRect().height}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header ref={ref} className={`app-header${scrolled ? ' app-header--scrolled' : ''}`}>
      <div className="app-header-inner">
        <Link to="/" className="app-header-brand" aria-label="PotteryTracker, till Kanban">
          <Logo size={scrolled ? 22 : 26} />
          <h1>
            Pottery<span className="wordmark-accent">Tracker</span>
          </h1>
        </Link>
        <div className="app-header-actions">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="header-account" aria-label={`Konto: ${user.username}`}>
                <User size={16} />
                <span className="header-account-name">{user.username}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel className="truncate">{user.username}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={async () => {
                  await logout();
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
              >
                <LogOut size={16} />
                <span>Logga ut</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            className={`header-more${moreActive || moreOpen ? ' active' : ''}`}
            onClick={() => setMoreOpen(true)}
            aria-label="Mer"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>
      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </header>
  );
}

export default AppHeader;
