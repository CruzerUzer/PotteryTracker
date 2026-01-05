import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { piecesAPI, phasesAPI, materialsAPI, imagesAPI } from '../services/api';
import ImageUpload from './ImageUpload';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

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
  const [createdPieceId, setCreatedPieceId] = useState(null);

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
      
      // Sort phases by display_order
      const sortedPhases = phasesData.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      setPhases(sortedPhases);
      setMaterials(materialsData);

      if (isEdit) {
        const piece = await piecesAPI.getById(id);
        setFormData({
          name: piece.name || '',
          description: piece.description || '',
          current_phase_id: piece.current_phase_id || '',
          material_ids: piece.materials?.map((m) => m.id) || [],
        });
      } else {
        // For new pieces, set default phase to the first phase (by display_order)
        const firstPhase = sortedPhases.length > 0 ? sortedPhases[0] : null;
        setFormData(prev => ({
          ...prev,
          current_phase_id: firstPhase ? firstPhase.id.toString() : '',
        }));
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

  const handlePhaseChange = (value) => {
    setFormData((prev) => ({ ...prev, current_phase_id: value || '' }));
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

      let pieceId;
      if (isEdit) {
        await piecesAPI.update(id, data);
        pieceId = id;
        navigate(`/pieces/${pieceId}`);
      } else {
        const newPiece = await piecesAPI.create(data);
        pieceId = newPiece.id;
        setCreatedPieceId(pieceId);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUploaded = () => {
    // Images uploaded successfully
  };

  if (loading) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-6">
          <div className="text-center">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>{isEdit ? 'Edit Piece' : 'Create New Piece'}</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="current_phase_id">Current Phase</Label>
              <Select value={formData.current_phase_id || undefined} onValueChange={(value) => handlePhaseChange(value || '')}>
                <SelectTrigger id="current_phase_id">
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
            </div>

            <div className="space-y-2">
              <Label>Materials</Label>
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
                        checked={formData.material_ids.includes(material.id)}
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
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
              </Button>
              {createdPieceId && !isEdit && (
                <Button type="button" variant="secondary" asChild>
                  <Link to={`/pieces/${createdPieceId}`}>View Piece</Link>
                </Button>
              )}
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/kanban')}
                disabled={saving}
              >
                {createdPieceId ? 'Back to Kanban' : 'Cancel'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Image Upload Section */}
      {(isEdit || createdPieceId) && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Images</CardTitle>
          </CardHeader>
          <CardContent>
            <ImageUpload 
              pieceId={isEdit ? id : createdPieceId} 
              phases={phases} 
              onUploaded={handleImageUploaded}
              defaultPhaseId={formData.current_phase_id || null}
            />
            <p className="text-sm text-[var(--color-text-tertiary)] mt-4">
              {isEdit ? 'Add more images to this piece.' : 'You can now add images to your newly created piece.'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PieceForm;
