import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import { piecesAPI, phasesAPI, locationsAPI, materialsAPI } from '../services/api';
import { Button } from './ui/button';
import { PieceLinkTile } from './kanban/PieceCard';
import { phaseColor } from './kanban/phaseColors';
import MoveSheet from './kanban/MoveSheet';
import EmptyState from './EmptyState';
import { usePieceMover } from '../hooks/usePieceMover';
import { usePieceFilters } from '../hooks/usePieceFilters';
import { FilterButton, ActiveFilterChips, PieceFilterSheet, MultiChips, sheetFilterCount } from './PieceFilters';

const byOrder = (a, b) => (a.display_order || 0) - (b.display_order || 0);

function PieceList() {
  const [pieces, setPieces] = useState([]);
  const [phases, setPhases] = useState([]);
  const [locations, setLocations] = useState([]);
  const [materials, setMaterials] = useState([]);
  const { filters, set, toggle, clearAll, searchInput, setSearchInput, apiParams, anyFilter } =
    usePieceFilters('list-filters');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
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

  const loadPieces = useCallback(async () => {
    try {
      if (firstLoad.current) setLoading(true);
      else setRefreshing(true);
      setError(null);
      const myId = ++requestId.current;
      const data = await piecesAPI.getAll(apiParams);
      if (myId !== requestId.current) return; // ett nyare filter hann före
      setPieces(data);
    } catch (err) {
      setError(err.message);
    } finally {
      firstLoad.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiParams]);

  useEffect(() => {
    loadPieces();
  }, [loadPieces]);

  const patchPiece = useCallback(
    (id, patch) => setPieces((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    []
  );
  const movePiece = usePieceMover({ phases, locations, onPatch: patchPiece });

  const filterCount = sheetFilterCount(filters);
  const phaseIndex = (id) => phases.findIndex((p) => p.id === id);
  const movingPiece = pieces.find((p) => p.id === moveId) || null;
  const hasChipFilters =
    filters.location.length > 0 || filters.material.length > 0 || !!(filters.dateFrom || filters.dateTo);

  const renderPhaseChips = () => (
    <MultiChips
      label="Fas"
      nowrap
      values={filters.phase}
      onToggle={(v) => toggle('phase', v)}
      onClear={() => set('phase', [])}
      options={[
        ...phases.map((p, i) => ({ value: String(p.id), label: p.name, dot: phaseColor(i).accent })),
        { value: 'no-phase', label: 'Utan fas', muted: true },
      ]}
    />
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
          <FilterButton count={filterCount} onClick={() => setFilterOpen(true)} />
        </div>
        <div className="chip-scroller">
          {renderPhaseChips()}
          {hasChipFilters && (
            <div className="chip-row chip-row--nowrap">
              <span className="chip-divider" aria-hidden="true" />
              <ActiveFilterChips filters={filters} set={set} toggle={toggle} locations={locations} materials={materials} />
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

      <PieceFilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        set={set}
        toggle={toggle}
        clearAll={clearAll}
        anyFilter={anyFilter}
        resultCount={pieces.length}
        phases={phases}
        locations={locations}
        materials={materials}
      />

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
