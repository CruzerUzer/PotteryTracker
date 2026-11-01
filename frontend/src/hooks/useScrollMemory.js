import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Flikar vars scrollposition minns även när man navigerar dit via menyn.
const TAB_PATHS = new Set(['/', '/list', '/done']);

const positions = new Map();

/** Återställ scroll när innehållet hunnit bli tillräckligt högt (data laddas asynkront). */
function restore(y) {
  let frames = 0;
  let raf = 0;
  const tick = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max >= y - 2 || frames > 90) {
      window.scrollTo(0, y);
      return;
    }
    frames += 1;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

/**
 * Minns scrollposition per historikpost (bakåt/framåt) och per flik
 * (Kanban, Lista, Färdiga). Ny sida i övrigt börjar överst.
 */
export function useScrollMemory() {
  const location = useLocation();
  const navType = useNavigationType();
  const current = useRef({ key: location.key, path: location.pathname });

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual';
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const { key, path } = current.current;
        positions.set(`key:${key}`, window.scrollY);
        if (TAB_PATHS.has(path)) positions.set(`path:${path}`, window.scrollY);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  useLayoutEffect(() => {
    current.current = { key: location.key, path: location.pathname };
    const byKey = positions.get(`key:${location.key}`);
    const byPath = positions.get(`path:${location.pathname}`);
    let cancel;
    if (navType === 'POP' && byKey != null) cancel = restore(byKey);
    else if (TAB_PATHS.has(location.pathname) && byPath != null) cancel = restore(byPath);
    else window.scrollTo(0, 0);
    return cancel; // ny navigering avbryter en pågående återställning
  }, [location.key, location.pathname, navType]);
}

export default useScrollMemory;
