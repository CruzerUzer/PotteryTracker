import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { piecesAPI, phasesAPI, locationsAPI, materialsAPI, imagesAPI } from '../services/api';
import { Button } from './ui/button';
import { useToast } from './ui/toast';
import ImageLightbox from './ImageLightbox';
import PhasePager from './kanban/PhasePager';
import KanbanMatrix from './kanban/KanbanMatrix';
import MoveSheet from './kanban/MoveSheet';
import { useIsMobile } from '../hooks/useMediaQuery';
import { usePieceMover } from '../hooks/usePieceMover';
import EmptyState from './EmptyState';
import { usePieceFilters } from '../hooks/usePieceFilters';
import { FilterButton, ActiveFilterChips, PieceFilterSheet, sheetFilterCount } from './PieceFilters';

const byOrder = (a, b) => (a.display_order || 0) - (b.display_order || 0);

const CLOSED_LIGHTBOX = { isOpen: false, images: [], currentIndex: 0, pieceName: '', pieceId: null };

/**
 * Kanban. Mobil: en sida per fas med swipe och snabbark.
 * Desktop: matris plats × fas med drag-and-drop.
 */
function KanbanView() {
  const isMobile = useIsMobile();
  const toast = useToast();
  const [pieces, setPieces] = useState([]);
  const [phases, setPhases] = useState([]);
  const [locations, setLocations] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { filters, set, toggle, clearAll, searchInput, setSearchInput, apiParams, anyFilter } =
    usePieceFilters('kanban-filters');
  const requestId = useRef(0);
  const [loadedKey, setLoadedKey] = useState(null); // filtret som visade pjäser hör till
  const firstLoad = useRef(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [lightbox, setLightbox] = useState(CLOSED_LIGHTBOX);

  // Faser, platser och material en gång
  useEffect(() => {
    Promise.all([phasesAPI.getAll(), locationsAPI.getAll(), materialsAPI.getAll()])
      .then(([ph, loc, mat]) => {
        setPhases([...ph].sort(byOrder));
        setLocations([...loc].sort(byOrder));
        setMaterials(mat);
      })
      .catch((err) => setError(err.message));
  }, []);

  // Pjäserna laddas om när filtret ändras (fasen styrs av tavlan, inte filtret)
  const loadData = useCallback(async () => {
    const myId = ++requestId.current;
    try {
      if (firstLoad.current) setLoading(true);
      else setRefreshing(true);
      setError(null);
      const data = await piecesAPI.getAll({ ...apiParams, phase_id: null });
      if (myId !== requestId.current) return;
      setPieces(data);
      setLoadedKey(JSON.stringify(apiParams));
    } catch (err) {
      if (myId === requestId.current) setError(err.message);
    } finally {
      if (myId === requestId.current) {
        firstLoad.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [apiParams]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const patchPiece = useCallback(
    (id, patch) => setPieces((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    []
  );

  const movePiece = usePieceMover({ phases, locations, onPatch: patchPiece });

  const openImages = async (piece, e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    try {
      const images = await imagesAPI.getByPiece(piece.id);
      if (images.length > 0) {
        setLightbox({ isOpen: true, images, currentIndex: 0, pieceName: piece.name, pieceId: piece.id });
      }
    } catch (err) {
      toast.error('Kunde inte hämta bilderna', err.message);
    }
  };

  const handleLightboxDelete = async (imageId) => {
    try {
      await imagesAPI.delete(imageId);
      const images = lightbox.images.filter((img) => img.id !== imageId);
      if (images.length === 0) setLightbox(CLOSED_LIGHTBOX);
      else
        setLightbox((prev) => ({ ...prev, images, currentIndex: Math.min(prev.currentIndex, images.length - 1) }));
      loadData();
    } catch (err) {
      toast.error('Kunde inte ta bort bilden', err.message);
    }
  };

  const selectedPiece = pieces.find((p) => p.id === selectedId) || null;

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="flex items-center justify-between">
          <div className="skeleton h-8 w-32" />
          <div className="skeleton h-9 w-28 hide-below-lg" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-9 w-28 flex-shrink-0 rounded-full" />
          ))}
        </div>
        <div className="tile-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton tile-skeleton" />
          ))}
        </div>
      </div>
    );
  }

  const activeCount = pieces.filter((p) => p.done !== 1).length;
  const filterCount = sheetFilterCount(filters, { includeSearch: true });

  return (
    <div className="kanban-view">
      <div className="actions-row">
        <div>
          <h2 className="page-title">Kanban</h2>
          <p className="page-subtitle" aria-live="polite">
            {anyFilter
              ? `${pieces.length} ${pieces.length === 1 ? 'pjäs matchar' : 'pjäser matchar'}`
              : pieces.length === 0
                ? 'Inga pjäser ännu'
                : `${pieces.length} pjäser · ${activeCount} pågående`}
          </p>
        </div>
        <div className="actions-row-buttons">
          <FilterButton count={filterCount} onClick={() => setFilterOpen(true)} />
          <Button asChild className="hide-below-lg">
            <Link to="/pieces/new">
              <Plus className="mr-2 h-4 w-4" />
              Ny pjäs
            </Link>
          </Button>
        </div>
      </div>

      {filterCount > 0 && (
        <div className="chip-scroller kanban-active-filters">
          <div className="chip-row chip-row--nowrap">
            <ActiveFilterChips
              filters={filters}
              set={set}
              toggle={toggle}
              locations={locations}
              materials={materials}
              includeSearch
              onClearSearch={() => setSearchInput('')}
            />
            <button type="button" className="chip chip--muted" onClick={clearAll}>
              Rensa alla
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="error" role="alert">
          {error}{' '}
          <button type="button" className="link-btn" onClick={() => loadData()}>
            Försök igen
          </button>
        </div>
      )}

      {!error && pieces.length === 0 && anyFilter ? (
        <EmptyState
          title="Inget matchar"
          text="Inga pjäser passar filtret. Prova att rensa det."
          actionLabel="Rensa filter"
          onAction={clearAll}
          plus={false}
        />
      ) : !error && pieces.length === 0 ? (
        <EmptyState
          title="Din ateljé är tom"
          text="Lägg till din första pjäs så följer du den från drejskiva till färdig bränning."
          actionLabel="Lägg till din första pjäs"
          actionTo="/pieces/new"
        />
      ) : phases.length === 0 ? (
        <EmptyState
          title="Inga faser ännu"
          text="Kanban bygger på faser. Lägg upp dem under Arbetsflöde."
          actionLabel="Till Arbetsflöde"
          actionTo="/workflow"
          plus={false}
        />
      ) : isMobile ? (
        <div className={refreshing ? 'is-refreshing' : undefined}>
        <PhasePager
          phases={phases}
          locations={locations}
          pieces={pieces}
          onSelectPiece={(piece) => setSelectedId(piece.id)}
          jumpKey={loadedKey}
        />
        </div>
      ) : (
        <div className={refreshing ? 'is-refreshing' : undefined}>
        <KanbanMatrix
          phases={phases}
          locations={locations}
          pieces={pieces}
          onMove={movePiece}
          onOpenImages={openImages}
          hideEmptyLanes={anyFilter}
        />
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
        locations={locations}
        materials={materials}
        search={{ value: searchInput, onChange: setSearchInput }}
      />

      <MoveSheet
        open={!!selectedPiece}
        onOpenChange={(open) => !open && setSelectedId(null)}
        piece={selectedPiece}
        phases={phases}
        locations={locations}
        onMove={movePiece}
        onOpenImages={(piece) => {
          setSelectedId(null);
          openImages(piece);
        }}
      />

      {lightbox.isOpen && (
        <ImageLightbox
          images={lightbox.images}
          currentIndex={lightbox.currentIndex}
          onClose={() => setLightbox(CLOSED_LIGHTBOX)}
          onDelete={handleLightboxDelete}
          onNavigate={(i) => setLightbox((prev) => ({ ...prev, currentIndex: i }))}
          pieceName={lightbox.pieceName}
          showDelete
        />
      )}
    </div>
  );
}

export default KanbanView;
