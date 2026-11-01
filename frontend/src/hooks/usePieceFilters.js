import { useCallback, useEffect, useMemo, useState } from 'react';

/** Flervalskategorier: listor av id (som strängar). Inom en kategori gäller "någon av". */
export const MULTI_KEYS = ['phase', 'location', 'material'];
export const EMPTY_FILTERS = { phase: [], location: [], material: [], search: '', dateFrom: '', dateTo: '' };

const asList = (v) => (Array.isArray(v) ? v.map(String) : v ? [String(v)] : []);

function load(key) {
  if (!key) return EMPTY_FILTERS;
  try {
    const saved = { ...EMPTY_FILTERS, ...JSON.parse(sessionStorage.getItem(key) || '{}') };
    MULTI_KEYS.forEach((k) => {
      saved[k] = asList(saved[k]); // äldre sparat filter hade ett enda värde
    });
    return saved;
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
  /** Slå av/på ett värde i en flervalskategori. */
  const toggle = useCallback(
    (key, value) =>
      setFilters((f) => {
        const v = String(value);
        return { ...f, [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] };
      }),
    []
  );
  const clearAll = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setSearchInput('');
  }, []);

  const apiParams = useMemo(
    () => ({
      phase_id: filters.phase.join(',') || null,
      location_id: filters.location.join(',') || null,
      material_id: filters.material.join(',') || null,
      search: filters.search || null,
      date_from: filters.dateFrom || null,
      date_to: filters.dateTo || null,
    }),
    [filters]
  );

  const anyFilter =
    MULTI_KEYS.some((k) => filters[k].length > 0) ||
    !!(filters.search || filters.dateFrom || filters.dateTo || searchInput);

  return { filters, set, toggle, clearAll, searchInput, setSearchInput, apiParams, anyFilter };
}

export default usePieceFilters;
