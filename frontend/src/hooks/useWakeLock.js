import { useEffect } from 'react';

/** Håller skärmen tänd medan `active` är sant, om webbläsaren stöder det. */
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.wakeLock) return undefined;
    let lock = null;
    let cancelled = false;
    const request = async () => {
      try {
        if (document.visibilityState !== 'visible') return;
        lock = await navigator.wakeLock.request('screen');
        if (cancelled) lock.release().catch(() => {});
      } catch {
        /* nekad eller batterisparläge: tyst */
      }
    };
    const onVis = () => {
      if (document.visibilityState === 'visible' && (!lock || lock.released)) request();
    };
    request();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      lock?.release?.().catch(() => {});
    };
  }, [active]);
}
