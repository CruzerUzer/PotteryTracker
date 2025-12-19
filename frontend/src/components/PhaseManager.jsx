import React, { useState, useEffect } from 'react';
import { phasesAPI } from '../services/api';

function PhaseManager() {
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', display_order: 0 });
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadPhases();
  }, []);

  const loadPhases = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await phasesAPI.getAll();
      setPhases(data);
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
        await phasesAPI.update(editingId, formData);
      } else {
        await phasesAPI.create(formData);
      }
      setFormData({ name: '', display_order: 0 });
      setEditingId(null);
      setShowForm(false);
      loadPhases();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (phase) => {
    setFormData({ name: phase.name, display_order: phase.display_order });
    setEditingId(phase.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this phase?')) {
      return;
    }

    try {
      await phasesAPI.delete(id);
      loadPhases();
    } catch (err) {
      alert('Error deleting phase: ' + err.message);
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', display_order: 0 });
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  if (loading) {
    return <div className="card">Loading...</div>;
  }

  return (
    <div>
      <div className="actions-row">
        <h2>Manage Phases</h2>
        <button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormData({ name: '', display_order: 0 });
          }}
          className="btn btn-primary"
        >
          Add New Phase
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {showForm && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3>{editingId ? 'Edit Phase' : 'Create New Phase'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="phase-name">Name *</label>
              <input
                type="text"
                id="phase-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="phase-order">Display Order</label>
              <input
                type="number"
                id="phase-order"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                }
              />
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

      <div className="card">
        {phases.length === 0 ? (
          <p>No phases yet. Create your first phase to get started!</p>
        ) : (
          <div className="phase-list">
            {phases.map((phase) => (
              <div key={phase.id} className="phase-item">
                <div>
                  <span className="name">{phase.name}</span>
                  <small style={{ display: 'block', color: '#666', marginTop: '5px' }}>
                    Order: {phase.display_order}
                  </small>
                </div>
                <div className="actions">
                  <button
                    onClick={() => handleEdit(phase)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.9rem', padding: '5px 10px' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(phase.id)}
                    className="btn btn-danger"
                    style={{ fontSize: '0.9rem', padding: '5px 10px' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PhaseManager;


