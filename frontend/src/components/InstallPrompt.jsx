import React, { useState } from 'react';
import { Button } from './ui/button';
import { Download, X } from 'lucide-react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import IOSInstallHelp from './IOSInstallHelp';

const DISMISS_KEY = 'pwaInstallDismissed';

function InstallPrompt() {
  const { canPromptInstall, standalone, isIOS, isMobile, promptInstall } = useInstallPrompt();
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(DISMISS_KEY));
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  // Visa bannern bara på mobil, om inte redan installerad/avvisad, och bara när
  // det finns en väg framåt (iOS-guide eller fångad Android-prompt).
  const show = !standalone && isMobile && !dismissed && (isIOS || canPromptInstall);

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, '1');
  };

  const handleInstall = () => {
    if (isIOS) {
      setShowIOSHelp(true);
    } else {
      promptInstall();
    }
  };

  if (!show) return null;

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

      <IOSInstallHelp open={showIOSHelp} onOpenChange={setShowIOSHelp} />
    </>
  );
}

export default InstallPrompt;
