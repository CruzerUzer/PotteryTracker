import React, { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Sheet, SheetContent } from '../ui/sheet';
import { useToast } from '../ui/toast';
import { materialsAPI, locationsAPI, studyAPI } from '../../services/api';
import { readLocal, writeLocal } from './studyUtils';

const FORMS = ['Cylinder', 'Bägare', 'Mugg', 'Skål', 'Tallrik', 'Burk', 'Lock', 'Flaska', 'Kanna'];
const LAST_KEY = 'study.seriesDefaults';

/**
 * Skapa en serie: antal, namn, vikt, lera och plats. Skapar alstren i fasen
 * för "drejat" och kopplar dem till passet.
 */
function SeriesForm({ open, onOpenChange, sessionId, suggestion, onCreated }) {
  const toast = useToast();
  const last = readLocal(LAST_KEY, {});
  const [count, setCount] = useState(6);
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [clayId, setClayId] = useState(last.clayId || '');
  const [locationId, setLocationId] = useState(last.locationId || '');
  const [clays, setClays] = useState([]);
  const [locations, setLocations] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCount(suggestion?.count || 6);
    setName(suggestion?.name || '');
    setWeight(suggestion?.weight ? String(suggestion.weight) : '');
    Promise.all([materialsAPI.getAll(), locationsAPI.getAll()])
      .then(([m, l]) => {
        setClays(m.filter((x) => x.type === 'clay'));
        setLocations([...l].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
      })
      .catch(() => {});
  }, [open, suggestion]);

  const submit = async (e) => {
    e?.preventDefault();
    if (!name.trim()) {
      toast.error('Ge serien ett namn', 'Till exempel Cylinder.');
      return;
    }
    setSaving(true);
    try {
      const result = await studyAPI.createSeries(sessionId, {
        count,
        name: name.trim(),
        weight_grams: weight ? Number(weight) : null,
        clay_material_id: clayId ? Number(clayId) : null,
        location_id: locationId ? Number(locationId) : null,
      });
      writeLocal(LAST_KEY, { clayId, locationId });
      toast.success(`Serie S${result.series.number} skapad`, `${count} alster. Märk foten med S${result.series.number}.`);
      onCreated?.(result);
      onOpenChange(false);
    } catch (err) {
      toast.error('Kunde inte skapa serien', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title="Ny serie"
        description="Skapar alstren i På gång och kopplar dem till passet som drejade."
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => onOpenChange(false)} disabled={saving}>
              Avbryt
            </button>
            <button type="submit" form="series-form" className="btn btn-primary" disabled={saving}>
              {saving ? 'Skapar…' : `Skapa ${count} alster`}
            </button>
          </>
        }
      >
        <form id="series-form" className="study-form" onSubmit={submit}>
          <div className="field">
            <span className="field-sublabel">Antal</span>
            <div className="stepper">
              <button type="button" className="stepper-btn" onClick={() => setCount((c) => Math.max(1, c - 1))} aria-label="Färre">
                <Minus size={22} />
              </button>
              <span className="stepper-value" aria-live="polite">{count}</span>
              <button type="button" className="stepper-btn" onClick={() => setCount((c) => Math.min(40, c + 1))} aria-label="Fler">
                <Plus size={22} />
              </button>
            </div>
          </div>

          <label className="field">
            <span className="field-sublabel">Namn</span>
            <input
              className="field-input field-input--lg"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cylinder"
              maxLength={80}
            />
          </label>
          <div className="chip-row">
            {FORMS.map((f) => (
              <button key={f} type="button" className={`chip${name === f ? ' chip--active' : ''}`} onClick={() => setName(f)}>
                {f}
              </button>
            ))}
          </div>

          <label className="field">
            <span className="field-sublabel">Vikt per alster (gram)</span>
            <input
              className="field-input field-input--lg"
              inputMode="numeric"
              pattern="[0-9]*"
              value={weight}
              onChange={(e) => setWeight(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="500"
            />
          </label>

          <label className="field">
            <span className="field-sublabel">Lera</span>
            <select className="field-input" value={clayId} onChange={(e) => setClayId(e.target.value)}>
              <option value="">Ingen vald</option>
              {clays.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {clays.length === 0 && <span className="field-hint">Lägg till leror under Material.</span>}
          </label>

          <label className="field">
            <span className="field-sublabel">Plats</span>
            <select className="field-input" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">Ingen plats</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>
        </form>
      </SheetContent>
    </Sheet>
  );
}

export default SeriesForm;
