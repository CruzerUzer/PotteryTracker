import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Plus, Trash2, X } from 'lucide-react';
import { Sheet, SheetContent } from '../ui/sheet';
import { useToast } from '../ui/toast';
import { useConfirm } from '../ui/confirm-dialog';
import { materialsAPI, studyAPI } from '../../services/api';
import { formatDay, sessionTitle } from './studyUtils';

export const METHODS = [
  { id: 'dip', label: 'Dopp' },
  { id: 'brush', label: 'Pensel' },
  { id: 'pour', label: 'Hällt' },
  { id: 'spray', label: 'Spruta' },
  { id: 'other', label: 'Annat' },
];
export const METHOD_LABEL = Object.fromEntries(METHODS.map((m) => [m.id, m.label]));

const EMPTY_TEST = {
  tile_code: '', session_id: '', clay_material_id: '', glaze_material_id: '', recipe_id: '',
  method: 'dip', dip_seconds: '', coats: '', layering: '', firing: '', result: '',
};

/** Provplatta: kod, lera, glasyr eller recept, applicering, bränning, resultat, foto. */
export function GlazeTestForm({ open, onOpenChange, testId, sessionId, onSaved }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState(EMPTY_TEST);
  const [images, setImages] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setSavedId(testId || null);
    setImages([]);
    Promise.all([materialsAPI.getAll(), studyAPI.listRecipes(), studyAPI.listSessions()])
      .then(([m, r, s]) => {
        setMaterials(m);
        setRecipes(r);
        setSessions(s.slice(0, 30));
      })
      .catch(() => {});
    if (testId) {
      studyAPI.getGlazeTest(testId).then((t) => {
        setForm(Object.fromEntries(Object.keys(EMPTY_TEST).map((k) => [k, t[k] ?? ''])));
        setImages(t.images || []);
      });
    } else {
      setForm({ ...EMPTY_TEST, session_id: sessionId || '' });
      studyAPI.nextTileCode().then((r) => setForm((f) => ({ ...f, tile_code: f.tile_code || r.code }))).catch(() => {});
    }
  }, [open, testId, sessionId]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const clays = materials.filter((m) => m.type === 'clay');
  const glazes = materials.filter((m) => m.type === 'glaze');

  const persist = async () => {
    const payload = { ...form };
    const saved = savedId ? await studyAPI.updateGlazeTest(savedId, payload) : await studyAPI.createGlazeTest(payload);
    setSavedId(saved.id);
    return saved;
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await persist();
      toast.success(`Provplatta ${saved.tile_code} är sparad`);
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error('Kunde inte spara provplattan', err.message);
    } finally {
      setSaving(false);
    }
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      // Fotot behöver en sparad provplatta; spara först om det behövs
      const saved = savedId ? { id: savedId } : await persist();
      await studyAPI.uploadGlazeImage(saved.id, file);
      const t = await studyAPI.getGlazeTest(saved.id);
      setImages(t.images || []);
      onSaved?.(t);
    } catch (err) {
      toast.error('Kunde inte spara fotot', err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (img) => {
    if (!(await confirm({ title: 'Ta bort fotot?', confirmLabel: 'Ta bort', destructive: true }))) return;
    try {
      await studyAPI.deleteGlazeImage(img.id);
      setImages((list) => list.filter((x) => x.id !== img.id));
    } catch (err) {
      toast.error('Kunde inte ta bort fotot', err.message);
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: `Ta bort ${form.tile_code}?`, description: 'Provplattan och dess foton raderas.', confirmLabel: 'Ta bort', destructive: true }))) return;
    try {
      await studyAPI.deleteGlazeTest(savedId);
      toast.success('Provplattan är borttagen');
      onSaved?.(null);
      onOpenChange(false);
    } catch (err) {
      toast.error('Kunde inte ta bort provplattan', err.message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={testId ? `Provplatta ${form.tile_code}` : 'Ny provplatta'}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => onOpenChange(false)} disabled={saving}>Avbryt</button>
            <button type="submit" form="glaze-test-form" className="btn btn-primary" disabled={saving || uploading}>{saving ? 'Sparar…' : 'Spara'}</button>
          </>
        }
      >
        <form id="glaze-test-form" className="study-form" onSubmit={submit}>
          <div className="logbook-row">
            <label className="field">
              <span className="field-sublabel">Kod</span>
              <input className="field-input field-input--lg" value={form.tile_code} onChange={set('tile_code')} maxLength={40} />
            </label>
            <label className="field">
              <span className="field-sublabel">Lera</span>
              <select className="field-input" value={form.clay_material_id} onChange={set('clay_material_id')}>
                <option value="">Ingen vald</option>
                {clays.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
          </div>
          <label className="field">
            <span className="field-sublabel">Glasyr</span>
            <select className="field-input" value={form.glaze_material_id} onChange={set('glaze_material_id')}>
              <option value="">Ingen från Material</option>
              {glazes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-sublabel">Eller eget recept</span>
            <select className="field-input" value={form.recipe_id} onChange={set('recipe_id')}>
              <option value="">Inget recept</option>
              {recipes.map((r) => <option key={r.id} value={r.id}>{r.name}{r.cone ? ` (kon ${r.cone})` : ''}</option>)}
            </select>
          </label>

          <div className="field">
            <span className="field-sublabel">Applicering</span>
            <div className="segmented segmented--wrap" role="radiogroup" aria-label="Applicering">
              {METHODS.map((m) => (
                <button key={m.id} type="button" role="radio" aria-checked={form.method === m.id}
                  className={`segmented-item ${form.method === m.id ? 'active' : ''}`} onClick={() => setForm((f) => ({ ...f, method: m.id }))}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="logbook-row">
            {form.method === 'dip' && (
              <label className="field">
                <span className="field-sublabel">Dopp (sekunder)</span>
                <input className="field-input" inputMode="decimal" value={form.dip_seconds} onChange={set('dip_seconds')} placeholder="3" />
              </label>
            )}
            <label className="field">
              <span className="field-sublabel">Antal lager</span>
              <input className="field-input" inputMode="numeric" value={form.coats} onChange={set('coats')} placeholder="1" />
            </label>
          </div>
          <label className="field">
            <span className="field-sublabel">Lager (A över B)</span>
            <input className="field-input" value={form.layering} onChange={set('layering')} placeholder="Tenmoku över Celadon" />
          </label>
          <label className="field">
            <span className="field-sublabel">Bränning</span>
            <input className="field-input" value={form.firing} onChange={set('firing')} placeholder="Kon 6, oxiderande" />
          </label>
          <label className="field">
            <span className="field-sublabel">Resultat</span>
            <textarea className="field-input" rows={3} value={form.result} onChange={set('result')} placeholder="Blank, bra på kanten, rinner i fållan." />
          </label>
          <label className="field">
            <span className="field-sublabel">Pass</span>
            <select className="field-input" value={form.session_id} onChange={set('session_id')}>
              <option value="">Inget pass</option>
              {sessions.map((s) => <option key={s.id} value={s.id}>{formatDay(s.date)} · {sessionTitle(s)}</option>)}
            </select>
          </label>

          <div className="logbook-photos">
            {images.map((img) => (
              <div key={img.id} className="logbook-photo">
                <img src={studyAPI.glazeImageUrl(img.id, true)} alt={`Foto av ${form.tile_code}`} />
                <button type="button" className="strip-delete logbook-photo-del" onClick={() => removeImage(img)} aria-label="Ta bort fotot"><X size={13} /></button>
              </div>
            ))}
            <button type="button" className="logbook-camera" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 size={22} className="animate-spin" /> : <Camera size={22} />}
              <span>{uploading ? 'Sparar…' : 'Ta foto'}</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={upload} hidden />
          </div>

          {savedId && (
            <button type="button" className="link-btn edit-danger" onClick={remove}><Trash2 size={14} /> Ta bort provplattan</button>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}

const EMPTY_RECIPE = { name: '', cone: '', notes: '', ingredients: [{ material: '', percent: '' }] };

/** Recept med ingredienser i procent och batchvikt. */
export function RecipeForm({ open, onOpenChange, recipe, onSaved }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState(EMPTY_RECIPE);
  const [batch, setBatch] = useState('500');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(recipe ? { name: recipe.name, cone: recipe.cone || '', notes: recipe.notes || '', ingredients: recipe.ingredients.length ? recipe.ingredients : EMPTY_RECIPE.ingredients } : EMPTY_RECIPE);
  }, [open, recipe]);

  const setRow = (i, k, v) => setForm((f) => ({ ...f, ingredients: f.ingredients.map((r, j) => (j === i ? { ...r, [k]: v } : r)) }));
  const pct = (v) => Number(String(v).replace(',', '.')) || 0;
  const sum = form.ingredients.reduce((s, r) => s + pct(r.percent), 0);
  const batchG = Number(batch) || 0;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = recipe ? await studyAPI.updateRecipe(recipe.id, form) : await studyAPI.createRecipe(form);
      toast.success(`Receptet ${saved.name} är sparat`);
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error('Kunde inte spara receptet', err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: `Ta bort ${recipe.name}?`, description: 'Provplattor som använder receptet finns kvar.', confirmLabel: 'Ta bort', destructive: true }))) return;
    try {
      await studyAPI.deleteRecipe(recipe.id);
      onSaved?.(null);
      onOpenChange(false);
    } catch (err) {
      toast.error('Kunde inte ta bort receptet', err.message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={recipe ? recipe.name : 'Nytt recept'}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => onOpenChange(false)} disabled={saving}>Avbryt</button>
            <button type="submit" form="recipe-form" className="btn btn-primary" disabled={saving}>{saving ? 'Sparar…' : 'Spara'}</button>
          </>
        }
      >
        <form id="recipe-form" className="study-form" onSubmit={submit}>
          <div className="logbook-row">
            <label className="field">
              <span className="field-sublabel">Namn</span>
              <input className="field-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Glasklart" />
            </label>
            <label className="field">
              <span className="field-sublabel">Kon</span>
              <input className="field-input" value={form.cone} onChange={(e) => setForm({ ...form, cone: e.target.value })} placeholder="6" />
            </label>
          </div>

          <div className="field">
            <div className="recipe-head">
              <span className="field-sublabel">Ingredienser</span>
              <label className="recipe-batch">
                Batch
                <input className="field-input" inputMode="numeric" value={batch} onChange={(e) => setBatch(e.target.value.replace(/\D/g, '').slice(0, 6))} aria-label="Batchvikt i gram" />
                g
              </label>
            </div>
            <div className="recipe-rows">
              {form.ingredients.map((r, i) => (
                <div key={i} className="recipe-row">
                  <input className="field-input" value={r.material} onChange={(e) => setRow(i, 'material', e.target.value)} placeholder="Fältspat" aria-label="Ingrediens" />
                  <input className="field-input recipe-pct" inputMode="decimal" value={r.percent} onChange={(e) => setRow(i, 'percent', e.target.value)} placeholder="%" aria-label="Procent" />
                  <span className="recipe-grams">{batchG && pct(r.percent) ? `${Math.round((batchG * pct(r.percent)) / Math.max(sum, 1) * 10) / 10} g` : ''}</span>
                  <button type="button" className="icon-btn icon-btn--ghost" aria-label="Ta bort raden" onClick={() => setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, j) => j !== i) }))}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="recipe-foot">
              <button type="button" className="link-btn edit-add" onClick={() => setForm((f) => ({ ...f, ingredients: [...f.ingredients, { material: '', percent: '' }] }))}>
                <Plus size={14} /> Lägg till ingrediens
              </button>
              <span className={`recipe-sum${Math.abs(sum - 100) < 0.01 ? ' is-ok' : ''}`}>Summa {Math.round(sum * 100) / 100} %</span>
            </div>
            <span className="field-hint">Gram räknas om så att summan blir batchvikten, även om procenten inte blir exakt 100.</span>
          </div>

          <label className="field">
            <span className="field-sublabel">Anteckningar</span>
            <textarea className="field-input" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Sikta 80 mesh. Godkänd av verkstaden." />
          </label>
          {recipe && <button type="button" className="link-btn edit-danger" onClick={remove}><Trash2 size={14} /> Ta bort receptet</button>}
        </form>
      </SheetContent>
    </Sheet>
  );
}
