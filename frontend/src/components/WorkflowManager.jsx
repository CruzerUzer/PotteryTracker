import React, { useState, useEffect } from 'react';
import { phasesAPI, locationsAPI } from '../services/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { GripVertical, Edit, Trash2, Plus, Layers, MapPin } from 'lucide-react';

function WorkflowManager() {
  const [activeTab, setActiveTab] = useState('phases');
  const [phases, setPhases] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', display_order: 0 });
  const [showForm, setShowForm] = useState(false);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [phasesData, locationsData] = await Promise.all([
        phasesAPI.getAll(),
        locationsAPI.getAll(),
      ]);
      const sortedPhases = phasesData.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      const sortedLocations = locationsData.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      setPhases(sortedPhases);
      setLocations(sortedLocations);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const currentItems = activeTab === 'phases' ? phases : locations;
  const currentAPI = activeTab === 'phases' ? phasesAPI : locationsAPI;
  const setCurrentItems = activeTab === 'phases' ? setPhases : setLocations;
  const itemLabel = activeTab === 'phases' ? 'Phase' : 'Location';

  const handleDragStart = (e, item, index) => {
    setDraggedItem({ item, index });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedItem && draggedItem.index !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = async (e, targetIndex) => {
    e.preventDefault();
    setDragOverIndex(null);

    if (!draggedItem || draggedItem.index === targetIndex) {
      setDraggedItem(null);
      return;
    }

    const newItems = [...currentItems];
    const [removed] = newItems.splice(draggedItem.index, 1);
    newItems.splice(targetIndex, 0, removed);

    const updatedItems = newItems.map((item, index) => ({
      ...item,
      display_order: index
    }));

    try {
      await Promise.all(
        updatedItems.map((item, index) =>
          currentAPI.update(item.id, { ...item, display_order: index })
        )
      );
      setCurrentItems(updatedItems);
      setDraggedItem(null);
    } catch (err) {
      setError(err.message);
      setDraggedItem(null);
      loadData();
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverIndex(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      if (editingId) {
        await currentAPI.update(editingId, formData);
      } else {
        const maxOrder = currentItems.length > 0
          ? Math.max(...currentItems.map(p => p.display_order || 0))
          : -1;
        await currentAPI.create({ ...formData, display_order: maxOrder + 1 });
      }
      setFormData({ name: '', display_order: 0 });
      setEditingId(null);
      setShowForm(false);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (item) => {
    setFormData({ name: item.name, display_order: item.display_order });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`Are you sure you want to delete this ${itemLabel.toLowerCase()}?`)) {
      return;
    }

    try {
      await currentAPI.delete(id);
      loadData();
    } catch (err) {
      alert(`Error deleting ${itemLabel.toLowerCase()}: ` + err.message);
    }
  };

  const handleCancel = () => {
    setFormData({ name: '', display_order: 0 });
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setShowForm(false);
    setEditingId(null);
    setFormData({ name: '', display_order: 0 });
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
        <h2 className="text-2xl font-bold">Workflow</h2>
        <Button
          onClick={() => {
            setShowForm(true);
            setEditingId(null);
            setFormData({ name: '', display_order: 0 });
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add New {itemLabel}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[var(--color-border)]">
        <button
          onClick={() => handleTabChange('phases')}
          className={`flex items-center gap-2 px-4 py-2 -mb-px border-b-2 transition-colors ${
            activeTab === 'phases'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <Layers className="h-4 w-4" />
          Phases ({phases.length})
        </button>
        <button
          onClick={() => handleTabChange('locations')}
          className={`flex items-center gap-2 px-4 py-2 -mb-px border-b-2 transition-colors ${
            activeTab === 'locations'
              ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
        >
          <MapPin className="h-4 w-4" />
          Locations ({locations.length})
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? `Edit ${itemLabel}` : `Create New ${itemLabel}`}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="item-name">Name *</Label>
                <Input
                  id="item-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-order">Display Order</Label>
                <Input
                  id="item-order"
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
          {currentItems.length === 0 ? (
            <p className="text-center text-[var(--color-text-tertiary)]">
              No {activeTab} yet. Create your first {itemLabel.toLowerCase()} to get started!
            </p>
          ) : (
            <div className="space-y-2">
              {currentItems.map((item, index) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] transition-all cursor-move ${
                    draggedItem?.index === index ? 'opacity-50 scale-95' : ''
                  } ${dragOverIndex === index ? 'border-2 border-[var(--color-primary)] bg-[var(--color-surface-hover)] scale-105' : ''} hover:bg-[var(--color-surface-hover)] hover:shadow-md`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="flex items-center gap-3 pointer-events-none">
                    <GripVertical className="h-5 w-5 text-[var(--color-text-tertiary)]" />
                    <div>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-sm text-[var(--color-text-tertiary)]">Position: {index + 1}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 pointer-events-auto">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(item);
                      }}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
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

export default WorkflowManager;
