import React, { useState, useEffect } from 'react';
import { materialsAPI } from '../services/api';

function MaterialManager() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', type: 'clay' });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await materialsAPI.getAll();
      setMaterials(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      if (editingId) {
        await materialsAPI.update(editingId, formData);
      } else {
        await materialsAPI.create(formData);
      }
      setFormData({ name: '', type: 'clay' });
      setEditingId(null);
      setShowForm(false);
      loadMaterials();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (material) => {
    setFormData({ name: material.name, type: material.type });
    setEditingId(material.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this material?')) {
      return;
    }

    try {
      await materialsAPI.delete(id);
      loadMaterials();
    } catch (err) {
      alert('Error deleting material: ' + err.message);
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', type: 'clay' });
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  if (loading) {
    return <div className="card">Loading...</div>;
  }

  const materialsByType = {
    clay: materials.filter((m) => m.type === 'clay'),
    glaze: materials.filter((m) => m.type === 'glaze'),
    other: materials.filter((m) => m.type === 'other'),
  };

  return (
    <div>
      <div className="actions-row">
        <h2>Manage Materials</h2>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormData({ name: '', type: 'clay' });
          }}
          className="btn btn-primary"
        >
          Add New Material
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3>{editingId ? 'Edit Material' : 'Create New Material'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="material-name">Name *</label>
              <input
                type="text"
                id="material-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="material-type">Type *</label>
              <select
                id="material-type"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                required
              >
                <option value="clay">Clay</option>
                <option value="glaze">Glaze</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="btn-group">
              <button type="submit" className="btn btn-primary">
                {editingId ? 'Update' : 'Create'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {materials.length === 0 ? (
        <div className="card">
          <p>No materials yet. Create your first material to get started!</p>
        </div>
      ) : (
        <>
          {Object.entries(materialsByType).map(
            ([type, typeMaterials]) =>
              typeMaterials.length > 0 && (
                <div key={type} className="card" style={{ marginBottom: '20px' }}>
                  <h3 style={{ textTransform: 'capitalize' }}>{type}</h3>
                  <div className="material-list">
                    {typeMaterials.map((material) => (
                      <div key={material.id} className="material-item">
                        <span className="name">{material.name}</span>
                        <div className="actions">
                          <button
                            onClick={() => handleEdit(material)}
                            className="btn btn-secondary"
                            style={{ fontSize: '0.9rem', padding: '5px 10px' }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(material.id)}
                            className="btn btn-danger"
                            style={{ fontSize: '0.9rem', padding: '5px 10px' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
          )}
        </>
      )}
    </div>
  );
}

export default MaterialManager;



