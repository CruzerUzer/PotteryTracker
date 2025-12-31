import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { piecesAPI, phasesAPI, imagesAPI } from '../services/api';
import ImageUpload from './ImageUpload';
import ImageLightbox from './ImageLightbox';

function PieceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [piece, setPiece] = useState(null);
  const [phases, setPhases] = useState([]);
  const [selectedPhase, setSelectedPhase] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [pieceData, phasesData] = await Promise.all([
        piecesAPI.getById(id),
        phasesAPI.getAll(),
      ]);
      setPiece(pieceData);
      setPhases(phasesData);
      setSelectedPhase(pieceData.current_phase_id || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePhaseChange = async (e) => {
    const newPhaseId = e.target.value;
    setUpdating(true);
    try {
      await piecesAPI.updatePhase(id, newPhaseId);
      setSelectedPhase(newPhaseId);
      await loadData();
    } catch (err) {
      alert('Error updating phase: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this piece? All images will be deleted too.')) {
      return;
    }

    try {
      await piecesAPI.delete(id);
      navigate('/kanban');
    } catch (err) {
      alert('Error deleting piece: ' + err.message);
    }
  };

  const handleImageUploaded = () => {
    loadData();
  };

  const handleImageDelete = async (imageId) => {
    if (!window.confirm('Are you sure you want to delete this image?')) {
      return;
    }

    try {
      await imagesAPI.delete(imageId);
      loadData();
    } catch (err) {
      alert('Error deleting image: ' + err.message);
    }
  };

  if (loading) {
    return <div className="card">Loading...</div>;
  }

  if (error || !piece) {
    return (
      <div className="card">
        <div className="error">{error || 'Piece not found'}</div>
        <Link to="/list" className="btn btn-secondary" style={{ marginTop: '20px' }}>
          Back to List
        </Link>
      </div>
    );
  }

  const currentPhase = phases.find((p) => p.id === piece.current_phase_id);

  return (
    <div>
      <div className="actions-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0 }}>{piece.name}</h2>
          {piece.done === 1 && (
            <span className="done-badge">Done</span>
          )}
        </div>
        <div className="btn-group">
          <Link to={`/pieces/${id}/edit`} className="btn btn-secondary">
            Edit
          </Link>
          <button onClick={handleDelete} className="btn btn-danger">
            Delete
          </button>
          <Link to="/list" className="btn btn-secondary">
            Back to List
          </Link>
        </div>
      </div>

      <div className="card">
        {piece.description && (
          <div style={{ marginBottom: '20px' }}>
            <h3>Description</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{piece.description}</p>
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <h3>Current Phase</h3>
          <div className="form-group" style={{ maxWidth: '300px' }}>
            <select
              value={selectedPhase}
              onChange={handlePhaseChange}
              disabled={updating}
            >
              <option value="">No phase</option>
              {phases.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.name}
                </option>
              ))}
            </select>
            {updating && <small style={{ display: 'block', marginTop: '5px' }}>Updating...</small>}
          </div>
          {currentPhase && (
            <div className="phase-badge" style={{ marginTop: '10px' }}>
              {currentPhase.name}
            </div>
          )}
        </div>

        {piece.materials && piece.materials.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h3>Materials</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {piece.materials.map((material) => (
                <span
                  key={material.id}
                  style={{
                    padding: '5px 10px',
                    backgroundColor: '#e9ecef',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                  }}
                >
                  {material.name} ({material.type})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Images</h3>
        <ImageUpload pieceId={id} phases={phases} onUploaded={handleImageUploaded} defaultPhaseId={piece.current_phase_id || null} />

        {piece.images && piece.images.length > 0 ? (
          <>
            <div className="image-grid">
              {piece.images.map((image, index) => (
                <div
                  key={image.id}
                  className="image-item"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setLightboxIndex(index)}
                >
                  <img
                    src={imagesAPI.getFileUrl(image.id, true)}
                    alt={image.original_filename || 'Piece image'}
                  />
                  <div className="overlay">
                    <div>{image.phase_name || 'Unknown phase'}</div>
                    <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                      {new Date(image.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    className="delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleImageDelete(image.id);
                    }}
                    title="Delete image"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            {lightboxIndex !== null && (
              <ImageLightbox
                images={piece.images}
                currentIndex={lightboxIndex}
                onClose={() => setLightboxIndex(null)}
                onDelete={(imageId) => {
                  handleImageDelete(imageId);
                  if (piece.images.length === 1) {
                    setLightboxIndex(null);
                  } else if (lightboxIndex === piece.images.length - 1) {
                    setLightboxIndex(lightboxIndex - 1);
                  }
                }}
              />
            )}
          </>
        ) : (
          <p style={{ color: '#666', fontStyle: 'italic', marginTop: '20px' }}>
            No images yet. Upload your first image above.
          </p>
        )}
      </div>
    </div>
  );
}

export default PieceDetail;



