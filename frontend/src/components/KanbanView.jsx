import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { piecesAPI, phasesAPI, locationsAPI, imagesAPI } from '../services/api';
import { Button } from './ui/button';
import { useToast } from './ui/toast';
import ImageLightbox from './ImageLightbox';
import PhasePager from './kanban/PhasePager';
import KanbanMatrix from './kanban/KanbanMatrix';
import MoveSheet from './kanban/MoveSheet';
import { useIsMobile } from '../hooks/useMediaQuery';
import { usePieceMover } from '../hooks/usePieceMover';
import EmptyState from './EmptyState';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [lightbox, setLightbox] = useState(CLOSED_LIGHTBOX);

  const loadData = useCallback(async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setLoading(true);
      setError(null);
      const [piecesData, phasesData, locationsData] = await Promise.all([
        piecesAPI.getAll(),
        phasesAPI.getAll(),
        locationsAPI.getAll(),
      ]);
      setPieces(piecesData);
      setPhases([...phasesData].sort(byOrder));
      setLocations([...locationsData].sort(byOrder));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

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
      loadData({ quiet: true });
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

  return (
    <div className="kanban-view">
      <div className="actions-row">
        <div>
          <h2 className="page-title">Kanban</h2>
          <p className="page-subtitle">
            {pieces.length === 0
              ? 'Inga pjäser ännu'
              : `${pieces.length} pjäser · ${activeCount} pågående`}
          </p>
        </div>
        <Button asChild className="hide-below-lg">
          <Link to="/pieces/new">
            <Plus className="mr-2 h-4 w-4" />
            Ny pjäs
          </Link>
        </Button>
      </div>

      {error && (
        <div className="error" role="alert">
          {error}{' '}
          <button type="button" className="link-btn" onClick={() => loadData()}>
            Försök igen
          </button>
        </div>
      )}

      {!error && pieces.length === 0 ? (
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
        <PhasePager
          phases={phases}
          locations={locations}
          pieces={pieces}
          onSelectPiece={(piece) => setSelectedId(piece.id)}
        />
      ) : (
        <KanbanMatrix
          phases={phases}
          locations={locations}
          pieces={pieces}
          onMove={movePiece}
          onOpenImages={openImages}
        />
      )}

      <MoveSheet
        open={!!selectedPiece}
        onOpenChange={(open) => !open && setSelectedId(null)}
        piece={selectedPiece}
        phases={phases}
        locations={locations}
        onMove={movePiece}
        onOpenImages={(piece) => openImages(piece)}
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
