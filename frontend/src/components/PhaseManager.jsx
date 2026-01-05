import React, { useState, useEffect } from 'react';
import { phasesAPI } from '../services/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { GripVertical, Edit, Trash2, Plus } from 'lucide-react';

function PhaseManager() {
  const [phases, setPhases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', display_order: 0 });
  const [showForm, setShowForm] = useState(false);
  const [draggedPhase, setDraggedPhase] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  useEffect(() => {
    loadPhases();
  }, []);

  const loadPhases = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await phasesAPI.getAll();
      const sorted = data.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      setPhases(sorted);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e, phase, index) => {
    setDraggedPhase({ phase, index });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedPhase && draggedPhase.index !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e, targetIndex) => {
    e.preventDefault();
    setDragOverIndex(null);

    if (!draggedPhase || draggedPhase.index === targetIndex) {
      setDraggedPhase(null);
      return;
    }

    const newPhases = [...phases];
    const [removed] = newPhases.splice(draggedPhase.index, 1);
    newPhases.splice(targetIndex, 0, removed);

    const updatedPhases = newPhases.map((phase, index) => ({
      ...phase,
      display_order: index
    }));

    try {
      await Promise.all(
        updatedPhases.map((phase, index) =>
          phasesAPI.update(phase.id, { ...phase, display_order: index })
        )
      );
      setPhases(updatedPhases);
      setDraggedPhase(null);
    } catch (err) {
      setError(err.message);
      setDraggedPhase(null);
      loadPhases();
    }
  };

  const handleDragEnd = () => {
    setDraggedPhase(null);
    setDragOverIndex(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      if (editingId) {
        await phasesAPI.update(editingId, formData);
      } else {
        const maxOrder = phases.length > 0 
          ? Math.max(...phases.map(p => p.display_order || 0))
          : -1;
        await phasesAPI.create({ ...formData, display_order: maxOrder + 1 });
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
        <h2 className="text-2xl font-bold">Manage Phases</h2>
        <Button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormData({ name: '', display_order: 0 });
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add New Phase
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Phase' : 'Create New Phase'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phase-name">Name *</Label>
                <Input
                  id="phase-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phase-order">Display Order</Label>
                <Input
                  id="phase-order"
                  type="number"
                  value={formData.display_order}
                  onChange={(e) =>
                    setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="submit">
                  {editingId ? 'Update' : 'Create'}
                </Button>
                <Button type="button" variant="secondary" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {phases.length === 0 ? (
            <p className="text-center text-[var(--color-text-tertiary)]">No phases yet. Create your first phase to get started!</p>
          ) : (
            <div className="space-y-2">
              {phases.map((phase, index) => (
                <div
                  key={phase.id}
                  className={`flex items-center justify-between p-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors ${
                    draggedPhase?.index === index ? 'opacity-50' : ''
                  } ${dragOverIndex === index ? 'border-[var(--color-primary)] bg-[var(--color-surface-hover)]' : ''} hover:bg-[var(--color-surface-hover)]`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, phase, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-5 w-5 text-[var(--color-text-tertiary)] cursor-grab" />
                    <div>
                      <div className="font-medium">{phase.name}</div>
                      <div className="text-sm text-[var(--color-text-tertiary)]">Position: {index + 1}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleEdit(phase)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(phase.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default PhaseManager;
