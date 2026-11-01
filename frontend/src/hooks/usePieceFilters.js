import { useCallback, useEffect, useMemo, useState } from 'react';

export const EMPTY_FILTERS = { phase: '', location: '', material: '', search: '', dateFrom: '', dateTo: '' };

function load(key) {
  if (!key) return EMPTY_FILTERS;
  try {
    return { ...EMPTY_FILTERS, ...JSON.parse(sessionStorage.getItem(key) || '{}') };
  } catch {
    return EMPTY_FILTERS;
  }
}

/**
 * Filterläge för pjäslistor. Sparas i sessionStorage (om nyckel ges) så att
 * filtret finns kvar när man går in på en pjäs och tillbaka.
 * Sökningen fördröjs lite så att varje tangenttryck inte laddar om.
 */
export function usePieceFilters(storageKey) {
  const [filters, setFilters] = useState(() => load(storageKey));
  const [searchInput, setSearchInput] = useState(() => load(storageKey).search);

  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput })), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(filters));
    } catch {
      /* privat läge */
    }
  }, [filters, storageKey]);

  const set = useCallback((key, value) => setFilters((f) => ({ ...f, [key]: value })), []);
  const clearAll = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setSearchInput('');
  }, []);

  const apiParams = useMemo(
    () => ({
      phase_id: filters.phase || null,
      location_id: filters.location || null,
      material_id: filters.material || null,
      search: filters.search || null,
      date_from: filters.dateFrom || null,
      date_to: filters.dateTo || null,
    }),
    [filters]
  );

  const anyFilter = Object.values(filters).some(Boolean) || !!searchInput;

  return { filters, set, clearAll, searchInput, setSearchInput, apiParams, anyFilter };
}

export default usePieceFilters;
