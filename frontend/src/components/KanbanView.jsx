import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { piecesAPI, phasesAPI, imagesAPI } from '../services/api';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Plus, Package, Image as ImageIcon, ChevronDown, ChevronUp } from 'lucide-react';

function KanbanView() {
  const [pieces, setPieces] = useState([]);
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggedPiece, setDraggedPiece] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchElement, setTouchElement] = useState(null);
  const [touchTimer, setTouchTimer] = useState(null);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [collapsedColumns, setCollapsedColumns] = useState(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [piecesData, phasesData] = await Promise.all([
        piecesAPI.getAll(),
        phasesAPI.getAll(),
      ]);
      setPieces(piecesData);
      const sortedPhases = phasesData.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      setPhases(sortedPhases);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getPiecesForPhase = (phaseId) => {
    if (!phaseId) {
      return pieces.filter(p => !p.current_phase_id);
    }
    return pieces.filter(p => p.current_phase_id === phaseId);
  };

  const toggleColumnCollapse = (phaseId) => {
    setCollapsedColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(phaseId)) {
        newSet.delete(phaseId);
      } else {
        newSet.add(phaseId);
      }
      return newSet;
    });
  };

  const isColumnCollapsed = (phaseId) => {
    return collapsedColumns.has(phaseId);
  };

  const handleDragStart = (e, piece) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setDragPosition({ 
      x: e.clientX - rect.left, 
      y: e.clientY - rect.top 
    });
    setDraggedPiece(piece);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target);
  };

  const handleDragOver = (e, phaseId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedPiece && draggedPiece.current_phase_id !== phaseId) {
      setDragOverColumn(phaseId);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e, targetPhaseId) => {
    e.preventDefault();
    setDragOverColumn(null);
    
    if (!draggedPiece) return;

    if (draggedPiece.current_phase_id === targetPhaseId) {
      setIsDragging(false);
      setDraggedPiece(null);
      return;
    }

    try {
      await piecesAPI.updatePhase(draggedPiece.id, targetPhaseId || null);
      
      setPieces(prevPieces =>
        prevPieces.map(piece =>
          piece.id === draggedPiece.id
            ? { ...piece, current_phase_id: targetPhaseId || null }
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
    setDragOverColumn(null);
  };

  // Touch event handlers for mobile drag-and-drop
  const handleTouchStart = (e, piece) => {
    // Prevent context menu and text selection
    e.preventDefault();
    e.stopPropagation();
    
    const touch = e.touches[0];
    const startTime = Date.now();
    
    setTouchStart({
      x: touch.clientX,
      y: touch.clientY,
      piece: piece,
      time: startTime
    });
    setTouchElement(e.currentTarget);
    
    // Set a timer for touch delay (300ms) - show visual feedback after delay
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
    
    // Only allow drag if the timer has completed (press-and-hold)
    // If timer is still active, cancel the drag attempt
    if (touchTimer) {
      // User moved before delay completed - cancel drag
      clearTimeout(touchTimer);
      setTouchTimer(null);
      setTouchStart(null);
      setTouchElement(null);
      return;
    }
    
    // Only process drag if timer completed and user moved
    if (isDragging && (deltaX > 10 || deltaY > 10)) {
      e.preventDefault();
      
      // Update drag position for visual feedback
      setDragPosition({ x: touch.clientX, y: touch.clientY });
      
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      
      // Find the column element
      let columnElement = element;
      while (columnElement && !columnElement.dataset.phaseId && columnElement !== document.body) {
        columnElement = columnElement.parentElement;
      }
      
      if (columnElement && columnElement.dataset.phaseId) {
        const phaseId = columnElement.dataset.phaseId === 'null' ? null : parseInt(columnElement.dataset.phaseId);
        if (touchStart.piece.current_phase_id !== phaseId) {
          setDragOverColumn(phaseId);
        }
      } else {
        setDragOverColumn(null);
      }
    }
  };

  const handleTouchEnd = async (e) => {
    if (!touchStart) return;

    const touch = e.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchStart.x);
    const deltaY = Math.abs(touch.clientY - touchStart.y);
    const wasDragging = deltaX > 10 || deltaY > 10;

    // Clear touch timer if still active
    if (touchTimer) {
      clearTimeout(touchTimer);
      setTouchTimer(null);
      // If timer was still active and user didn't move, allow click navigation
      if (!wasDragging) {
        // Small delay to prevent text selection, then navigate
        setTimeout(() => {
          navigate(`/pieces/${touchStart.piece.id}`);
        }, 50);
      }
      setTouchStart(null);
      setTouchElement(null);
      return;
    }

    // Only process drop if we were actually dragging (timer completed)
    if (!isDragging) {
      setTouchStart(null);
      setTouchElement(null);
      return;
    }

    // If we were dragging (moved more than 10px), handle the drop
    if (wasDragging && isDragging) {
      e.preventDefault();
      e.stopPropagation();
      
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      
      // Find the column element
      let columnElement = element;
      while (columnElement && !columnElement.dataset.phaseId && columnElement !== document.body) {
        columnElement = columnElement.parentElement;
      }
      
      if (columnElement && columnElement.dataset.phaseId) {
        const targetPhaseId = columnElement.dataset.phaseId === 'null' ? null : parseInt(columnElement.dataset.phaseId);
        
        if (touchStart.piece.current_phase_id !== targetPhaseId) {
          try {
            await piecesAPI.updatePhase(touchStart.piece.id, targetPhaseId || null);
            
            setPieces(prevPieces =>
              prevPieces.map(piece =>
                piece.id === touchStart.piece.id
                  ? { ...piece, current_phase_id: targetPhaseId || null }
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
    setDragOverColumn(null);
    setDragPosition({ x: 0, y: 0 });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Kanban Board</h2>
        <Button asChild>
          <Link to="/pieces/new">
            <Plus className="mr-2 h-4 w-4" />
            Add New Piece
          </Link>
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto pb-4 min-h-[500px]">
        {phases.map((phase) => {
          const isCollapsed = isColumnCollapsed(phase.id);
          return (
          <div
            key={phase.id}
            data-phase-id={phase.id}
            className={`flex-shrink-0 w-[150px] md:w-80 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] shadow-sm flex flex-col transition-all duration-300 ${
              isCollapsed ? 'min-h-0' : 'min-h-[400px]'
            } ${
              dragOverColumn === phase.id 
                ? 'border-[var(--color-primary)] border-2 shadow-xl bg-[var(--color-surface-hover)] scale-105 ring-2 ring-[var(--color-primary)] ring-opacity-50' 
                : ''
            }`}
            onDragOver={(e) => handleDragOver(e, phase.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, phase.id)}
          >
            <div 
              className={`p-2 flex items-center justify-between cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors ${
                isCollapsed ? '' : 'border-b border-[var(--color-border)]'
              }`}
              onClick={() => toggleColumnCollapse(phase.id)}
              title={isCollapsed ? 'Click to expand' : 'Click to collapse'}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                )}
                <h3 className="font-semibold text-sm truncate">{phase.name}</h3>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] border border-[var(--color-border)] flex-shrink-0 ml-2">
                {getPiecesForPhase(phase.id).length}
              </span>
            </div>
            {!isCollapsed && (
            <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]">
              {getPiecesForPhase(phase.id).map((piece) => {
                const isBeingDragged = draggedPiece?.id === piece.id && (isDragging || (touchStart && touchStart.piece?.id === piece.id));
                return (
                <div
                  key={piece.id}
                  className={`bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] shadow-sm transition-all hover:shadow-md hover:border-[var(--color-border-hover)] overflow-hidden cursor-grab active:cursor-grabbing touch-none select-none ${
                    isBeingDragged 
                      ? 'opacity-50 scale-95 border-[var(--color-primary)] border-2 shadow-xl rounded-lg' 
                      : ''
                  }`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, piece)}
                  onDragEnd={handleDragEnd}
                  onDrag={(e) => {
                    if (isDragging && draggedPiece?.id === piece.id && e.clientX && e.clientY) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setDragPosition({ 
                        x: e.clientX - rect.left, 
                        y: e.clientY - rect.top 
                      });
                    }
                  }}
                  onTouchStart={(e) => handleTouchStart(e, piece)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onContextMenu={(e) => e.preventDefault()}
                  style={{ 
                    touchAction: 'none', 
                    WebkitUserSelect: 'none', 
                    userSelect: 'none',
                    position: isBeingDragged ? 'relative' : 'static',
                    zIndex: isBeingDragged ? 1000 : 'auto',
                    opacity: isBeingDragged ? 0.4 : undefined,
                    transform: isBeingDragged ? 'scale(0.9)' : undefined,
                    transition: isBeingDragged ? 'none' : 'all 0.2s',
                    borderRadius: isBeingDragged ? '0.5rem' : undefined
                  }}
                >
                  <Link
                    to={`/pieces/${piece.id}`}
                    className="block text-decoration-none"
                    onClick={(e) => {
                      if (isDragging || (touchStart && touchTimer)) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                    }}
                  >
                    {piece.latest_image_id && (
                      <div className="w-full h-32 bg-[var(--color-surface-hover)] overflow-hidden border-b border-[var(--color-border)]">
                        <img
                          src={imagesAPI.getFileUrl(piece.latest_image_id, true)}
                          alt={piece.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm m-0 line-clamp-2">
                          {piece.name}
                        </h4>
                        {piece.done === 1 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-success)] text-white flex-shrink-0">
                            Done
                          </span>
                        )}
                      </div>
                      {piece.description && (
                        <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 m-0">
                          {piece.description.length > 60
                            ? piece.description.substring(0, 60) + '...'
                            : piece.description}
                        </p>
                      )}
                      <div className="flex gap-3 text-xs text-[var(--color-text-tertiary)]">
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
              })}
              {getPiecesForPhase(phase.id).length === 0 && (
                <div className="text-center text-[var(--color-text-tertiary)] italic py-8 text-sm">
                  No pieces
                </div>
              )}
            </div>
            )}
          </div>
          );
        })}
        
        {/* Column for pieces without a phase */}
        {(() => {
          const phaseId = null;
          const isCollapsed = isColumnCollapsed(phaseId);
          return (
          <div
            key="no-phase"
            data-phase-id="null"
            className={`flex-shrink-0 w-[175px] md:w-80 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] shadow-sm flex flex-col transition-all duration-300 ${
              isCollapsed ? 'min-h-0' : 'min-h-[400px]'
            } ${
              dragOverColumn === phaseId 
                ? 'border-[var(--color-primary)] border-2 shadow-xl bg-[var(--color-surface-hover)] scale-105 ring-2 ring-[var(--color-primary)] ring-opacity-50' 
                : ''
            }`}
            onDragOver={(e) => handleDragOver(e, phaseId)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, phaseId)}
          >
            <div 
              className={`p-2 flex items-center justify-between cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors ${
                isCollapsed ? '' : 'border-b border-[var(--color-border)]'
              }`}
              onClick={() => toggleColumnCollapse(phaseId)}
              title={isCollapsed ? 'Click to expand' : 'Click to collapse'}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                ) : (
                  <ChevronUp className="h-4 w-4 text-[var(--color-text-secondary)] flex-shrink-0" />
                )}
                <h3 className="font-semibold text-sm truncate">No Phase</h3>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] border border-[var(--color-border)] flex-shrink-0 ml-2">
                {getPiecesForPhase(phaseId).length}
              </span>
            </div>
            {!isCollapsed && (
            <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[100px]">
              {getPiecesForPhase(phaseId).map((piece) => {
                const isBeingDragged = draggedPiece?.id === piece.id && (isDragging || (touchStart && touchStart.piece?.id === piece.id));
                return (
                <div
                  key={piece.id}
                  className={`bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] shadow-sm transition-all hover:shadow-md hover:border-[var(--color-border-hover)] overflow-hidden cursor-grab active:cursor-grabbing touch-none select-none ${
                    isBeingDragged 
                      ? 'opacity-50 scale-95 border-[var(--color-primary)] border-2 shadow-xl rounded-lg' 
                      : ''
                  }`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, piece)}
                  onDragEnd={handleDragEnd}
                  onDrag={(e) => {
                    if (isDragging && draggedPiece?.id === piece.id && e.clientX && e.clientY) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setDragPosition({ 
                        x: e.clientX - rect.left, 
                        y: e.clientY - rect.top 
                      });
                    }
                  }}
                  onTouchStart={(e) => handleTouchStart(e, piece)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onContextMenu={(e) => e.preventDefault()}
                  style={{ 
                    touchAction: 'none', 
                    WebkitUserSelect: 'none', 
                    userSelect: 'none',
                    position: isBeingDragged ? 'relative' : 'static',
                    zIndex: isBeingDragged ? 1000 : 'auto',
                    opacity: isBeingDragged ? 0.4 : undefined,
                    transform: isBeingDragged ? 'scale(0.9)' : undefined,
                    transition: isBeingDragged ? 'none' : 'all 0.2s',
                    borderRadius: isBeingDragged ? '0.5rem' : undefined
                  }}
                >
                  <Link
                    to={`/pieces/${piece.id}`}
                    className="block text-decoration-none"
                    onClick={(e) => {
                      if (isDragging || (touchStart && touchTimer)) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                    }}
                  >
                    {piece.latest_image_id && (
                      <div className="w-full h-32 bg-[var(--color-surface-hover)] overflow-hidden border-b border-[var(--color-border)]">
                        <img
                          src={imagesAPI.getFileUrl(piece.latest_image_id, true)}
                          alt={piece.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm m-0 line-clamp-2">
                          {piece.name}
                        </h4>
                        {piece.done === 1 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-success)] text-white flex-shrink-0">
                            Done
                          </span>
                        )}
                      </div>
                      {piece.description && (
                        <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 m-0">
                          {piece.description.length > 60
                            ? piece.description.substring(0, 60) + '...'
                            : piece.description}
                        </p>
                      )}
                      <div className="flex gap-3 text-xs text-[var(--color-text-tertiary)]">
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
              })}
              {getPiecesForPhase(phaseId).length === 0 && (
                <div className="text-center text-[var(--color-text-tertiary)] italic py-8 text-sm">
                  No pieces
                </div>
              )}
            </div>
            )}
          </div>
          );
        })()}
      </div>
    </div>
  );
}

export default KanbanView;
