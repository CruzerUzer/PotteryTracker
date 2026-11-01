import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { piecesAPI, phasesAPI, locationsAPI, materialsAPI } from '../services/api';
import { Button } from './ui/button';
import { Sheet, SheetContent } from './ui/sheet';
import { PieceLinkTile } from './kanban/PieceCard';
import { phaseColor } from './kanban/phaseColors';
import MoveSheet from './kanban/MoveSheet';
import EmptyState from './EmptyState';
import { MATERIAL_TYPE_LABELS } from './MaterialPicker';
import { usePieceMover } from '../hooks/usePieceMover';

const byOrder = (a, b) => (a.display_order || 0) - (b.display_order || 0);
const EMPTY_FILTERS = { phase: '', material: '', search: '', dateFrom: '', dateTo: '' };

const formatDate = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });

function PieceList() {
  const [pieces, setPieces] = useState([]);
  const [phases, setPhases] = useState([]);
  const [locations, setLocations] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [materialQuery, setMaterialQuery] = useState('');
  const [moveId, setMoveId] = useState(null);
  const firstLoad = useRef(true);
  const requestId = useRef(0);

  // Referensdata en gång
  useEffect(() => {
    Promise.all([phasesAPI.getAll(), locationsAPI.getAll(), materialsAPI.getAll()])
      .then(([ph, loc, mat]) => {
        setPhases([...ph].sort(byOrder));
        setLocations([...loc].sort(byOrder));
        setMaterials(mat);
      })
      .catch((err) => setError(err.message));
  }, []);

  // Sökning med liten fördröjning så att varje tangenttryck inte laddar om
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput })), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const loadPieces = useCallback(async () => {
    try {
      if (firstLoad.current) setLoading(true);
      else setRefreshing(true);
      setError(null);
      const myId = ++requestId.current;
      const data = await piecesAPI.getAll({
        phase_id: filters.phase || null,
        material_id: filters.material || null,
        search: filters.search || null,
        date_from: filters.dateFrom || null,
        date_to: filters.dateTo || null,
      });
      if (myId !== requestId.current) return; // ett nyare filter hann före
      setPieces(data);
    } catch (err) {
      setError(err.message);
    } finally {
      firstLoad.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters]);

  useEffect(() => {
    loadPieces();
  }, [loadPieces]);

  const patchPiece = useCallback(
    (id, patch) => setPieces((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    []
  );
  const movePiece = usePieceMover({ phases, locations, onPatch: patchPiece });

  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setSearchInput('');
  };

  const sheetFilterCount = [filters.material, filters.dateFrom, filters.dateTo].filter(Boolean).length;
  const anyFilter = Object.values(filters).some(Boolean) || !!searchInput;
  const phaseIndex = (id) => phases.findIndex((p) => p.id === id);
  const material = materials.find((m) => String(m.id) === String(filters.material));
  const movingPiece = pieces.find((p) => p.id === moveId) || null;

  const filteredMaterials = useMemo(() => {
    const q = materialQuery.trim().toLowerCase();
    return materials.filter((m) => !q || m.name.toLowerCase().includes(q));
  }, [materials, materialQuery]);

  const phaseChips = [
    { value: '', label: 'Alla' },
    ...phases.map((p, i) => ({ value: String(p.id), label: p.name, color: phaseColor(i) })),
    { value: 'no-phase', label: 'Utan fas' },
  ];

  const renderPhaseChips = (className = '') => (
    <div className={`chip-row ${className}`} role="radiogroup" aria-label="Fas">
      {phaseChips.map((c) => {
        const active = filters.phase === c.value;
        return (
          <button
            key={c.value || 'all'}
            type="button"
            role="radio"
            aria-checked={active}
            className={`chip${active ? ' chip--active' : ''}`}
            onClick={() => set('phase', c.value)}
          >
            {c.color && <span className="chip-dot" style={{ background: c.color.accent }} aria-hidden="true" />}
            {c.label}
          </button>
        );
      })}
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="skeleton h-8 w-40" />
        <div className="skeleton h-11 w-full rounded-full" />
        <div className="tile-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton tile-skeleton" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="piece-list-view">
      <div className="actions-row">
        <div>
          <h2 className="page-title">Alla pjäser</h2>
          <p className="page-subtitle" aria-live="polite">
            {pieces.length === 1 ? '1 pjäs' : `${pieces.length} pjäser`}
            {anyFilter ? ' som matchar' : ''}
          </p>
        </div>
        <Button asChild className="hide-below-lg">
          <Link to="/pieces/new">
            <Plus className="mr-2 h-4 w-4" />
            Ny pjäs
          </Link>
        </Button>
      </div>

      <div className="list-toolbar">
        <div className="list-toolbar-row">
          <label className="search-field search-field--pill">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              placeholder="Sök på namn eller beskrivning…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Sök pjäser"
              enterKeyHint="search"
            />
            {searchInput && (
              <button type="button" className="search-clear" onClick={() => setSearchInput('')} aria-label="Rensa sökning">
                <X size={15} />
              </button>
            )}
          </label>
          <button
            type="button"
            className={`filter-button${sheetFilterCount ? ' filter-button--active' : ''}`}
            onClick={() => setFilterOpen(true)}
            aria-label={`Filter${sheetFilterCount ? `, ${sheetFilterCount} aktiva` : ''}`}
          >
            <SlidersHorizontal size={17} />
            <span className="filter-button-label">Filter</span>
            {sheetFilterCount > 0 && <span className="filter-badge">{sheetFilterCount}</span>}
          </button>
        </div>
        <div className="chip-scroller">
          {renderPhaseChips('chip-row--nowrap')}
          {(material || filters.dateFrom || filters.dateTo) && (
            <div className="chip-row chip-row--nowrap">
              <span className="chip-divider" aria-hidden="true" />
              {material && (
                <button type="button" className="chip chip--active" onClick={() => set('material', '')}>
                  {material.name}
                  <X size={13} aria-label="Ta bort filter" />
                </button>
              )}
              {filters.dateFrom && (
                <button type="button" className="chip chip--active" onClick={() => set('dateFrom', '')}>
                  Från {formatDate(filters.dateFrom)}
                  <X size={13} aria-label="Ta bort filter" />
                </button>
              )}
              {filters.dateTo && (
                <button type="button" className="chip chip--active" onClick={() => set('dateTo', '')}>
                  Till {formatDate(filters.dateTo)}
                  <X size={13} aria-label="Ta bort filter" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {pieces.length === 0 ? (
        anyFilter ? (
          <EmptyState
            title="Inget matchar"
            text="Inga pjäser passar filtren. Prova att rensa dem."
            actionLabel="Rensa filter"
            onAction={clearAll}
            plus={false}
          />
        ) : (
          <EmptyState
            title="Inga pjäser ännu"
            text="Lägg till din första pjäs så dyker den upp här."
            actionLabel="Lägg till din första pjäs"
            actionTo="/pieces/new"
          />
        )
      ) : (
        <div className={`tile-grid${refreshing ? ' is-refreshing' : ''}`}>
          {pieces.map((piece) => (
            <PieceLinkTile
              key={piece.id}
              piece={piece}
              phaseIndex={phaseIndex(piece.current_phase_id)}
              phaseColorOf={(i) => (i >= 0 ? phaseColor(i) : null)}
              onMove={(p) => setMoveId(p.id)}
            />
          ))}
        </div>
      )}

      <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
        <SheetContent
          title="Filter"
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={clearAll} disabled={!anyFilter}>
                Rensa allt
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setFilterOpen(false)}>
                Visa {pieces.length} {pieces.length === 1 ? 'pjäs' : 'pjäser'}
              </button>
            </>
          }
        >
          <section className="move-section">
            <h3 className="move-section-title">Fas</h3>
            {renderPhaseChips()}
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
            <div className="chip-row" role="radiogroup" aria-label="Material">
              <button
                type="button"
                role="radio"
                aria-checked={!filters.material}
                className={`chip${!filters.material ? ' chip--active' : ''}`}
                onClick={() => set('material', '')}
              >
                Alla
              </button>
              {filteredMaterials.map((m) => {
                const active = String(filters.material) === String(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`chip${active ? ' chip--active' : ''}`}
                    onClick={() => set('material', String(m.id))}
                  >
                    {m.name}
                    <span className="chip-note">{MATERIAL_TYPE_LABELS[m.type] || m.type}</span>
                  </button>
                );
              })}
            </div>
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

      <MoveSheet
        open={!!movingPiece}
        onOpenChange={(open) => !open && setMoveId(null)}
        piece={movingPiece}
        phases={phases}
        locations={locations}
        onMove={movePiece}
      />
    </div>
  );
}

export default PieceList;
