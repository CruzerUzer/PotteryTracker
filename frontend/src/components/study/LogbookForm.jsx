import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronDown, Loader2, Save, X } from 'lucide-react';
import { materialsAPI, studyAPI } from '../../services/api';
import { useToast } from '../ui/toast';
import { useConfirm } from '../ui/confirm-dialog';
import { logDraftKey, readLocal, writeLocal } from './studyUtils';

const DEFAULT_FIELDS = [
  { id: 'goalAndMeasure', label: 'Delmål och mått', prompt: 'Vad du skulle göra och vad det blev, i siffror.' },
  { id: 'observation', label: 'En observation', prompt: 'Det du märkte medan du gjorde, inte en betygsättning.' },
  { id: 'change', label: 'En förändring', prompt: 'Det enda du gör annorlunda nästa gång.' },
];
const FIELD_KEY = { goalAndMeasure: 'goal_and_measure', observation: 'observation', change: 'change' };
const differs = (a, b) => Object.keys(a).some((k) => String(a[k] ?? '') !== String(b[k] ?? ''));

/**
 * Loggboken: tre fasta rader, foto och några förifyllda extrafält.
 * Byggd för att gå på under en minut med en tumme.
 * Osparad text ligger kvar som utkast i webbläsaren tills den sparas,
 * så att den inte försvinner om man råkar lämna sidan.
 */
function LogbookForm({ session, onSaved, onChange, submitLabel = 'Spara loggboken', onSubmitExtra }) {
  const toast = useToast();
  const confirm = useConfirm();
  const fields = session.logbook_fields?.length ? session.logbook_fields : DEFAULT_FIELDS;
  const firstSeries = session.series?.[0];
  const initial = useMemo(() => {
    const l = session.log || {};
    return {
      goal_and_measure: l.goal_and_measure || '',
      observation: l.observation || '',
      change: l.change || '',
      clay_material_id: l.clay_material_id || firstSeries?.clay_material_id || '',
      weight_grams: l.weight_grams || firstSeries?.weight_grams || '',
      series_number: l.series_number || (session.series || []).map((s) => `S${s.number}`).join(', '),
      into_damp_box: l.into_damp_box || '',
    };
  }, [session.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [draft] = useState(() => readLocal(logDraftKey(session.id)));
  const [values, setValues] = useState(() => (draft?.values ? { ...initial, ...draft.values } : initial));
  const [restored, setRestored] = useState(() => !!draft?.values && differs({ ...initial, ...draft.values }, initial));
  const [clays, setClays] = useState([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [photoPiece, setPhotoPiece] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    writeLocal(logDraftKey(session.id), differs(values, initial) ? { values, at: Date.now() } : null);
  }, [values, initial, session.id]);

  useEffect(() => {
    materialsAPI.getAll().then((m) => setClays(m.filter((x) => x.type === 'clay'))).catch(() => {});
  }, []);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const uniquePieces = [...new Map(session.pieces.map((p) => [p.id, p])).values()];

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      await studyAPI.uploadSessionImage(session.id, file, photoPiece || null);
      onChange?.(await studyAPI.getSession(session.id));
      toast.success(photoPiece ? 'Fotot är sparat, även i alstrets galleri' : 'Fotot är sparat');
    } catch (err) {
      toast.error('Kunde inte spara fotot', err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async (img) => {
    const ok = await confirm({
      title: 'Ta bort fotot?',
      description: img.piece_image_id ? 'Kopian i alstrets galleri finns kvar.' : 'Fotot raderas permanent.',
      confirmLabel: 'Ta bort',
      destructive: true,
    });
    if (!ok) return;
    try {
      await studyAPI.deleteSessionImage(img.id);
      onChange?.(await studyAPI.getSession(session.id));
    } catch (err) {
      toast.error('Kunde inte ta bort fotot', err.message);
    }
  };

  const save = async (e) => {
    e?.preventDefault();
    setSaving(true);
    try {
      const res = await studyAPI.saveLog(session.id, {
        ...values,
        clay_material_id: values.clay_material_id ? Number(values.clay_material_id) : null,
        weight_grams: values.weight_grams ? Number(values.weight_grams) : null,
      });
      writeLocal(logDraftKey(session.id), null);
      if (onSubmitExtra) await onSubmitExtra();
      onSaved?.(res.log);
    } catch (err) {
      toast.error('Kunde inte spara loggboken', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="logbook" onSubmit={save}>
      {restored && (
        <p className="logbook-draft" role="status">
          <span>Din osparade text är återställd.</span>
          <button type="button" className="link-btn" onClick={() => { setValues(initial); setRestored(false); }}>
            Släng den
          </button>
        </p>
      )}
      {fields.map((f, i) => {
        const key = FIELD_KEY[f.id] || f.id;
        return (
          <label key={f.id} className="field logbook-line">
            <span className="logbook-label">
              <span className="logbook-num">{i + 1}</span> {f.label}
            </span>
            {f.prompt && <span className="logbook-prompt">{f.prompt}</span>}
            <textarea
              className="field-input"
              rows={2}
              value={values[key] || ''}
              onChange={set(key)}
              placeholder={f.example || ''}
            />
          </label>
        );
      })}

      <div className="logbook-photos">
        {session.images?.map((img) => (
          <div key={img.id} className="logbook-photo">
            <img src={studyAPI.sessionImageUrl(img.id, true)} alt={img.piece_name ? `Foto av ${img.piece_name}` : 'Foto från passet'} />
            {img.piece_name && <span className="logbook-photo-tag">{img.piece_name}</span>}
            <button type="button" className="strip-delete logbook-photo-del" onClick={() => removeImage(img)} aria-label="Ta bort fotot">
              <X size={13} />
            </button>
          </div>
        ))}
        <button type="button" className="logbook-camera" onClick={() => fileRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 size={22} className="animate-spin" /> : <Camera size={22} />}
          <span>{uploading ? 'Sparar…' : 'Ta foto'}</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={upload} hidden />
      </div>
      {uniquePieces.length > 0 && (
        <label className="field logbook-photo-piece">
          <span className="field-sublabel">Fotot gäller</span>
          <select className="field-input" value={photoPiece} onChange={(e) => setPhotoPiece(e.target.value)}>
            <option value="">Passet (inget alster)</option>
            {uniquePieces.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      )}

      <button type="button" className="logbook-more" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}>
        Lera, vikt, serie och fuktlåda
        <ChevronDown size={16} className={`shelf-chevron${moreOpen ? ' is-open' : ''}`} />
      </button>
      {moreOpen && (
        <div className="logbook-extra">
          <label className="field">
            <span className="field-sublabel">Lera</span>
            <select className="field-input" value={values.clay_material_id} onChange={set('clay_material_id')}>
              <option value="">Ingen vald</option>
              {clays.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div className="logbook-row">
            <label className="field">
              <span className="field-sublabel">Vikt (g)</span>
              <input className="field-input" inputMode="numeric" value={values.weight_grams}
                onChange={(e) => setValues((v) => ({ ...v, weight_grams: e.target.value.replace(/\D/g, '').slice(0, 5) }))} />
            </label>
            <label className="field">
              <span className="field-sublabel">Serie</span>
              <input className="field-input" value={values.series_number} onChange={set('series_number')} placeholder="S12" />
            </label>
          </div>
          <label className="field">
            <span className="field-sublabel">I fuktlådan</span>
            <input className="field-input" value={values.into_damp_box} onChange={set('into_damp_box')} placeholder="6 cylindrar, 2 skålar" />
          </label>
        </div>
      )}

      <button type="submit" className="btn btn-primary study-start-btn" disabled={saving || uploading}>
        <Save size={19} /> {saving ? 'Sparar…' : submitLabel}
      </button>
    </form>
  );
}

export default LogbookForm;
