import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Layers, MapPin } from 'lucide-react';
import { piecesAPI, phasesAPI, locationsAPI, materialsAPI } from '../services/api';
import MaterialPicker from './MaterialPicker';
import { phaseColor } from './kanban/phaseColors';
import { useToast } from './ui/toast';
import { useBackNavigation } from '../hooks/useBackNavigation';

const byOrder = (a, b) => (a.display_order || 0) - (b.display_order || 0);

/**
 * Ny pjäs (och redigering via /pieces/:id/edit om den routen läggs till).
 * Fas och plats väljs med chips, material med sökbar väljare.
 * Sparaknappen sitter fast i botten. Efter skapande öppnas pjäsen med
 * bilduppladdningen framme.
 */
function PieceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const goBack = useBackNavigation('/');
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    current_phase_id: '',
    current_location_id: '',
    material_ids: [],
  });
  const [phases, setPhases] = useState([]);
  const [locations, setLocations] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const [phasesData, locationsData, materialsData] = await Promise.all([
          phasesAPI.getAll(),
          locationsAPI.getAll(),
          materialsAPI.getAll(),
        ]);
        if (!alive) return;
        const sortedPhases = [...phasesData].sort(byOrder);
        const sortedLocations = [...locationsData].sort(byOrder);
        setPhases(sortedPhases);
        setLocations(sortedLocations);
        setMaterials(materialsData);

        if (isEdit) {
          const piece = await piecesAPI.getById(id);
          if (!alive) return;
          setFormData({
            name: piece.name || '',
            description: piece.description || '',
            current_phase_id: piece.current_phase_id ? String(piece.current_phase_id) : '',
            current_location_id: piece.current_location_id ? String(piece.current_location_id) : '',
            material_ids: piece.materials?.map((m) => m.id) || [],
          });
        } else {
          // Ny pjäs börjar i första fasen och på första platsen
          setFormData((prev) => ({
            ...prev,
            current_phase_id: sortedPhases[0] ? String(sortedPhases[0].id) : '',
            current_location_id: sortedLocations[0] ? String(sortedLocations[0].id) : '',
          }));
        }
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, isEdit]);

  const set = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Pjäsen behöver ett namn');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = {
        ...formData,
        name: formData.name.trim(),
        current_phase_id: formData.current_phase_id || null,
        current_location_id: formData.current_location_id || null,
      };
      if (isEdit) {
        await piecesAPI.update(id, data);
        toast.success('Ändringarna är sparade');
        navigate(`/pieces/${id}`, { replace: true });
      } else {
        const created = await piecesAPI.create(data);
        toast.success('Pjäsen är skapad', 'Lägg gärna till en bild direkt.');
        navigate(`/pieces/${created.id}`, { replace: true, state: { justCreated: true } });
      }
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="form-page" aria-busy="true">
        <div className="skeleton h-8 w-40 mb-6" />
        <div className="space-y-4">
          <div className="skeleton h-11 w-full" />
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-10 w-2/3" />
        </div>
      </div>
    );
  }

  const chipGroup = (key, options, label, Icon, colored) => (
    <fieldset className="form-field">
      <legend className="form-label">
        <Icon size={13} aria-hidden="true" /> {label}
      </legend>
      {options.length === 0 ? (
        <p className="field-hint">Inga {label.toLowerCase()}er upplagda. Lägg till under Arbetsflöde.</p>
      ) : (
        <div className="chip-row" role="radiogroup" aria-label={label}>
          {options.map((opt, i) => {
            const active = formData[key] === String(opt.id);
            const c = colored ? phaseColor(i) : null;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`chip${colored ? ' chip--phase' : ''}${active ? ' chip--active' : ''}`}
                style={c ? { '--chip-bg': c.bg, '--chip-border': c.border, '--chip-accent': c.accent } : undefined}
                onClick={() => set(key, String(opt.id))}
              >
                {active && <Check size={14} aria-hidden="true" />}
                {opt.name}
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );

  return (
    <form className="form-page" onSubmit={handleSubmit} noValidate>
      <div className="form-header">
        <button type="button" className="icon-btn" onClick={goBack} aria-label="Tillbaka">
          <ArrowLeft size={19} />
        </button>
        <h2 className="page-title">{isEdit ? 'Redigera pjäs' : 'Ny pjäs'}</h2>
      </div>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <div className="form-card">
        <div className="form-field">
          <label htmlFor="name" className="form-label">
            Namn
          </label>
          <input
            id="name"
            name="name"
            type="text"
            className="field-input field-input--lg"
            value={formData.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="T.ex. Tekopp med blå glasyr"
            autoComplete="off"
            autoFocus={!isEdit}
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="description" className="form-label">
            Beskrivning
          </label>
          <textarea
            id="description"
            name="description"
            className="field-input"
            value={formData.description}
            onChange={(e) => set('description', e.target.value)}
            rows={4}
            placeholder="Lera, teknik, idéer…"
          />
        </div>

        {chipGroup('current_phase_id', phases, 'Fas', Layers, true)}
        {chipGroup('current_location_id', locations, 'Plats', MapPin, false)}

        <fieldset className="form-field">
          <legend className="form-label">Material</legend>
          <MaterialPicker
            materials={materials}
            value={formData.material_ids}
            onChange={(ids) => set('material_ids', ids)}
          />
        </fieldset>
      </div>

      <div className="form-savebar">
        <button type="button" className="btn btn-secondary" onClick={goBack} disabled={saving}>
          Avbryt
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving || !formData.name.trim()}>
          {saving ? 'Sparar…' : isEdit ? 'Spara ändringar' : 'Skapa pjäs'}
        </button>
      </div>
    </form>
  );
}

export default PieceForm;
