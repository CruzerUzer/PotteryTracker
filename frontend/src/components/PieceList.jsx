import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { piecesAPI, phasesAPI, locationsAPI, materialsAPI, imagesAPI } from '../services/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, X, Package, Image as ImageIcon, MapPin } from 'lucide-react';

function PieceList() {
  const [pieces, setPieces] = useState([]);
  const [phases, setPhases] = useState([]);
  const [locations, setLocations] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [selectedPhase, setSelectedPhase] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, [selectedPhase, selectedMaterial, searchTerm, dateFrom, dateTo]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [piecesData, phasesData, locationsData, materialsData] = await Promise.all([
        piecesAPI.getAll({
          phase_id: selectedPhase === 'no-phase' ? 'no-phase' : (selectedPhase || null),
          material_id: selectedMaterial || null,
          search: searchTerm || null,
          date_from: dateFrom || null,
          date_to: dateTo || null,
        }),
        phasesAPI.getAll(),
        locationsAPI.getAll(),
        materialsAPI.getAll(),
      ]);
      setPieces(piecesData);
      setPhases(phasesData.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
      setLocations(locationsData.sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
      setMaterials(materialsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSelectedPhase('');
    setSelectedMaterial('');
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
  };

  const handlePhaseChange = async (pieceId, newPhaseId) => {
    try {
      await piecesAPI.updatePhase(pieceId, newPhaseId);
      // Update local state
      setPieces(prevPieces =>
        prevPieces.map(piece =>
          piece.id === pieceId
            ? {
                ...piece,
                current_phase_id: newPhaseId,
                phase_name: phases.find(p => p.id === newPhaseId)?.name || null
              }
            : piece
        )
      );
    } catch (err) {
      console.error('Failed to update phase:', err);
      setError('Failed to update phase: ' + err.message);
    }
  };

  const handleLocationChange = async (pieceId, newLocationId) => {
    try {
      await piecesAPI.updateLocation(pieceId, newLocationId);
      // Update local state
      setPieces(prevPieces =>
        prevPieces.map(piece =>
          piece.id === pieceId
            ? {
                ...piece,
                current_location_id: newLocationId,
                location_name: locations.find(l => l.id === newLocationId)?.name || null
              }
            : piece
        )
      );
    } catch (err) {
      console.error('Failed to update location:', err);
      setError('Failed to update location: ' + err.message);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Ceramic Pieces</h2>
        <Button asChild>
          <Link to="/pieces/new">
            <Plus className="mr-2 h-4 w-4" />
            Add New Piece
          </Link>
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Search</Label>
              <Input
                type="text"
                placeholder="Search by name or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Phase</Label>
              <Select value={selectedPhase || undefined} onValueChange={(value) => setSelectedPhase(value || '')}>
                <SelectTrigger>
                  <SelectValue placeholder="All Phases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no-phase">No Phase</SelectItem>
                  {phases.map((phase) => (
                    <SelectItem key={phase.id} value={phase.id.toString()}>
                      {phase.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Material</Label>
              <Select value={selectedMaterial || undefined} onValueChange={(value) => setSelectedMaterial(value || '')}>
                <SelectTrigger>
                  <SelectValue placeholder="All Materials" />
                </SelectTrigger>
                <SelectContent>
                  {materials.map((material) => (
                    <SelectItem key={material.id} value={material.id.toString()}>
                      {material.name} ({material.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Date From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Date To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="space-y-2 flex items-end">
              <Button variant="outline" onClick={clearFilters} className="w-full">
                <X className="mr-2 h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {pieces.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-[var(--color-text-tertiary)]">No pieces found. Create your first piece to get started!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pieces.map((piece) => (
            <Card key={piece.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <Link
                to={`/pieces/${piece.id}`}
                className="block"
              >
                <div className="relative">
                  {piece.latest_image_id ? (
                    <div className="aspect-video overflow-hidden bg-[var(--color-surface-hover)]">
                      <img
                        src={imagesAPI.getFileUrl(piece.latest_image_id, true)}
                        alt={piece.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-[var(--color-surface-hover)] flex items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-[var(--color-text-tertiary)]" />
                    </div>
                  )}
                </div>
              </Link>
              <CardContent className="p-4">
                <Link to={`/pieces/${piece.id}`} className="block">
                  <h3 className="font-semibold text-lg mb-2 line-clamp-1">{piece.name}</h3>
                </Link>

                {piece.done === 1 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-success)] text-white mr-2 mb-2">
                    Done
                  </span>
                )}

                <div className="flex flex-wrap gap-2 mb-2">
                  {/* Phase selector */}
                  <div className="flex-1 min-w-[120px]" onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={piece.current_phase_id?.toString() || 'null'}
                      onValueChange={(value) => handlePhaseChange(piece.id, value === 'null' ? null : parseInt(value))}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue>
                          {piece.phase_name || 'No phase'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="null">No phase</SelectItem>
                        {phases.map(phase => (
                          <SelectItem key={phase.id} value={phase.id.toString()}>
                            {phase.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Location selector */}
                  <div className="flex-1 min-w-[120px]" onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={piece.current_location_id?.toString() || 'null'}
                      onValueChange={(value) => handleLocationChange(piece.id, value === 'null' ? null : parseInt(value))}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {piece.location_name || 'No location'}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="null">No location</SelectItem>
                        {locations.map(location => (
                          <SelectItem key={location.id} value={location.id.toString()}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {piece.description && (
                  <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 mt-2">
                    {piece.description}
                  </p>
                )}
                <div className="flex items-center gap-4 mt-3 text-xs text-[var(--color-text-tertiary)]">
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {piece.material_count || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" />
                    {piece.image_count || 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default PieceList;
