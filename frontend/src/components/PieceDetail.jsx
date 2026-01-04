import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { piecesAPI, phasesAPI, imagesAPI } from '../services/api';
import ImageUpload from './ImageUpload';
import ImageLightbox from './ImageLightbox';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Edit, Trash2, ArrowLeft, Package, Image as ImageIcon } from 'lucide-react';

function PieceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [piece, setPiece] = useState(null);
  const [phases, setPhases] = useState([]);
  const [selectedPhase, setSelectedPhase] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [pieceData, phasesData] = await Promise.all([
        piecesAPI.getById(id),
        phasesAPI.getAll(),
      ]);
      setPiece(pieceData);
      setPhases(phasesData);
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
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/list">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">{piece.name}</h1>
          {piece.done === 1 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-success)] text-white">
              Done
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link to={`/pieces/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Main content */}
      <Card>
        <CardContent className="pt-6 space-y-6">
          {piece.description && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Description</h3>
              <p className="whitespace-pre-wrap text-[var(--color-text-primary)]">{piece.description}</p>
            </div>
          )}

          <div>
            <Label htmlFor="phase-select">Current Phase</Label>
            <div className="mt-2 max-w-xs">
              <Select value={selectedPhase || ''} onValueChange={handlePhaseChange} disabled={updating}>
                <SelectTrigger id="phase-select">
                  <SelectValue placeholder="Select a phase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No phase</SelectItem>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id.toString()}>
                      {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {updating && <p className="text-sm text-[var(--color-text-tertiary)] mt-2">Updating...</p>}
            </div>
            {currentPhase && (
              <div className="mt-3">
                <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-[var(--phase-color-1)] text-[var(--color-text-primary)] border border-[var(--color-border)]">
                  {currentPhase.name}
                </span>
              </div>
            )}
          </div>

          {piece.materials && piece.materials.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Package className="h-5 w-5" />
                Materials
              </h3>
              <div className="flex flex-wrap gap-2">
                {piece.materials.map((material) => (
                  <span
                    key={material.id}
                    className="inline-flex items-center px-3 py-1 rounded-md text-sm bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] border border-[var(--color-border)]"
                  >
                    {material.name} <span className="ml-2 text-[var(--color-text-tertiary)]">({material.type})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
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
