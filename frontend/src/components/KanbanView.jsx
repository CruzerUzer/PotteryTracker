import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { piecesAPI, phasesAPI, imagesAPI } from '../services/api';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Plus, Package, Image as ImageIcon } from 'lucide-react';

function KanbanView() {
  const [pieces, setPieces] = useState([]);
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [draggedPiece, setDraggedPiece] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
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

  const handleDragStart = (e, piece) => {
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

      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[500px]">
        {phases.map((phase) => (
          <div
            key={phase.id}
            className={`flex-shrink-0 w-80 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] shadow-sm flex flex-col min-h-[400px] transition-all ${
              dragOverColumn === phase.id ? 'border-[var(--color-primary)] border-2 shadow-lg bg-[var(--color-surface-hover)]' : ''
            }`}
            onDragOver={(e) => handleDragOver(e, phase.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, phase.id)}
          >
            <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <h3 className="font-semibold text-lg">{phase.name}</h3>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] border border-[var(--color-border)]">
                {getPiecesForPhase(phase.id).length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[100px]">
              {getPiecesForPhase(phase.id).map((piece) => (
                <div
                  key={piece.id}
                  className={`bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] shadow-sm cursor-grab active:cursor-grabbing transition-all hover:shadow-md hover:border-[var(--color-border-hover)] ${
                    draggedPiece?.id === piece.id ? 'opacity-50' : ''
                  } ${!piece.latest_image_id ? '' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, piece)}
                  onDragEnd={handleDragEnd}
                >
                  <Link
                    to={`/pieces/${piece.id}`}
                    className="block p-4 pb-24 text-decoration-none"
                    onClick={(e) => {
                      if (isDragging) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm m-0 line-clamp-2">{piece.name}</h4>
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
                    {piece.latest_image_id && (
                      <div className="absolute bottom-3 right-3 w-16 h-16 rounded-md overflow-hidden border border-[var(--color-border)] shadow-sm bg-[var(--color-surface-hover)]">
                        <img
                          src={imagesAPI.getFileUrl(piece.latest_image_id, true)}
                          alt={piece.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                  </Link>
                </div>
              ))}
              {getPiecesForPhase(phase.id).length === 0 && (
                <div className="text-center text-[var(--color-text-tertiary)] italic py-8 text-sm">
                  No pieces
                </div>
              )}
            </div>
          </div>
        ))}
        
        {/* Column for pieces without a phase */}
        <div
          className={`flex-shrink-0 w-80 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] shadow-sm flex flex-col min-h-[400px] transition-all ${
            dragOverColumn === null ? 'border-[var(--color-primary)] border-2 shadow-lg bg-[var(--color-surface-hover)]' : ''
          }`}
          onDragOver={(e) => handleDragOver(e, null)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, null)}
        >
          <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <h3 className="font-semibold text-lg">No Phase</h3>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] border border-[var(--color-border)]">
              {getPiecesForPhase(null).length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[100px]">
            {getPiecesForPhase(null).map((piece) => (
              <div
                key={piece.id}
                className={`bg-[var(--color-surface)] rounded-md border border-[var(--color-border)] shadow-sm cursor-grab active:cursor-grabbing transition-all hover:shadow-md hover:border-[var(--color-border-hover)] relative ${
                  draggedPiece?.id === piece.id ? 'opacity-50' : ''
                }`}
                draggable
                onDragStart={(e) => handleDragStart(e, piece)}
                onDragEnd={handleDragEnd}
              >
                <Link
                  to={`/pieces/${piece.id}`}
                  className="block p-4 pb-24 text-decoration-none"
                  onClick={(e) => {
                    if (isDragging) {
                      e.preventDefault();
                    }
                  }}
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-sm m-0 line-clamp-2">{piece.name}</h4>
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
                  {piece.latest_image_id && (
                    <div className="absolute bottom-3 right-3 w-16 h-16 rounded-md overflow-hidden border border-[var(--color-border)] shadow-sm bg-[var(--color-surface-hover)]">
                      <img
                        src={imagesAPI.getFileUrl(piece.latest_image_id, true)}
                        alt={piece.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}
                </Link>
              </div>
            ))}
            {getPiecesForPhase(null).length === 0 && (
              <div className="text-center text-[var(--color-text-tertiary)] italic py-8 text-sm">
                No pieces
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default KanbanView;
