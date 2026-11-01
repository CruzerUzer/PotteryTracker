import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Check, X } from 'lucide-react';

export const MATERIAL_TYPE_LABELS = { clay: 'Lera', glaze: 'Glasyr', other: 'Övrigt' };

/**
 * Sökbar materialväljare med chips, grupperad per typ.
 * value: array av material-id. onChange(nyArray).
 */
function MaterialPicker({ materials, value, onChange, disabled = false }) {
  const [query, setQuery] = useState('');
  const selected = new Set(value);

  const toggle = (id) => {
    if (disabled) return;
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (m) => !q || m.name.toLowerCase().includes(q);
    return ['clay', 'glaze', 'other']
      .map((type) => ({
        type,
        label: MATERIAL_TYPE_LABELS[type],
        items: materials.filter((m) => (m.type || 'other') === type && match(m)),
      }))
      .concat(
        // Okända typer hamnar under Övrigt-liknande grupp sist
        [
          {
            type: 'unknown',
            label: 'Annat',
            items: materials.filter((m) => m.type && !MATERIAL_TYPE_LABELS[m.type] && match(m)),
          },
        ]
      )
      .filter((g) => g.items.length > 0);
  }, [materials, query]);

  if (materials.length === 0) {
    return (
      <p className="field-hint">
        Inga material upplagda ännu. Lägg till leror och glasyrer under <Link to="/materials">Material</Link>.
      </p>
    );
  }

  const chosen = materials.filter((m) => selected.has(m.id));

  return (
    <div className="material-picker">
      {chosen.length > 0 && (
        <div className="chip-row material-picker-selected" aria-label="Valda material">
          {chosen.map((m) => (
            <button
              key={m.id}
              type="button"
              className="chip chip--active"
              onClick={() => toggle(m.id)}
              disabled={disabled}
              aria-label={`Ta bort ${m.name}`}
            >
              {m.name}
              <X size={13} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      {materials.length > 6 && (
        <label className="search-field">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Sök material…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Sök material"
          />
        </label>
      )}

      {groups.length === 0 ? (
        <p className="field-hint">Inget material matchar ”{query}”.</p>
      ) : (
        groups.map((g) => (
          <div key={g.type} className="material-picker-group">
            <span className="field-sublabel">{g.label}</span>
            <div className="chip-row">
              {g.items.map((m) => {
                const on = selected.has(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    className={`chip${on ? ' chip--selected' : ''}`}
                    onClick={() => toggle(m.id)}
                    disabled={disabled}
                  >
                    {on && <Check size={13} aria-hidden="true" />}
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default MaterialPicker;
