import React, { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X, Check } from 'lucide-react';
import { Sheet, SheetContent } from './ui/sheet';
import { MATERIAL_TYPE_LABELS } from './MaterialPicker';
import { phaseColor } from './kanban/phaseColors';

const formatDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });

/** Filterknapp med antal aktiva filter. */
export function FilterButton({ count, onClick }) {
  return (
    <button
      type="button"
      className={`filter-button${count ? ' filter-button--active' : ''}`}
      onClick={onClick}
      aria-label={`Filter${count ? `, ${count} aktiva` : ''}`}
    >
      <SlidersHorizontal size={17} />
      <span className="filter-button-label">Filter</span>
      {count > 0 && <span className="filter-badge">{count}</span>}
    </button>
  );
}

/** Borttagbara chips för aktiva filter (ett per valt värde, plus datum och ev. sökning). */
export function ActiveFilterChips({
  filters,
  set,
  toggle,
  locations,
  materials,
  phases,
  includeSearch = false,
  onClearSearch,
}) {
  const locName = (id) => (id === 'no-location' ? 'Ingen plats' : locations.find((l) => String(l.id) === id)?.name);
  const matName = (id) => materials.find((m) => String(m.id) === id)?.name;
  const phaseName = (id) => (id === 'no-phase' ? 'Utan fas' : phases?.find((p) => String(p.id) === id)?.name);
  const chips = [
    includeSearch && filters.search && { key: 'search', label: `”${filters.search}”`, clear: onClearSearch },
    ...(phases ? filters.phase.map((id) => ({ key: `p${id}`, label: phaseName(id), clear: () => toggle('phase', id) })) : []),
    ...filters.location.map((id) => ({ key: `l${id}`, label: locName(id), clear: () => toggle('location', id) })),
    ...filters.material.map((id) => ({ key: `m${id}`, label: matName(id), clear: () => toggle('material', id) })),
    filters.dateFrom && { key: 'dateFrom', label: `Från ${formatDate(filters.dateFrom)}`, clear: () => set('dateFrom', '') },
    filters.dateTo && { key: 'dateTo', label: `Till ${formatDate(filters.dateTo)}`, clear: () => set('dateTo', '') },
  ].filter((c) => c && c.label);
  if (!chips.length) return null;
  return chips.map((c) => (
    <button key={c.key} type="button" className="chip chip--active" onClick={c.clear} aria-label={`Ta bort filter ${c.label}`}>
      {c.label}
      <X size={13} aria-hidden="true" />
    </button>
  ));
}

/** Antal valda filtervärden som ställs in i arket. */
export function sheetFilterCount(filters, { includeSearch = false, includePhase = false } = {}) {
  return (
    (includePhase ? filters.phase.length : 0) +
    filters.location.length +
    filters.material.length +
    [includeSearch && filters.search, filters.dateFrom, filters.dateTo].filter(Boolean).length
  );
}

/** Flervalschips: "Alla" rensar kategorin, övriga slås av och på. */
export function MultiChips({ label, options, values, onToggle, onClear, nowrap = false }) {
  return (
    <div className={`chip-row${nowrap ? ' chip-row--nowrap' : ''}`} role="group" aria-label={label}>
      <button
        type="button"
        className={`chip${values.length === 0 ? ' chip--active' : ''}`}
        aria-pressed={values.length === 0}
        onClick={onClear}
      >
        Alla
      </button>
      {options.map((o) => {
        const on = values.includes(String(o.value));
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            className={`chip${on ? ' chip--active' : ''}${o.muted && !on ? ' chip--muted' : ''}`}
            onClick={() => onToggle(String(o.value))}
          >
            {on ? (
              <Check size={13} aria-hidden="true" />
            ) : (
              o.dot && <span className="chip-dot" style={{ background: o.dot }} aria-hidden="true" />
            )}
            {o.label}
            {o.note && <span className="chip-note">{o.note}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Filterark för Lista och Kanban.
 * phases: visa fasval (Lista). search: { value, onChange } visar sökfält (Kanban).
 */
export function PieceFilterSheet({
  open,
  onOpenChange,
  filters,
  set,
  toggle,
  clearAll,
  anyFilter,
  resultCount,
  phases,
  locations,
  materials,
  search,
}) {
  const [materialQuery, setMaterialQuery] = useState('');
  const filteredMaterials = useMemo(() => {
    const q = materialQuery.trim().toLowerCase();
    return materials.filter((m) => !q || m.name.toLowerCase().includes(q));
  }, [materials, materialQuery]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title="Filter"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={clearAll} disabled={!anyFilter}>
              Rensa allt
            </button>
            <button type="button" className="btn btn-primary" onClick={() => onOpenChange(false)}>
              Visa {resultCount} {resultCount === 1 ? 'pjäs' : 'pjäser'}
            </button>
          </>
        }
      >
        {search && (
          <section className="move-section">
            <h3 className="move-section-title">Sök</h3>
            <label className="search-field">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                placeholder="Namn eller beskrivning…"
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                aria-label="Sök pjäser"
                enterKeyHint="search"
              />
            </label>
          </section>
        )}

        {phases && (
          <section className="move-section">
            <h3 className="move-section-title">Fas</h3>
            <MultiChips
              label="Fas"
              values={filters.phase}
              onToggle={(v) => toggle('phase', v)}
              onClear={() => set('phase', [])}
              options={[
              ...phases.map((p, i) => ({ value: String(p.id), label: p.name, dot: phaseColor(i).accent })),
                { value: 'no-phase', label: 'Utan fas', muted: true },
              ]}
            />
          </section>
        )}

        <section className="move-section">
          <h3 className="move-section-title">Plats</h3>
          <MultiChips
              label="Plats"
              values={filters.location}
              onToggle={(v) => toggle('location', v)}
              onClear={() => set('location', [])}
              options={[
              ...locations.map((l) => ({ value: String(l.id), label: l.name })),
              { value: 'no-location', label: 'Ingen plats', muted: true },
            ]}
          />
        </section>

        <section className="move-section">
          <h3 className="move-section-title">Material</h3>
          {materials.length > 8 && (
            <label className="search-field">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                placeholder="Sök material…"
                value={materialQuery}
                onChange={(e) => setMaterialQuery(e.target.value)}
                aria-label="Sök material"
              />
            </label>
          )}
          <MultiChips
              label="Material"
              values={filters.material}
              onToggle={(v) => toggle('material', v)}
              onClear={() => set('material', [])}
              options={[
              ...filteredMaterials.map((m) => ({
                value: String(m.id),
                label: m.name,
                note: MATERIAL_TYPE_LABELS[m.type] || m.type,
              })),
            ]}
          />
        </section>

        <section className="move-section">
          <h3 className="move-section-title">Skapad</h3>
          <div className="date-range">
            <label className="field">
              <span className="field-sublabel">Från</span>
              <input
                type="date"
                className="field-input"
                value={filters.dateFrom}
                max={filters.dateTo || undefined}
                onChange={(e) => set('dateFrom', e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field-sublabel">Till</span>
              <input
                type="date"
                className="field-input"
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={(e) => set('dateTo', e.target.value)}
              />
            </label>
          </div>
        </section>
      </SheetContent>
    </Sheet>
  );
}
