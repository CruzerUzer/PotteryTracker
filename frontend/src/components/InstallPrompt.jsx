import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Download, Share, Plus, X } from 'lucide-react';

const DISMISS_KEY = 'pwaInstallDismissed';

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function detectIOS() {
  const ua = window.navigator.userAgent;
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ rapporterar sig som Mac men har pekskärm
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function detectMobile() {
  const ua = window.navigator.userAgent;
  return /android|iphone|ipad|ipod|mobile/i.test(ua) || detectIOS();
}

function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  const isIOS = detectIOS();

  useEffect(() => {
    // Redan installerad, inte mobil, eller tidigare avvisad → visa inget
    if (isStandalone() || !detectMobile() || localStorage.getItem(DISMISS_KEY)) {
      return;
    }

    if (isIOS) {
      // iOS/Safari saknar beforeinstallprompt – visa instruktionsknapp direkt
      setVisible(true);
      return;
    }

    // Android/Chromium: fånga install-prompten och visa knappen först då
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installed = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', installed);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installed);
    };
  }, [isIOS]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, '1');
  };

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSHelp(true);
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      setDeferredPrompt(null);
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)',
          zIndex: 1000,
          width: 'calc(100% - 24px)',
          maxWidth: '420px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 14px',
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
        }}
        role="dialog"
        aria-label="Installera appen"
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-primary-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Download size={20} color="var(--color-primary)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.9rem' }}>
            Installera PotteryTracker
          </div>
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.78rem' }}>
            Lägg till på hemskärmen som en app.
          </div>
        </div>
        <Button size="sm" onClick={handleInstall}>
          Installera
        </Button>
        <button
          onClick={dismiss}
          aria-label="Stäng"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-tertiary)',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            flexShrink: 0,
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* iOS: kan inte installeras programmatiskt – visa steg-för-steg */}
      <Dialog open={showIOSHelp} onOpenChange={setShowIOSHelp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Lägg till på hemskärmen</DialogTitle>
            <DialogDescription>
              Så här installerar du PotteryTracker som app på din iPhone eller iPad.
            </DialogDescription>
          </DialogHeader>
          <ol style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0', margin: 0, listStyle: 'none' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Share size={20} color="var(--color-primary)" style={{ flexShrink: 0 }} />
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                Tryck på <strong>Dela</strong>-ikonen i verktygsfältet.
              </span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Plus size={20} color="var(--color-primary)" style={{ flexShrink: 0 }} />
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                Välj <strong>Lägg till på hemskärmen</strong> i listan.
              </span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 20,
                  height: 20,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  color: 'var(--color-primary)',
                }}
              >
                ✓
              </span>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                Tryck på <strong>Lägg till</strong> – klart!
              </span>
            </li>
          </ol>
          <DialogFooter>
            <Button onClick={() => setShowIOSHelp(false)}>Stäng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default InstallPrompt;
