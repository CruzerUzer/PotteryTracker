import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { piecesAPI, phasesAPI, locationsAPI, imagesAPI } from '../services/api';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Plus, Package, Image as ImageIcon, ChevronDown, ChevronUp, ChevronRight, MapPin } from 'lucide-react';
import ImageLightbox from './ImageLightbox';

function KanbanView() {
  const [pieces, setPieces] = useState([]);
  const [phases, setPhases] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggedPiece, setDraggedPiece] = useState(null);
  const [dragOverCell, setDragOverCell] = useState(null); // { phaseId, locationId }
  const [isDragging, setIsDragging] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchElement, setTouchElement] = useState(null);
  const [touchTimer, setTouchTimer] = useState(null);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [collapsedLanes, setCollapsedLanes] = useState(() => {
    try {
      const saved = localStorage.getItem('kanban-collapsed-lanes');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [collapsedColumns, setCollapsedColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('kanban-collapsed-columns');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [lightboxState, setLightboxState] = useState({
    isOpen: false,
    images: [],
    currentIndex: 0,
    pieceName: '',
    pieceId: null
  });
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [piecesData, phasesData, locationsData] = await Promise.all([
        piecesAPI.getAll(),
        phasesAPI.getAll(),
        locationsAPI.getAll(),
      ]);
      setPieces(piecesData);
      const sortedPhases = phasesData.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      const sortedLocations = locationsData.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      setPhases(sortedPhases);
      setLocations(sortedLocations);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Get pieces for a specific phase and location combination
  const getPiecesForCell = (phaseId, locationId) => {
    return pieces.filter(p => {
      const phaseMatch = phaseId ? p.current_phase_id === phaseId : !p.current_phase_id;
      const locationMatch = locationId === null
        ? !p.current_location_id
        : p.current_location_id === locationId;
      return phaseMatch && locationMatch;
    });
  };

  // Get count of pieces in a location (across all phases)
  const getPiecesCountForLocation = (locationId) => {
    if (locationId === null) {
      return pieces.filter(p => !p.current_location_id).length;
    }
    return pieces.filter(p => p.current_location_id === locationId).length;
  };

  const toggleLaneCollapse = (locationId) => {
    setCollapsedLanes(prev => {
      const newSet = new Set(prev);
      const key = locationId === null ? 'no-location' : locationId;
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      try { localStorage.setItem('kanban-collapsed-lanes', JSON.stringify([...newSet])); } catch {}
      return newSet;
    });
  };

  const isLaneCollapsed = (locationId) => {
    const key = locationId === null ? 'no-location' : locationId;
    return collapsedLanes.has(key);
  };

  const toggleColumnCollapse = (phaseId) => {
    setCollapsedColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(phaseId)) {
        newSet.delete(phaseId);
      } else {
        newSet.add(phaseId);
      }
      try { localStorage.setItem('kanban-collapsed-columns', JSON.stringify([...newSet])); } catch {}
      return newSet;
    });
  };

  const isColumnCollapsed = (phaseId) => {
    return collapsedColumns.has(phaseId);
  };

  // Open lightbox for a piece's images
  const openLightbox = async (piece, e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isDragging) return;

    try {
      const images = await imagesAPI.getByPiece(piece.id);
      if (images.length > 0) {
        setLightboxState({
          isOpen: true,
          images,
          currentIndex: 0,
          pieceName: piece.name,
          pieceId: piece.id
        });
      }
    } catch (err) {
      console.error('Failed to load images:', err);
    }
  };

  // Close lightbox
  const closeLightbox = () => {
    setLightboxState({
      isOpen: false,
      images: [],
      currentIndex: 0,
      pieceName: '',
      pieceId: null
    });
  };

  // Handle image deletion from lightbox
  const handleLightboxDelete = async (imageId) => {
    try {
      await imagesAPI.delete(imageId);

      // Update lightbox images
      const newImages = lightboxState.images.filter(img => img.id !== imageId);

      if (newImages.length === 0) {
        closeLightbox();
      } else {
        const newIndex = Math.min(lightboxState.currentIndex, newImages.length - 1);
        setLightboxState(prev => ({
          ...prev,
          images: newImages,
          currentIndex: newIndex
        }));
      }

      // Reload data to update piece thumbnails/counts
      loadData();
    } catch (err) {
      console.error('Failed to delete image:', err);
      setError(err.message);
    }
  };

  // Handle lightbox navigation
  const handleLightboxNavigate = (newIndex) => {
    setLightboxState(prev => ({
      ...prev,
      currentIndex: newIndex
    }));
  };

  const handleDragStart = (e, piece) => {
    if (e.target.closest('a') || e.target.tagName === 'IMG') {
      e.stopPropagation();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setDragPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setDraggedPiece(piece);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', piece.id.toString());
  };

  const handleDragOver = (e, phaseId, locationId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedPiece) {
      setDragOverCell({ phaseId, locationId });
    }
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = async (e, targetPhaseId, targetLocationId) => {
    e.preventDefault();
    setDragOverCell(null);

    if (!draggedPiece) return;

    const phaseChanged = draggedPiece.current_phase_id !== targetPhaseId;
    const locationChanged = draggedPiece.current_location_id !== targetLocationId;

    if (!phaseChanged && !locationChanged) {
      setIsDragging(false);
      setDraggedPiece(null);
      return;
    }

    try {
      // Update phase and/or location
      const promises = [];
      if (phaseChanged) {
        promises.push(piecesAPI.updatePhase(draggedPiece.id, targetPhaseId || null));
      }
      if (locationChanged) {
        promises.push(piecesAPI.updateLocation(draggedPiece.id, targetLocationId || null));
      }
      await Promise.all(promises);

      setPieces(prevPieces =>
        prevPieces.map(piece =>
          piece.id === draggedPiece.id
            ? {
                ...piece,
                current_phase_id: targetPhaseId || null,
                current_location_id: targetLocationId || null
              }
            : piece
        )
      );

      setIsDragging(false);
      setDraggedPiece(null);
    } catch (err) {
      setError(err.message);
      setIsDragging(false);
      setDraggedPiece(null);
      loadData();
    }
  };

  const handleDragEnd = () => {
    setTimeout(() => {
      setIsDragging(false);
    }, 100);
    setDraggedPiece(null);
    setDragOverCell(null);
  };

  // Touch event handlers for mobile drag-and-drop
  const handleTouchStart = (e, piece) => {
    e.preventDefault();
    e.stopPropagation();

    const preventContextMenu = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    e.currentTarget.addEventListener('contextmenu', preventContextMenu, { once: true });

    const touch = e.touches[0];
    const startTime = Date.now();

    // Check if touch started on image area
    const touchedElement = document.elementFromPoint(touch.clientX, touch.clientY);
    const isImageArea = touchedElement?.closest('[data-image-area="true"]') !== null;

    setTouchStart({
      x: touch.clientX,
      y: touch.clientY,
      piece: piece,
      time: startTime,
      isImageArea: isImageArea
    });
    setTouchElement(e.currentTarget);

    const timer = setTimeout(() => {
      setDraggedPiece(piece);
      setIsDragging(true);
      setDragPosition({ x: touch.clientX, y: touch.clientY });
    }, 300);

    setTouchTimer(timer);
  };

  const handleTouchMove = (e) => {
    if (!touchStart) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStart.x);
    const deltaY = Math.abs(touch.clientY - touchStart.y);

    e.preventDefault();
    e.stopPropagation();

    if (touchTimer) {
      clearTimeout(touchTimer);
      setTouchTimer(null);
      setTouchStart(null);
      setTouchElement(null);
      return;
    }

    if (isDragging && (deltaX > 10 || deltaY > 10)) {
      setDragPosition({ x: touch.clientX, y: touch.clientY });

      const element = document.elementFromPoint(touch.clientX, touch.clientY);

      let cellElement = element;
      while (cellElement && !cellElement.dataset.cellId && cellElement !== document.body) {
        cellElement = cellElement.parentElement;
      }

      if (cellElement && cellElement.dataset.cellId) {
        const [phaseId, locationId] = cellElement.dataset.cellId.split('-');
        const parsedPhaseId = phaseId === 'null' ? null : parseInt(phaseId);
        const parsedLocationId = locationId === 'null' ? null : parseInt(locationId);
        setDragOverCell({ phaseId: parsedPhaseId, locationId: parsedLocationId });
      } else {
        setDragOverCell(null);
      }
    }
  };

  const handleTouchEnd = async (e) => {
    if (!touchStart) return;

    const touch = e.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchStart.x);
    const deltaY = Math.abs(touch.clientY - touchStart.y);
    const wasDragging = deltaX > 10 || deltaY > 10;

    if (touchTimer) {
      clearTimeout(touchTimer);
      setTouchTimer(null);
      if (!wasDragging) {
        // Check if tap was on image area - open lightbox, otherwise navigate
        if (touchStart.isImageArea && touchStart.piece.display_image_id) {
          openLightbox(touchStart.piece, { preventDefault: () => {}, stopPropagation: () => {} });
        } else {
          setTimeout(() => {
            navigate(`/pieces/${touchStart.piece.id}`);
          }, 50);
        }
      }
      setTouchStart(null);
      setTouchElement(null);
      return;
    }

    if (!isDragging) {
      setTouchStart(null);
      setTouchElement(null);
      return;
    }

    if (wasDragging && isDragging) {
      e.preventDefault();
      e.stopPropagation();

      const element = document.elementFromPoint(touch.clientX, touch.clientY);

      let cellElement = element;
      while (cellElement && !cellElement.dataset.cellId && cellElement !== document.body) {
        cellElement = cellElement.parentElement;
      }

      if (cellElement && cellElement.dataset.cellId) {
        const [phaseId, locationId] = cellElement.dataset.cellId.split('-');
        const targetPhaseId = phaseId === 'null' ? null : parseInt(phaseId);
        const targetLocationId = locationId === 'null' ? null : parseInt(locationId);

        const phaseChanged = touchStart.piece.current_phase_id !== targetPhaseId;
        const locationChanged = touchStart.piece.current_location_id !== targetLocationId;

        if (phaseChanged || locationChanged) {
          try {
            const promises = [];
            if (phaseChanged) {
              promises.push(piecesAPI.updatePhase(touchStart.piece.id, targetPhaseId || null));
            }
            if (locationChanged) {
              promises.push(piecesAPI.updateLocation(touchStart.piece.id, targetLocationId || null));
            }
            await Promise.all(promises);

            setPieces(prevPieces =>
              prevPieces.map(piece =>
                piece.id === touchStart.piece.id
                  ? {
                      ...piece,
                      current_phase_id: targetPhaseId || null,
                      current_location_id: targetLocationId || null
                    }
                  : piece
              )
            );
          } catch (err) {
            setError(err.message);
            loadData();
          }
        }
      }
    }

    setTouchStart(null);
    setTouchElement(null);
    setTouchTimer(null);
    setDraggedPiece(null);
    setIsDragging(false);
    setDragOverCell(null);
    setDragPosition({ x: 0, y: 0 });
  };

  const isCellHighlighted = (phaseId, locationId) => {
    if (!dragOverCell) return false;
    return dragOverCell.phaseId === phaseId && dragOverCell.locationId === locationId;
  };

  // Render a piece card
  const renderPieceCard = (piece) => {
    const isBeingDragged = draggedPiece?.id === piece.id && isDragging;
    return (
      <div
        key={piece.id}
        className={`bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] shadow-sm transition-all hover:shadow-md hover:border-[var(--color-border-hover)] overflow-hidden cursor-grab active:cursor-grabbing touch-none select-none ${
          isBeingDragged
            ? 'border-[var(--color-primary)] border-2 shadow-xl rounded-lg'
            : ''
        }`}
        draggable
        onDragStart={(e) => handleDragStart(e, piece)}
        onDragEnd={handleDragEnd}
        onTouchStart={(e) => handleTouchStart(e, piece)}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }}
        style={{
          touchAction: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          WebkitTouchCallout: 'none',
          position: isBeingDragged ? 'relative' : 'static',
          zIndex: isBeingDragged ? 1000 : 'auto',
          opacity: isBeingDragged ? 0.4 : 1,
          transform: isBeingDragged ? 'scale(0.9)' : 'none',
          transition: isBeingDragged ? 'none' : 'all 0.2s',
          borderRadius: isBeingDragged ? '0.5rem' : undefined
        }}
      >
        {/* Image area - opens lightbox */}
        {piece.display_image_id && (
          <div
            className="w-full h-24 bg-[var(--color-surface-hover)] overflow-hidden border-b border-[var(--color-border)] cursor-pointer"
            onClick={(e) => openLightbox(piece, e)}
            style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
            data-image-area="true"
          >
            <img
              src={imagesAPI.getFileUrl(piece.display_image_id, true)}
              alt={piece.name}
              className="w-full h-full object-cover"
              draggable="false"
              data-image-area="true"
            />
          </div>
        )}
        {/* Info area - navigates to detail view */}
        <Link
          to={`/pieces/${piece.id}`}
          className="block text-decoration-none"
          draggable="false"
          onDragStart={(e) => e.preventDefault()}
          style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
          onClick={(e) => {
            if (isDragging || (touchStart && touchTimer)) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <div className="p-2 space-y-1">
            <div className="flex items-center gap-1 flex-wrap">
              <h4 className="font-semibold text-xs m-0 line-clamp-1">
                {piece.name}
              </h4>
              {piece.done === 1 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-success)] text-white flex-shrink-0">
                  Done
                </span>
              )}
            </div>
            <div className="flex gap-2 text-xs text-[var(--color-text-tertiary)]">
              <span className="flex items-center gap-1">
                <Package className="h-3 w-3" />
                {piece.material_count || 0}
              </span>
              <span className="flex items-center gap-1">
                <ImageIcon className="h-3 w-3" />
                {piece.image_count || 0}
              </span>
            </div>
          </div>
        </Link>
      </div>
    );
  };

  // Render a swim lane for a location
  const renderSwimLane = (location) => {
    const locationId = location ? location.id : null;
    const locationName = location ? location.name : 'No location';
    const isCollapsed = isLaneCollapsed(locationId);
    const pieceCount = getPiecesCountForLocation(locationId);
    const laneKey = locationId === null ? 'no-location' : locationId;

    return (
      <div
        key={laneKey}
        className="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)]"
      >
        {/* Location Header */}
        <div
          className="p-3 bg-[var(--color-surface)] border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors flex items-center justify-between"
          onClick={() => toggleLaneCollapse(locationId)}
          title={isCollapsed ? 'Click to expand' : 'Click to collapse'}
        >
          <div className="flex items-center gap-2">
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-[var(--color-text-secondary)]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[var(--color-text-secondary)]" />
            )}
            <MapPin className="h-4 w-4" />
            <span className="font-semibold text-sm">{locationName}</span>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] border border-[var(--color-border)]">
            {pieceCount}
          </span>
        </div>

        {/* Phase Columns */}
        {!isCollapsed && (
          <div className="flex gap-1 p-2">
            {phases.map((phase) => {
              const isColCollapsed = isColumnCollapsed(phase.id);
              const cellPieces = getPiecesForCell(phase.id, locationId);
              const cellId = `${phase.id}-${locationId}`;
              const isHighlighted = isCellHighlighted(phase.id, locationId);
              const phaseColor = getPhaseColor(phase.id);

              return (
                <div
                  key={phase.id}
                  data-cell-id={cellId}
                  className={`flex-shrink-0 transition-all duration-200 ${isColCollapsed ? 'w-10' : 'w-[160px] md:w-48'}`}
                >
                  {!isColCollapsed && (
                    <div
                      className="flex flex-col min-h-[150px] transition-all duration-150"
                      style={{
                        background: isHighlighted ? phaseColor.bg : 'var(--color-background)',
                        borderRadius: '10px',
                        border: isHighlighted
                          ? `2px solid ${phaseColor.accent}`
                          : `1px solid var(--color-border)`,
                        boxShadow: isHighlighted
                          ? `0 0 0 3px ${phaseColor.accent}22, var(--shadow-md)`
                          : 'none',
                        transform: isHighlighted ? 'scale(1.01)' : 'scale(1)',
                      }}
                      onDragOver={(e) => handleDragOver(e, phase.id, locationId)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, phase.id, locationId)}
                    >
                      {/* Pieces */}
                      <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto">
                        {cellPieces.map(piece => renderPieceCard(piece))}
                        {cellPieces.length === 0 && (
                          <div className="text-center italic py-4 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
                            Tom
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Map phase index to CSS variable for column coloring
  const phaseColorVars = [
    { bg: 'var(--phase-color-1)', border: 'var(--phase-color-1-border)', accent: 'var(--phase-color-1-accent)' },
    { bg: 'var(--phase-color-2)', border: 'var(--phase-color-2-border)', accent: 'var(--phase-color-2-accent)' },
    { bg: 'var(--phase-color-3)', border: 'var(--phase-color-3-border)', accent: 'var(--phase-color-3-accent)' },
    { bg: 'var(--phase-color-4)', border: 'var(--phase-color-4-border)', accent: 'var(--phase-color-4-accent)' },
    { bg: 'var(--phase-color-5)', border: 'var(--phase-color-5-border)', accent: 'var(--phase-color-5-accent)' },
  ];

  const getPhaseColor = (phaseId) => {
    const idx = phases.findIndex(p => p.id === phaseId);
    return phaseColorVars[idx % phaseColorVars.length] || phaseColorVars[0];
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="skeleton h-8 w-32" />
          <div className="skeleton h-9 w-28" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 style={{ fontFamily: 'var(--font-family-display)', fontSize: '1.8rem', fontWeight: 600, letterSpacing: '0.01em', color: 'var(--color-text-primary)' }}>
          Kanban
        </h2>
        <Button asChild>
          <Link to="/pieces/new">
            <Plus className="mr-2 h-4 w-4" />
            Ny pjäs
          </Link>
        </Button>
      </div>

      {/* Image Lightbox */}
      {lightboxState.isOpen && (
        <ImageLightbox
          images={lightboxState.images}
          currentIndex={lightboxState.currentIndex}
          onClose={closeLightbox}
          onDelete={handleLightboxDelete}
          onNavigate={handleLightboxNavigate}
          pieceName={lightboxState.pieceName}
          showDelete={true}
        />
      )}

      {error && (
        <div className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Main scroll container */}
      <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
        {/* Global Phase Column Headers */}
        <div className="sticky top-0 z-10 flex gap-1 p-2 mb-1 min-w-min bg-[var(--color-background)]">
          {phases.map(phase => {
            const isColCollapsed = isColumnCollapsed(phase.id);
            const phaseColor = getPhaseColor(phase.id);
            return (
              <div
                key={`global-header-${phase.id}`}
                className={`flex-shrink-0 ${isColCollapsed ? 'w-10' : 'w-[160px] md:w-48'} transition-all duration-200`}
              >
                <div
                  className="p-2 rounded-lg cursor-pointer transition-all flex items-center justify-between"
                  style={{
                    background: phaseColor.bg,
                    border: `1px solid ${phaseColor.border}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                  }}
                  onClick={() => toggleColumnCollapse(phase.id)}
                  title={isColCollapsed ? 'Expandera kolumn' : 'Kollapsa kolumn'}
                >
                  {isColCollapsed ? (
                    <ChevronRight className="h-4 w-4 mx-auto" style={{ color: phaseColor.accent }} />
                  ) : (
                    <>
                      <h4 className="font-semibold text-xs truncate" style={{ color: phaseColor.accent }}>
                        {phase.name}
                      </h4>
                      <ChevronDown className="h-3 w-3 flex-shrink-0 ml-1" style={{ color: phaseColor.accent, opacity: 0.7 }} />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Swim Lanes */}
        <div className="space-y-1 min-w-min">
          {/* Locations with pieces first */}
          {locations.map(location => renderSwimLane(location))}

          {/* No location lane at the bottom */}
          {renderSwimLane(null)}
        </div>
      </div>
    </div>
  );
}

export default KanbanView;
