import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { piecesAPI, phasesAPI, materialsAPI, imagesAPI } from '../services/api';
import ImageUpload from './ImageUpload';
import ImageLightbox from './ImageLightbox';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Trash2, ArrowLeft, Package, Image as ImageIcon, Edit2, X, Check, Plus } from 'lucide-react';

function PieceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [piece, setPiece] = useState(null);
  const [phases, setPhases] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [selectedPhase, setSelectedPhase] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  
  // Inline editing state
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editMaterials, setEditMaterials] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [pieceData, phasesData, materialsData] = await Promise.all([
        piecesAPI.getById(id),
        phasesAPI.getAll(),
        materialsAPI.getAll(),
      ]);
      setPiece(pieceData);
      setPhases(phasesData);
      setMaterials(materialsData);
      setSelectedPhase(pieceData.current_phase_id || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePhaseChange = async (value) => {
    setUpdating(true);
    try {
      await piecesAPI.updatePhase(id, value);
      setSelectedPhase(value);
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

  const startEditing = (field, initialValue = null) => {
    if (field === 'name') {
      setEditValue(piece.name || '');
    } else if (field === 'description') {
      setEditValue(piece.description || '');
    } else if (field === 'materials') {
      setEditMaterials(piece.materials?.map(m => m.id) || []);
    }
    setEditingField(field);
  };

  const cancelEditing = () => {
    setEditingField(null);
    setEditValue('');
    setEditMaterials([]);
  };

  const saveField = async () => {
    if (saving) return;
    
    setSaving(true);
    try {
      // Always include name since backend requires it for updates
      const updateData = {
        name: piece.name,
      };
      
      if (editingField === 'name') {
        if (!editValue.trim()) {
          alert('Name cannot be empty');
          setSaving(false);
          return;
        }
        updateData.name = editValue.trim();
      } else if (editingField === 'description') {
        updateData.description = editValue.trim();
      } else if (editingField === 'materials') {
        updateData.material_ids = editMaterials;
      }

      await piecesAPI.update(id, updateData);
      await loadData();
      setEditingField(null);
      setEditValue('');
      setEditMaterials([]);
    } catch (err) {
      alert('Error saving: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleMaterialToggle = (materialId) => {
    setEditMaterials(prev =>
      prev.includes(materialId)
        ? prev.filter(id => id !== materialId)
        : [...prev, materialId]
    );
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

  if (error || !piece) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm mb-4">
            {error || 'Piece not found'}
          </div>
          <Button variant="secondary" asChild>
            <Link to="/list">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to List
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currentPhase = phases.find((p) => p.id === piece.current_phase_id);

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/list">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          {editingField === 'name' ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveField();
                  if (e.key === 'Escape') cancelEditing();
                }}
                className="text-3xl font-bold flex-1"
                autoFocus
                disabled={saving}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={saveField}
                disabled={saving}
                className="text-green-600 hover:text-green-700"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={cancelEditing}
                disabled={saving}
                className="text-red-600 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <h1
              className="text-3xl font-bold cursor-pointer hover:text-[var(--color-primary)] transition-colors flex items-center gap-2 group"
              onClick={() => startEditing('name')}
              title="Click to edit"
            >
              {piece.name}
              <Edit2 className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity" />
            </h1>
          )}
          {piece.done === 1 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-success)] text-white flex-shrink-0">
              Done
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Main content */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              Description
            </h3>
            {editingField === 'description' ? (
              <div className="space-y-2">
                <Textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={4}
                  disabled={saving}
                  className="w-full"
                />
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={saveField}
                    disabled={saving}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={cancelEditing}
                    disabled={saving}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="whitespace-pre-wrap text-[var(--color-text-primary)] p-3 rounded-md border border-transparent hover:border-[var(--color-border)] cursor-pointer group transition-colors min-h-[3rem]"
                onClick={() => startEditing('description')}
                title="Click to edit"
              >
                {piece.description ? (
                  <p className="flex items-start gap-2">
                    <span className="flex-1">{piece.description}</span>
                    <Edit2 className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0 mt-1" />
                  </p>
                ) : (
                  <p className="text-[var(--color-text-tertiary)] italic flex items-center gap-2">
                    <span>No description. Click to add one.</span>
                    <Edit2 className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Phase */}
          <div>
            <Label htmlFor="phase-select">Current Phase</Label>
            <div className="mt-2 max-w-xs">
              <Select value={selectedPhase || undefined} onValueChange={(value) => handlePhaseChange(value || '')} disabled={updating}>
                <SelectTrigger id="phase-select">
                  <SelectValue placeholder="No phase" />
                </SelectTrigger>
                <SelectContent>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id.toString()}>
                      {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {updating && <p className="text-sm text-[var(--color-text-tertiary)] mt-2">Updating...</p>}
            </div>
          </div>

          {/* Materials */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Package className="h-5 w-5" />
              Materials
            </h3>
            {editingField === 'materials' ? (
              <div className="space-y-3">
                {materials.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-tertiary)] italic">
                    No materials available. Create materials first.
                  </p>
                ) : (
                  <div className="space-y-2 border border-[var(--color-border)] rounded-md p-4 bg-[var(--color-surface)]">
                    {materials.map((material) => (
                      <label
                        key={material.id}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-[var(--color-surface-hover)] p-2 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={editMaterials.includes(material.id)}
                          onChange={() => handleMaterialToggle(material.id)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">
                          {material.name} <span className="text-[var(--color-text-tertiary)]">({material.type})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={saveField}
                    disabled={saving}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={cancelEditing}
                    disabled={saving}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="p-3 rounded-md border border-transparent hover:border-[var(--color-border)] cursor-pointer group transition-colors"
                onClick={() => startEditing('materials')}
                title="Click to edit"
              >
                {piece.materials && piece.materials.length > 0 ? (
                  <div className="flex flex-wrap gap-2 items-center">
                    {piece.materials.map((material) => (
                      <span
                        key={material.id}
                        className="inline-flex items-center px-3 py-1 rounded-md text-sm bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] border border-[var(--color-border)]"
                      >
                        {material.name} <span className="ml-2 text-[var(--color-text-tertiary)]">({material.type})</span>
                      </span>
                    ))}
                    <Edit2 className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity ml-2" />
                  </div>
                ) : (
                  <p className="text-[var(--color-text-tertiary)] italic flex items-center gap-2">
                    <span>No materials. Click to add.</span>
                    <Edit2 className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Images */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Images
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ImageUpload pieceId={id} phases={phases} onUploaded={handleImageUploaded} defaultPhaseId={piece.current_phase_id || null} />

          {piece.images && piece.images.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
                {piece.images.map((image, index) => (
                  <div
                    key={image.id}
                    className="relative group cursor-pointer rounded-md overflow-hidden border border-[var(--color-border)] hover:border-[var(--color-primary)] transition-colors"
                    onClick={() => setLightboxIndex(index)}
                  >
                    <img
                      src={imagesAPI.getFileUrl(image.id, true)}
                      alt={image.original_filename || 'Piece image'}
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-end p-2">
                      <div className="text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                        <div>{image.phase_name || 'Unknown phase'}</div>
                        <div className="text-xs opacity-90">
                          {new Date(image.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <button
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-red-700"
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
            <p className="text-center text-[var(--color-text-tertiary)] italic mt-6">
              No images yet. Upload your first image above.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default PieceDetail;
