import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { piecesAPI, phasesAPI, imagesAPI } from '../services/api';

function DonePieces() {
  const [pieces, setPieces] = useState([]);
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      // Filter to show only done pieces
      const donePieces = piecesData.filter(piece => piece.done === 1);
      setPieces(donePieces);
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
        <h2>Done Pieces</h2>
        <Link to="/pieces/new" className="btn btn-primary">
          Add New Piece
        </Link>
      </div>

      {error && <div className="error">{error}</div>}

      {pieces.length === 0 ? (
        <div className="card">
          <p>No completed pieces found. Pieces will appear here once they are moved to the final phase.</p>
        </div>
      ) : (
        <div className="piece-list">
          {pieces.map((piece) => (
            <div key={piece.id} className={`piece-card ${!piece.latest_image_id ? 'piece-card-no-image' : ''}`}>
              <Link
                to={`/pieces/${piece.id}`}
                style={{ textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', flex: '1' }}
              >
                <div style={{ padding: '12px 15px', flex: '1', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0 }}>{piece.name}</h3>
                    <span className="done-badge">Done</span>
                  </div>
                  {piece.phase_name && (
                    <span className="phase-badge">{piece.phase_name}</span>
                  )}
                  {piece.description && (
                    <p style={{ marginTop: '8px', color: '#6b7280', fontSize: '0.875rem', lineHeight: '1.4' }}>
                      {piece.description.length > 80
                        ? piece.description.substring(0, 80) + '...'
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
              <div className="btn-group" style={{ padding: '10px 15px', paddingTop: '0', paddingRight: '100px', marginTop: 'auto' }}>
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

export default DonePieces;

