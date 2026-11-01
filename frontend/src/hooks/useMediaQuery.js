import { useEffect, useState } from 'react';

const query = (q) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q) : null);

export function useMediaQuery(q) {
  const [matches, setMatches] = useState(() => !!query(q)?.matches);
  useEffect(() => {
    const mql = query(q);
    if (!mql) return undefined;
    const onChange = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, [q]);
  return matches;
}

/** Mobil och surfplatta i stående: samma brytpunkt som bottennaven. */
export const useIsMobile = () => useMediaQuery('(max-width: 1023px)');

export default useMediaQuery;
