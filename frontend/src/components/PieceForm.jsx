import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { piecesAPI, phasesAPI, materialsAPI } from '../services/api';

function PieceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    current_phase_id: '',
    material_ids: [],
  });
  const [phases, setPhases] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [phasesData, materialsData] = await Promise.all([
        phasesAPI.getAll(),
        materialsAPI.getAll(),
      ]);
      setPhases(phasesData);
      setMaterials(materialsData);

      if (isEdit) {
        const piece = await piecesAPI.getById(id);
        setFormData({
          name: piece.name || '',
          description: piece.description || '',
          current_phase_id: piece.current_phase_id || '',
          material_ids: piece.materials?.map((m) => m.id) || [],
        });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleMaterialToggle = (materialId) => {
    setFormData((prev) => ({
      ...prev,
      material_ids: prev.material_ids.includes(materialId)
        ? prev.material_ids.filter((id) => id !== materialId)
        : [...prev.material_ids, materialId],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const data = {
        ...formData,
        current_phase_id: formData.current_phase_id || null,
      };

      if (isEdit) {
        await piecesAPI.update(id, data);
      } else {
        await piecesAPI.create(data);
      }

      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="card">Loading...</div>;
  }

  return (
    <div className="card">
      <h2>{isEdit ? 'Edit Piece' : 'Create New Piece'}</h2>

      {error && <div className="error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
          />
        </div>

        <div className="form-group">
          <label htmlFor="current_phase_id">Current Phase</label>
          <select
            id="current_phase_id"
            name="current_phase_id"
            value={formData.current_phase_id}
            onChange={handleChange}
          >
            <option value="">No phase</option>
            {phases.map((phase) => (
              <option key={phase.id} value={phase.id}>
                {phase.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Materials</label>
          {materials.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic' }}>
              No materials available. Create materials first.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {materials.map((material) => (
                <label key={material.id} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.material_ids.includes(material.id)}
                    onChange={() => handleMaterialToggle(material.id)}
                    style={{ marginRight: '10px', width: 'auto' }}
                  />
                  <span>
                    {material.name} <small>({material.type})</small>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="btn-group">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/')}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default PieceForm;



