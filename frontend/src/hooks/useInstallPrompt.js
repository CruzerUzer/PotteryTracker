import { useState, useEffect, useCallback } from 'react';

// Delad PWA-install-logik som både install-bannern och knappen i Inställningar
// använder. beforeinstallprompt fyras bara EN gång tidigt i sidladdningen, så vi
// fångar den på modulnivå (vid import) och låter komponenter prenumerera.

let deferredPrompt = null;
let installedFlag = false;
const listeners = new Set();

function notify() {
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installedFlag = true;
    deferredPrompt = null;
    notify();
  });
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export function detectIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS 13+ rapporterar sig som Mac men har pekskärm
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function detectMobile() {
  if (typeof navigator === 'undefined') return false;
  return /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) || detectIOS();
}

export function useInstallPrompt() {
  const [, force] = useState(0);

  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return null;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    notify();
    return choice;
  }, []);

  return {
    // Android/Chromium: en install-prompt är fångad och redo
    canPromptInstall: !!deferredPrompt,
    // Redan installerad (körs i standalone-läge)
    standalone: isStandalone(),
    installed: installedFlag || isStandalone(),
    isIOS: detectIOS(),
    isMobile: detectMobile(),
    promptInstall,
  };
}
