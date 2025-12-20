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

      navigate('/kanban');
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
    <div className="card" style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
      <h2 style={{ marginBottom: '16px', paddingBottom: '12px', fontSize: '1.5rem' }}>
        {isEdit ? 'Edit Piece' : 'Create New Piece'}
      </h2>

      {error && <div className="error" style={{ marginBottom: '16px' }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label htmlFor="name" style={{ marginBottom: '6px' }}>Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            style={{ padding: '8px 12px' }}
          />
        </div>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label htmlFor="description" style={{ marginBottom: '6px' }}>Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            style={{ minHeight: '80px', padding: '8px 12px' }}
          />
        </div>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label htmlFor="current_phase_id" style={{ marginBottom: '6px' }}>Current Phase</label>
          <select
            id="current_phase_id"
            name="current_phase_id"
            value={formData.current_phase_id}
            onChange={handleChange}
            style={{ padding: '8px 12px' }}
          >
            <option value="">No phase</option>
            {phases.map((phase) => (
              <option key={phase.id} value={phase.id}>
                {phase.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={{ marginBottom: '6px' }}>Materials</label>
          {materials.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic', fontSize: '0.875rem', margin: '4px 0' }}>
              No materials available. Create materials first.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {materials.map((material) => (
                <label key={material.id} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.material_ids.includes(material.id)}
                    onChange={() => handleMaterialToggle(material.id)}
                    style={{ marginRight: '10px', width: 'auto' }}
                  />
                  <span style={{ fontSize: '0.9rem' }}>
                    {material.name} <small style={{ fontSize: '0.85rem', color: '#6b7280' }}>({material.type})</small>
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="btn-group" style={{ marginTop: '16px' }}>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '8px 20px', fontSize: '0.9rem' }}>
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/kanban')}
            disabled={saving}
            style={{ padding: '8px 20px', fontSize: '0.9rem' }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default PieceForm;



