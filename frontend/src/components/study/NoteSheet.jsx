import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Sheet, SheetContent } from '../ui/sheet';
import { useToast } from '../ui/toast';
import { useConfirm } from '../ui/confirm-dialog';
import { studyAPI } from '../../services/api';
import { shortBlockName } from './studyUtils';
import { NOTE_TYPES } from './Inspiration';

const VIDEO_HOSTS = /(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|instagram\.com)/i;

/** Gissar typen från länken så länge användaren inte valt själv. */
export function guessType(url) {
  if (!url?.trim()) return 'note';
  return VIDEO_HOSTS.test(url) ? 'video' : 'read';
}

const EMPTY = { week_number: null, type: 'note', title: '', url: '', note: '' };
const trunc = (s, n = 44) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * Ark för en egen anteckning eller länk inför ett pass.
 * `note` = befintlig anteckning (ändra/ta bort), annars ny på passet `week`.
 */
export default function NoteSheet({ open, onOpenChange, note, week, onSaved, onDeleted }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState(EMPTY);
  const [typeTouched, setTypeTouched] = useState(false);
  const [weeks, setWeeks] = useState(null); // { week, weeks } från servern
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(note ? { ...EMPTY, ...note, url: note.url || '', note: note.note || '' } : { ...EMPTY, week_number: week || null });
    setTypeTouched(!!note);
    if (!weeks) {
      studyAPI.listNotes().then(setWeeks).catch((err) => toast.error('Kunde inte hämta passen', err.message));
    }
  }, [open, note, week]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setUrl = (v) => setForm((f) => ({ ...f, url: v, type: typeTouched ? f.type : guessType(v) }));

  const current = weeks?.week || 1;
  const selectedWeek = form.week_number || current;
  const options = (weeks?.weeks || []).filter((w) => w.week >= current || w.week === selectedWeek);
  const canSave = form.title.trim() && !saving;

  const save = async (e) => {
    e?.preventDefault();
    if (!canSave) return;
    setSaving(true);
    const body = { ...form, week_number: selectedWeek };
    try {
      const saved = note ? await studyAPI.updateNote(note.id, body) : await studyAPI.createNote(body);
      toast.success(note ? 'Anteckningen är ändrad' : `Sparat inför pass ${saved.week_number}`);
      onOpenChange(false);
      onSaved?.(saved);
    } catch (err) {
      toast.error('Kunde inte spara anteckningen', err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({ title: 'Ta bort anteckningen?', description: form.title, confirmLabel: 'Ta bort', destructive: true });
    if (!ok) return;
    try {
      await studyAPI.deleteNote(note.id);
      toast.success('Anteckningen är borttagen');
      onOpenChange(false);
      onDeleted?.(note.id);
    } catch (err) {
      toast.error('Kunde inte ta bort', err.message);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={note ? 'Ändra anteckningen' : 'Egen anteckning'}
        description="Något du vill tänka på eller titta på inför passet. Syns på Idag, i passets förberedelse och i Planen."
        footer={
          <>
            {note && (
              <button type="button" className="btn btn-secondary note-delete" onClick={remove} aria-label="Ta bort anteckningen">
                <Trash2 size={15} />
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => onOpenChange(false)}>Avbryt</button>
            <button type="submit" form="note-form" className="btn btn-primary" disabled={!canSave}>
              {saving ? 'Sparar…' : 'Spara'}
            </button>
          </>
        }
      >
        <form id="note-form" className="study-form" onSubmit={save}>
          <label className="field">
            <span className="field-sublabel">Vad vill du komma ihåg?</span>
            <input
              className="field-input field-input--lg"
              value={form.title}
              maxLength={200}
              placeholder="T.ex. Armbågen mot knät när jag centrerar"
              autoFocus
              onChange={(e) => set('title', e.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-sublabel">Länk (valfritt)</span>
            <input
              className="field-input"
              type="text"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={form.url}
              placeholder="https://… video, artikel eller sida"
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <div className="note-row">
            <label className="field">
              <span className="field-sublabel">Typ</span>
              <select className="field-input" value={form.type} onChange={(e) => { setTypeTouched(true); set('type', e.target.value); }}>
                {NOTE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </label>
            <label className="field note-week">
              <span className="field-sublabel">Pass</span>
              <select className="field-input" value={selectedWeek} onChange={(e) => set('week_number', Number(e.target.value))} disabled={!weeks}>
                {!weeks && <option value={selectedWeek}>Pass {selectedWeek}</option>}
                {options.map((w) => (
                  <option key={w.week} value={w.week}>
                    Pass {w.week}{w.week === current ? ' (nästa)' : ''}{w.main ? ` · ${trunc(w.main)}` : ` · ${shortBlockName(w.blockName)}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span className="field-sublabel">Notering (valfritt)</span>
            <textarea
              className="field-input note-textarea"
              value={form.note}
              maxLength={2000}
              rows={3}
              placeholder="Vad ska du titta efter, eller varför?"
              onChange={(e) => set('note', e.target.value)}
            />
          </label>
        </form>
      </SheetContent>
    </Sheet>
  );
}
