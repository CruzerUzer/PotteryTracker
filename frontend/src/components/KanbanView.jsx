import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { piecesAPI, phasesAPI, imagesAPI } from '../services/api';

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
      // Sort phases by display_order
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

    // Don't do anything if dropped in the same phase
    if (draggedPiece.current_phase_id === targetPhaseId) {
      setIsDragging(false);
      setDraggedPiece(null);
      return;
    }

    try {
      await piecesAPI.updatePhase(draggedPiece.id, targetPhaseId || null);
      
      // Update local state optimistically
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
      // Reload data on error to sync with server
      loadData();
    }
  };

  const handleDragEnd = () => {
    // Small delay to prevent click event from firing after drag
    setTimeout(() => {
      setIsDragging(false);
    }, 100);
    setDraggedPiece(null);
    setDragOverColumn(null);
  };

  if (loading) {
    return <div className="card">Loading...</div>;
  }

  return (
    <div>
      <div className="actions-row">
        <h2>Kanban Board</h2>
        <Link to="/pieces/new" className="btn btn-primary">
          Add New Piece
        </Link>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="kanban-board">
        {phases.map((phase) => (
          <div
            key={phase.id}
            className={`kanban-column ${dragOverColumn === phase.id ? 'drag-over' : ''}`}
            onDragOver={(e) => handleDragOver(e, phase.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, phase.id)}
          >
            <div className="kanban-column-header">
              <h3>{phase.name}</h3>
              <span className="kanban-count">{getPiecesForPhase(phase.id).length}</span>
            </div>
            <div className="kanban-column-content">
              {getPiecesForPhase(phase.id).map((piece) => (
                <div
                  key={piece.id}
                  className={`kanban-card ${draggedPiece?.id === piece.id ? 'dragging' : ''} ${!piece.latest_image_id ? 'kanban-card-no-image' : ''}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, piece)}
                  onDragEnd={handleDragEnd}
                >
                  <Link
                    to={`/pieces/${piece.id}`}
                    style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', height: '100%' }}
                    onClick={(e) => {
                      // Prevent navigation if we're currently dragging
                      if (isDragging) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <div className="kanban-card-content">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0 }}>{piece.name}</h4>
                        {piece.done === 1 && (
                          <span className="done-badge">Done</span>
                        )}
                      </div>
                      {piece.description && (
                        <p className="kanban-card-description">
                          {piece.description.length > 60
                            ? piece.description.substring(0, 60) + '...'
                            : piece.description}
                        </p>
                      )}
                      <div className="kanban-card-meta">
                        <span>📦 {piece.material_count || 0}</span>
                        <span>🖼️ {piece.image_count || 0}</span>
                      </div>
                    </div>
                    {piece.latest_image_id && (
                      <div className="kanban-card-image">
                        <img
                          src={imagesAPI.getFileUrl(piece.latest_image_id)}
                          alt={piece.name}
                        />
                      </div>
                    )}
                  </Link>
                </div>
              ))}
              {getPiecesForPhase(phase.id).length === 0 && (
                <div className="kanban-empty">No pieces</div>
              )}
            </div>
          </div>
        ))}
        
        {/* Column for pieces without a phase */}
        <div
          className={`kanban-column ${dragOverColumn === null ? 'drag-over' : ''}`}
          onDragOver={(e) => handleDragOver(e, null)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, null)}
        >
          <div className="kanban-column-header">
            <h3>No Phase</h3>
            <span className="kanban-count">{getPiecesForPhase(null).length}</span>
          </div>
          <div className="kanban-column-content">
            {getPiecesForPhase(null).map((piece) => (
              <div
                key={piece.id}
                className={`kanban-card ${draggedPiece?.id === piece.id ? 'dragging' : ''} ${!piece.latest_image_id ? 'kanban-card-no-image' : ''}`}
                draggable
                onDragStart={(e) => handleDragStart(e, piece)}
                onDragEnd={handleDragEnd}
              >
                <Link
                  to={`/pieces/${piece.id}`}
                  style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', height: '100%' }}
                  onClick={(e) => {
                    // Prevent navigation if we're currently dragging
                    if (isDragging) {
                      e.preventDefault();
                    }
                  }}
                >
                  <div className="kanban-card-content">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <h4 style={{ margin: 0 }}>{piece.name}</h4>
                      {piece.done === 1 && (
                        <span className="done-badge">Done</span>
                      )}
                    </div>
                    {piece.description && (
                      <p className="kanban-card-description">
                        {piece.description.length > 60
                          ? piece.description.substring(0, 60) + '...'
                          : piece.description}
                      </p>
                    )}
                    <div className="kanban-card-meta">
                      <span>📦 {piece.material_count || 0}</span>
                      <span>🖼️ {piece.image_count || 0}</span>
                    </div>
                  </div>
                  {piece.latest_image_id && (
                    <div className="kanban-card-image">
                      <img
                        src={imagesAPI.getFileUrl(piece.latest_image_id)}
                        alt={piece.name}
                      />
                    </div>
                  )}
                </Link>
              </div>
            ))}
            {getPiecesForPhase(null).length === 0 && (
              <div className="kanban-empty">No pieces</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default KanbanView;

