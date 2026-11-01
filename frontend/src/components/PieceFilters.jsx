import React, { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
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

/** Borttagbara chips för aktiva filter (plats, material, datum och ev. sökning). */
export function ActiveFilterChips({ filters, set, locations, materials, includeSearch = false, onClearSearch }) {
  const location =
    filters.location === 'no-location'
      ? { name: 'Ingen plats' }
      : locations.find((l) => String(l.id) === String(filters.location));
  const material = materials.find((m) => String(m.id) === String(filters.material));
  const chips = [
    includeSearch && filters.search && { key: 'search', label: `”${filters.search}”`, clear: onClearSearch },
    location && { key: 'location', label: location.name, clear: () => set('location', '') },
    material && { key: 'material', label: material.name, clear: () => set('material', '') },
    filters.dateFrom && { key: 'dateFrom', label: `Från ${formatDate(filters.dateFrom)}`, clear: () => set('dateFrom', '') },
    filters.dateTo && { key: 'dateTo', label: `Till ${formatDate(filters.dateTo)}`, clear: () => set('dateTo', '') },
  ].filter(Boolean);
  if (!chips.length) return null;
  return chips.map((c) => (
    <button key={c.key} type="button" className="chip chip--active" onClick={c.clear} aria-label={`Ta bort filter ${c.label}`}>
      {c.label}
      <X size={13} aria-hidden="true" />
    </button>
  ));
}

/** Antal filter som ställs in i arket (det som inte syns i verktygsraden). */
export function sheetFilterCount(filters, { includeSearch = false, includePhase = false } = {}) {
  return [
    includePhase && filters.phase,
    includeSearch && filters.search,
    filters.location,
    filters.material,
    filters.dateFrom,
    filters.dateTo,
  ].filter(Boolean).length;
}

function RadioChips({ label, options, value, onChange }) {
  return (
    <div className="chip-row" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const active = String(value) === String(o.value);
        return (
          <button
            key={o.value || 'all'}
            type="button"
            role="radio"
            aria-checked={active}
            className={`chip${active ? ' chip--active' : ''}${o.muted ? ' chip--muted' : ''}`}
            onClick={() => onChange(o.value)}
          >
            {o.dot && <span className="chip-dot" style={{ background: o.dot }} aria-hidden="true" />}
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
            <RadioChips
              label="Fas"
              value={filters.phase}
              onChange={(v) => set('phase', v)}
              options={[
                { value: '', label: 'Alla' },
                ...phases.map((p, i) => ({ value: String(p.id), label: p.name, dot: phaseColor(i).accent })),
                { value: 'no-phase', label: 'Utan fas', muted: true },
              ]}
            />
          </section>
        )}

        <section className="move-section">
          <h3 className="move-section-title">Plats</h3>
          <RadioChips
            label="Plats"
            value={filters.location}
            onChange={(v) => set('location', v)}
            options={[
              { value: '', label: 'Alla' },
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
          <RadioChips
            label="Material"
            value={filters.material}
            onChange={(v) => set('material', v)}
            options={[
              { value: '', label: 'Alla' },
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
