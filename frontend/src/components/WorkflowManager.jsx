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
  const [dragPosition, setDragPosition] = useState(null);
  const [touchTimer, setTouchTimer] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

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
    setDragPosition({ x: e.clientX, y: e.clientY });
    e.dataTransfer.effectAllowed = 'move';
    // Make default drag image invisible
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);
  };

  const handleDrag = (e) => {
    if (e.clientX !== 0 && e.clientY !== 0) {
      setDragPosition({ x: e.clientX, y: e.clientY });
    }
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
      display_order: index + 1
    }));

    try {
      await Promise.all(
        updatedItems.map((item, index) =>
          currentAPI.update(item.id, { ...item, display_order: index + 1 })
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
    setDragPosition(null);
  };

  // Touch event handlers for mobile support with delay
  const handleTouchStart = (e, item, index) => {
    const touch = e.touches[0];

    setTouchStart({
      x: touch.clientX,
      y: touch.clientY,
      item: item,
      index: index
    });

    // Set a timer to start dragging after 300ms
    const timer = setTimeout(() => {
      setDraggedItem({ item, index });
      setIsDragging(true);
      setDragPosition({ x: touch.clientX, y: touch.clientY });
    }, 300);

    setTouchTimer(timer);
  };

  const handleTouchMove = (e) => {
    if (!touchStart) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStart.x);
    const deltaY = Math.abs(touch.clientY - touchStart.y);

    // If user moves finger before timer completes, cancel drag and allow scrolling
    if (touchTimer && (deltaX > 10 || deltaY > 10)) {
      clearTimeout(touchTimer);
      setTouchTimer(null);
      setTouchStart(null);
      return;
    }

    // If dragging has started, prevent scrolling and update position
    if (isDragging && draggedItem) {
      e.preventDefault();
      e.stopPropagation();

      setDragPosition({ x: touch.clientX, y: touch.clientY });

      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      const itemElement = element?.closest('[data-drag-index]');

      if (itemElement) {
        const targetIndex = parseInt(itemElement.getAttribute('data-drag-index'));
        if (!isNaN(targetIndex) && targetIndex !== draggedItem.index) {
          setDragOverIndex(targetIndex);
        }
      }
    }
  };

  const handleTouchEnd = async (e) => {
    // Clear timer if it hasn't fired yet (user just tapped or started scrolling)
    if (touchTimer) {
      clearTimeout(touchTimer);
      setTouchTimer(null);
      setTouchStart(null);
      return; // Don't preventDefault - allow normal tap behavior
    }

    setTouchStart(null);

    // If we're not dragging, don't preventDefault (allows buttons to work)
    if (!isDragging || !draggedItem) {
      setDraggedItem(null);
      setDragOverIndex(null);
      setDragPosition(null);
      setIsDragging(false);
      return;
    }

    // We're dragging, so preventDefault and handle the drop
    e.preventDefault();

    if (dragOverIndex === null) {
      setDraggedItem(null);
      setDragOverIndex(null);
      setDragPosition(null);
      setIsDragging(false);
      return;
    }

    const targetIndex = dragOverIndex;
    setDragOverIndex(null);

    if (draggedItem.index === targetIndex) {
      setDraggedItem(null);
      setDragPosition(null);
      setIsDragging(false);
      return;
    }

    const newItems = [...currentItems];
    const [removed] = newItems.splice(draggedItem.index, 1);
    newItems.splice(targetIndex, 0, removed);

    const updatedItems = newItems.map((item, index) => ({
      ...item,
      display_order: index + 1
    }));

    try {
      await Promise.all(
        updatedItems.map((item, index) =>
          currentAPI.update(item.id, { ...item, display_order: index + 1 })
        )
      );
      setCurrentItems(updatedItems);
      setDraggedItem(null);
      setDragPosition(null);
      setIsDragging(false);
    } catch (err) {
      setError(err.message);
      setDraggedItem(null);
      setDragPosition(null);
      setIsDragging(false);
      loadData();
    }
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
                  data-drag-index={index}
                  className={`flex items-center justify-between p-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] transition-all cursor-move ${
                    draggedItem?.index === index ? 'opacity-30' : ''
                  } ${dragOverIndex === index ? 'border-2 border-[var(--color-primary)] bg-[var(--color-surface-hover)] scale-105' : ''} hover:bg-[var(--color-surface-hover)] hover:shadow-md`}
                  style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item, index)}
                  onDrag={handleDrag}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  onTouchStart={(e) => handleTouchStart(e, item, index)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
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
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating drag preview */}
      {draggedItem && dragPosition && (
        <div
          className="fixed pointer-events-none z-50 opacity-80"
          style={{
            left: dragPosition.x,
            top: dragPosition.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="flex items-center justify-between p-4 rounded-md border-2 border-[var(--color-primary)] bg-[var(--color-surface)] shadow-2xl max-w-md">
            <div className="flex items-center gap-3">
              <GripVertical className="h-5 w-5 text-[var(--color-text-tertiary)]" />
              <div>
                <div className="font-medium">{draggedItem.item.name}</div>
                <div className="text-sm text-[var(--color-text-tertiary)]">Position: {draggedItem.index + 1}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkflowManager;
