import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { piecesAPI, phasesAPI, imagesAPI } from '../services/api';

function PieceList() {
  const [pieces, setPieces] = useState([]);
  const [phases, setPhases] = useState([]);
  const [selectedPhase, setSelectedPhase] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, [selectedPhase]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [piecesData, phasesData] = await Promise.all([
        piecesAPI.getAll(selectedPhase || null),
        phasesAPI.getAll(),
      ]);
      setPieces(piecesData);
      setPhases(phasesData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this piece?')) {
      return;
    }

    try {
      await piecesAPI.delete(id);
      loadData();
    } catch (err) {
      alert('Error deleting piece: ' + err.message);
    }
  };

  if (loading) {
    return <div className="card">Loading...</div>;
  }

  return (
    <div>
      <div className="actions-row">
        <h2>Ceramic Pieces</h2>
        <Link to="/pieces/new" className="btn btn-primary">
          Add New Piece
        </Link>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="form-group" style={{ marginBottom: '20px' }}>
        <label>Filter by Phase:</label>
        <select
          value={selectedPhase}
          onChange={(e) => setSelectedPhase(e.target.value)}
        >
          <option value="">All Phases</option>
          {phases.map((phase) => (
            <option key={phase.id} value={phase.id}>
              {phase.name}
            </option>
          ))}
        </select>
      </div>

      {pieces.length === 0 ? (
        <div className="card">
          <p>No pieces found. Create your first piece to get started!</p>
        </div>
      ) : (
        <div className="piece-list">
          {pieces.map((piece) => (
            <div key={piece.id} className="piece-card">
              <Link
                to={`/pieces/${piece.id}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', flex: '1' }}
              >
                <div style={{ padding: '15px', flex: '1', display: 'flex', flexDirection: 'column' }}>
                  <h3>{piece.name}</h3>
                  {piece.phase_name && (
                    <span className="phase-badge">{piece.phase_name}</span>
                  )}
                  {piece.description && (
                    <p style={{ marginTop: '10px', color: '#666' }}>
                      {piece.description.length > 100
                        ? piece.description.substring(0, 100) + '...'
                        : piece.description}
                    </p>
                  )}
                  <div className="meta">
                    <div>Materials: {piece.material_count || 0}</div>
                    <div>Images: {piece.image_count || 0}</div>
                  </div>
                </div>
                {piece.latest_image_id && (
                  <div className="piece-card-image">
                    <img
                      src={imagesAPI.getFileUrl(piece.latest_image_id)}
                      alt={piece.name}
                    />
                  </div>
                )}
              </Link>
              <div className="btn-group" style={{ padding: '15px', paddingTop: '0', paddingRight: '130px', marginTop: 'auto' }}>
                <Link
                  to={`/pieces/${piece.id}/edit`}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.9rem', padding: '8px 16px' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  Edit
                </Link>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(piece.id);
                  }}
                  className="btn btn-danger"
                  style={{ fontSize: '0.9rem', padding: '8px 16px' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PieceList;


