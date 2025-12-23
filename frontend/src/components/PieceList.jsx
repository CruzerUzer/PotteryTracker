import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { piecesAPI, phasesAPI, materialsAPI, imagesAPI } from '../services/api';

function PieceList() {
  const [pieces, setPieces] = useState([]);
  const [phases, setPhases] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [selectedPhase, setSelectedPhase] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, [selectedPhase, selectedMaterial, searchTerm, dateFrom, dateTo]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [piecesData, phasesData, materialsData] = await Promise.all([
        piecesAPI.getAll({
          phase_id: selectedPhase || null,
          material_id: selectedMaterial || null,
          search: searchTerm || null,
          date_from: dateFrom || null,
          date_to: dateTo || null,
        }),
        phasesAPI.getAll(),
        materialsAPI.getAll(),
      ]);
      setPieces(piecesData);
      setPhases(phasesData);
      setMaterials(materialsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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

      <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Filters</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div className="form-group">
            <label>Search:</label>
            <input
              type="text"
              placeholder="Search by name or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group">
            <label>Phase:</label>
            <select
              value={selectedPhase}
              onChange={(e) => setSelectedPhase(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">All Phases</option>
              {phases.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Material:</label>
            <select
              value={selectedMaterial}
              onChange={(e) => setSelectedMaterial(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">All Materials</option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name} ({material.type})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Date From:</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group">
            <label>Date To:</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={() => {
                setSelectedPhase('');
                setSelectedMaterial('');
                setSearchTerm('');
                setDateFrom('');
                setDateTo('');
              }}
              className="btn btn-secondary"
              style={{ width: '100%' }}
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {pieces.length === 0 ? (
        <div className="card">
          <p>No pieces found. Create your first piece to get started!</p>
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
                    {piece.done === 1 && (
                      <span className="done-badge">Done</span>
                    )}
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
                      src={imagesAPI.getFileUrl(piece.latest_image_id, true)}
                      alt={piece.name}
                    />
                  </div>
                )}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PieceList;


