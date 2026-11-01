import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Disc3, Plus, Trash2 } from 'lucide-react';
import { Sheet, SheetContent } from '../ui/sheet';
import { useToast } from '../ui/toast';
import { useConfirm } from '../ui/confirm-dialog';
import { studyAPI } from '../../services/api';
import { shortBlockName } from './studyUtils';

const clone = (x) => JSON.parse(JSON.stringify(x));
const num = (v) => (v === '' || v === null || v === undefined ? '' : Number(v));

/** Gemensam spara-logik: hela planen skickas, servern validerar mot schemat. */
function useSavePlan(onSaved) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState([]);
  const save = async (plan, summary) => {
    setSaving(true);
    setErrors([]);
    try {
      await studyAPI.savePlan(plan, summary);
      toast.success('Planen är sparad', summary);
      onSaved?.();
      return true;
    } catch (err) {
      setErrors(err.errors?.length ? err.errors : [err.message]);
      return false;
    } finally {
      setSaving(false);
    }
  };
  return { save, saving, errors, setErrors };
}

function Errors({ errors }) {
  const ref = useRef(null);
  useEffect(() => {
    if (errors.length) ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [errors]);
  if (!errors.length) return null;
  return (
    <div className="error" role="alert" ref={ref}>
      <strong>Planen sparades inte.</strong>
      <ul className="edit-errors">{errors.slice(0, 6).map((e) => <li key={e}>{e}</li>)}</ul>
    </div>
  );
}

function Footer({ onCancel, saving, label = 'Spara', form }) {
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>Avbryt</button>
      <button type="submit" form={form} className="btn btn-primary" disabled={saving}>{saving ? 'Sparar…' : label}</button>
    </>
  );
}

function TextList({ items, onChange, placeholder, addLabel }) {
  return (
    <div className="edit-list">
      {items.map((t, i) => (
        <div key={i} className="edit-list-row">
          <textarea className="field-input" rows={2} value={t} placeholder={placeholder}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" className="icon-btn icon-btn--ghost" aria-label="Ta bort" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button type="button" className="link-btn edit-add" onClick={() => onChange([...items, ''])}><Plus size={14} /> {addLabel}</button>
    </div>
  );
}

// ─── Block ──────────────────────────────────────────────────────────

export function BlockEditor({ open, onOpenChange, plan, blockId, onSaved }) {
  const [draft, setDraft] = useState(null);
  const { save, saving, errors, setErrors } = useSavePlan(() => {
    onOpenChange(false);
    onSaved?.();
  });

  useEffect(() => {
    if (open && plan && blockId) {
      setDraft(clone(plan.phases.find((b) => b.id === blockId)));
      setErrors([]);
    }
  }, [open, plan, blockId, setErrors]);

  if (!draft) return null;
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const setWeek = (i, k, v) => setDraft((d) => ({ ...d, weeks: d.weeks.map((w, j) => (j === i ? { ...w, [k]: v } : w)) }));
  const cards = plan.challengeCards || [];
  const playCards = draft.playCards || [];

  const submit = async (e) => {
    e.preventDefault();
    const next = clone(plan);
    const clean = {
      ...draft,
      weekFrom: num(draft.weekFrom),
      weekTo: num(draft.weekTo),
      themeCreative: draft.themeCreative?.trim() ? draft.themeCreative : null,
      weeks: draft.weeks.map((w) => ({ ...w, weekFrom: num(w.weekFrom), weekTo: num(w.weekTo), finish: w.finish || '' })),
      gate: (draft.gate || []).map((g) => g.trim()).filter(Boolean),
    };
    if (!clean.safety) delete clean.safety;
    next.phases = next.phases.map((b) => (b.id === blockId ? clean : b));
    await save(next, `${shortBlockName(clean.name)} ändrat`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={`Redigera ${shortBlockName(draft.name)}`} footer={<Footer form="block-edit" saving={saving} onCancel={() => onOpenChange(false)} />}>
        <form id="block-edit" className="study-form" onSubmit={submit}>
          <Errors errors={errors} />
          <label className="field">
            <span className="field-sublabel">Namn</span>
            <input className="field-input" value={draft.name} onChange={(e) => set('name', e.target.value)} />
          </label>
          <div className="logbook-row">
            <label className="field">
              <span className="field-sublabel">Från vecka</span>
              <input className="field-input" inputMode="numeric" value={draft.weekFrom} onChange={(e) => set('weekFrom', e.target.value.replace(/\D/g, ''))} />
            </label>
            <label className="field">
              <span className="field-sublabel">Till vecka</span>
              <input className="field-input" inputMode="numeric" value={draft.weekTo} onChange={(e) => set('weekTo', e.target.value.replace(/\D/g, ''))} />
            </label>
          </div>
          <label className="field">
            <span className="field-sublabel">Tekniskt tema</span>
            <textarea className="field-input" rows={2} value={draft.themeTechnical || ''} onChange={(e) => set('themeTechnical', e.target.value)} />
          </label>
          <label className="field">
            <span className="field-sublabel">Kreativt tema</span>
            <textarea className="field-input" rows={2} value={draft.themeCreative || ''} onChange={(e) => set('themeCreative', e.target.value)} />
          </label>

          <h3 className="edit-h3">Veckor</h3>
          {draft.weeks.map((w, i) => (
            <div key={i} className="edit-week">
              <div className="edit-week-head">
                <span className="field-sublabel">Vecka</span>
                <input className="field-input edit-num" inputMode="numeric" value={w.weekFrom} aria-label="Från vecka" onChange={(e) => setWeek(i, 'weekFrom', e.target.value.replace(/\D/g, ''))} />
                <span>–</span>
                <input className="field-input edit-num" inputMode="numeric" value={w.weekTo} aria-label="Till vecka" onChange={(e) => setWeek(i, 'weekTo', e.target.value.replace(/\D/g, ''))} />
                <button type="button" className="icon-btn icon-btn--ghost" aria-label="Ta bort veckan" onClick={() => set('weeks', draft.weeks.filter((_, j) => j !== i))} disabled={draft.weeks.length <= 1}>
                  <Trash2 size={15} />
                </button>
              </div>
              <textarea className="field-input" rows={2} value={w.main} placeholder="Drejning" aria-label="Drejning" onChange={(e) => setWeek(i, 'main', e.target.value)} />
              <textarea className="field-input" rows={2} value={w.finish || ''} placeholder="Beskickning och yta" aria-label="Beskickning och yta" onChange={(e) => setWeek(i, 'finish', e.target.value)} />
            </div>
          ))}
          <button type="button" className="link-btn edit-add" onClick={() => {
            const last = draft.weeks[draft.weeks.length - 1];
            const from = Math.min(Number(draft.weekTo) || 52, (Number(last?.weekTo) || Number(draft.weekFrom) - 1) + 1);
            set('weeks', [...draft.weeks, { weekFrom: from, weekTo: from, main: '', finish: '' }]);
          }}>
            <Plus size={14} /> Lägg till vecka
          </button>

          <h3 className="edit-h3">Milstolpe</h3>
          <TextList items={draft.gate || []} onChange={(v) => set('gate', v)} placeholder="Vad ska du klara?" addLabel="Lägg till punkt" />

          <h3 className="edit-h3">Lek</h3>
          <div className="chip-row">
            {cards.map((c) => {
              const on = playCards.includes(c.id);
              return (
                <button key={c.id} type="button" className={`chip${on ? ' chip--active' : ''}`} aria-pressed={on}
                  onClick={() => set('playCards', on ? playCards.filter((x) => x !== c.id) : [...playCards, c.id])}>
                  {c.name}
                </button>
              );
            })}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Passmallen ─────────────────────────────────────────────────────

export function TemplateEditor({ open, onOpenChange, plan, onSaved }) {
  const [draft, setDraft] = useState(null);
  const { save, saving, errors, setErrors } = useSavePlan(() => {
    onOpenChange(false);
    onSaved?.();
  });

  useEffect(() => {
    if (open && plan) {
      const t = clone(plan.sessionTemplate);
      t.segments = t.segments.map((s) => ({ ...s, minutes: s.toMinute - s.fromMinute }));
      setDraft(t);
      setErrors([]);
    }
  }, [open, plan, setErrors]);

  if (!draft) return null;
  const setSeg = (i, k, v) => setDraft((d) => ({ ...d, segments: d.segments.map((s, j) => (j === i ? { ...s, [k]: v } : s)) }));
  const move = (i, dir) => setDraft((d) => {
    const segs = [...d.segments];
    const j = i + dir;
    if (j < 0 || j >= segs.length) return d;
    [segs[i], segs[j]] = [segs[j], segs[i]];
    return { ...d, segments: segs };
  });
  const total = draft.segments.reduce((sum, s) => sum + (Number(s.minutes) || 0), 0);

  const submit = async (e) => {
    e.preventDefault();
    let acc = 0;
    const segments = draft.segments.map((s, i) => {
      const from = acc;
      acc += Number(s.minutes) || 0;
      const id = s.id || `segment-${i + 1}`;
      return { id, fromMinute: from, toMinute: acc, name: s.name, wheel: !!s.wheel, description: s.description || '' };
    });
    const next = clone(plan);
    next.sessionTemplate = {
      ...draft,
      totalMinutes: acc,
      segments,
      wheelBooking: draft.wheelBooking
        ? { fromMinute: num(draft.wheelBooking.fromMinute), toMinute: num(draft.wheelBooking.toMinute) }
        : undefined,
    };
    if (!next.sessionTemplate.wheelBooking) delete next.sessionTemplate.wheelBooking;
    await save(next, 'Passmallen ändrad');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Redigera passmallen" description={`Totalt ${total} minuter. Pågående och gjorda pass ändras inte.`}
        footer={<Footer form="template-edit" saving={saving} onCancel={() => onOpenChange(false)} />}>
        <form id="template-edit" className="study-form" onSubmit={submit}>
          <Errors errors={errors} />
          {draft.segments.map((s, i) => (
            <div key={s.id || i} className="edit-week">
              <div className="edit-week-head">
                <input className="field-input" value={s.name} aria-label="Momentets namn" onChange={(e) => setSeg(i, 'name', e.target.value)} />
                <input className="field-input edit-num" inputMode="numeric" value={s.minutes} aria-label="Minuter"
                  onChange={(e) => setSeg(i, 'minutes', e.target.value.replace(/\D/g, ''))} />
                <span className="field-hint">min</span>
              </div>
              <textarea className="field-input" rows={2} value={s.description || ''} placeholder="Vad som ska göras" aria-label="Beskrivning"
                onChange={(e) => setSeg(i, 'description', e.target.value)} />
              <div className="edit-seg-tools">
                <label className="study-check">
                  <input type="checkbox" checked={!!s.wheel} onChange={(e) => setSeg(i, 'wheel', e.target.checked)} />
                  <Disc3 size={14} aria-hidden="true" /> På drejskivan
                </label>
                <span className="edit-seg-move">
                  <button type="button" className="icon-btn icon-btn--ghost" aria-label="Flytta upp" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={15} /></button>
                  <button type="button" className="icon-btn icon-btn--ghost" aria-label="Flytta ned" onClick={() => move(i, 1)} disabled={i === draft.segments.length - 1}><ArrowDown size={15} /></button>
                  <button type="button" className="icon-btn icon-btn--ghost" aria-label="Ta bort momentet" disabled={draft.segments.length <= 1}
                    onClick={() => setDraft((d) => ({ ...d, segments: d.segments.filter((_, j) => j !== i) }))}><Trash2 size={15} /></button>
                </span>
              </div>
            </div>
          ))}
          <button type="button" className="link-btn edit-add" onClick={() => setDraft((d) => ({
            ...d,
            segments: [...d.segments, { id: `segment-${Date.now().toString(36)}`, name: 'Nytt moment', minutes: 10, wheel: false, description: '' }],
          }))}>
            <Plus size={14} /> Lägg till segment
          </button>

          <h3 className="edit-h3">Skivbokning</h3>
          <div className="logbook-row">
            <label className="field">
              <span className="field-sublabel">Från minut</span>
              <input className="field-input" inputMode="numeric" value={draft.wheelBooking?.fromMinute ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, wheelBooking: { ...(d.wheelBooking || { toMinute: 0 }), fromMinute: e.target.value.replace(/\D/g, '') } }))} />
            </label>
            <label className="field">
              <span className="field-sublabel">Till minut</span>
              <input className="field-input" inputMode="numeric" value={draft.wheelBooking?.toMinute ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, wheelBooking: { ...(d.wheelBooking || { fromMinute: 0 }), toMinute: e.target.value.replace(/\D/g, '') } }))} />
            </label>
          </div>
          <label className="field">
            <span className="field-sublabel">Om tiden är knapp</span>
            <textarea className="field-input" rows={2} value={draft.whenShort || ''} onChange={(e) => setDraft((d) => ({ ...d, whenShort: e.target.value }))} />
          </label>
          <label className="field">
            <span className="field-sublabel">Mellan passen</span>
            <textarea className="field-input" rows={2} value={draft.betweenSessions || ''} onChange={(e) => setDraft((d) => ({ ...d, betweenSessions: e.target.value }))} />
          </label>
        </form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Utmaningskort ──────────────────────────────────────────────────

const slug = (t) => String(t || '').toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'kort';

export function CardEditor({ open, onOpenChange, plan, cardId, onSaved }) {
  const confirm = useConfirm();
  const [draft, setDraft] = useState(null);
  const { save, saving, errors, setErrors } = useSavePlan(() => {
    onOpenChange(false);
    onSaved?.();
  });
  const isNew = !cardId;

  useEffect(() => {
    if (!open || !plan) return;
    setErrors([]);
    setDraft(isNew ? { id: '', name: '', how: '', trains: '' } : clone(plan.challengeCards.find((c) => c.id === cardId)));
  }, [open, plan, cardId, isNew, setErrors]);

  if (!draft) return null;
  const submit = async (e) => {
    e.preventDefault();
    const next = clone(plan);
    const card = { id: draft.id, name: draft.name.trim(), how: draft.how.trim() };
    if (draft.trains?.trim()) card.trains = draft.trains.trim();
    if (isNew) {
      const ids = new Set(next.challengeCards.map((c) => c.id));
      let id = slug(card.name);
      for (let i = 2; ids.has(id); i++) id = `${slug(card.name)}-${i}`;
      card.id = id;
      next.challengeCards.push(card);
    } else {
      next.challengeCards = next.challengeCards.map((c) => (c.id === cardId ? card : c));
    }
    await save(next, isNew ? `Nytt utmaningskort: ${card.name}` : `Kortet ${card.name} ändrat`);
  };
  const remove = async () => {
    const ok = await confirm({ title: `Ta bort ${draft.name}?`, description: 'Kortet tas ur leken och ur alla block. Det går att återställa under Versioner.', confirmLabel: 'Ta bort', destructive: true });
    if (!ok) return;
    const next = clone(plan);
    next.challengeCards = next.challengeCards.filter((c) => c.id !== cardId);
    next.phases = next.phases.map((b) => ({ ...b, playCards: (b.playCards || []).filter((x) => x !== cardId) }));
    await save(next, `Kortet ${draft.name} borttaget`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title={isNew ? 'Nytt utmaningskort' : `Redigera ${draft.name}`} footer={<Footer form="card-edit" saving={saving} onCancel={() => onOpenChange(false)} />}>
        <form id="card-edit" className="study-form" onSubmit={submit}>
          <Errors errors={errors} />
          <label className="field">
            <span className="field-sublabel">Namn</span>
            <input className="field-input field-input--lg" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={60} />
          </label>
          <label className="field">
            <span className="field-sublabel">Hur kortet spelas</span>
            <textarea className="field-input" rows={3} value={draft.how} onChange={(e) => setDraft({ ...draft, how: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-sublabel">Tränar</span>
            <input className="field-input" value={draft.trains || ''} onChange={(e) => setDraft({ ...draft, trains: e.target.value })} />
          </label>
          {!isNew && (
            <button type="button" className="link-btn edit-danger" onClick={remove} disabled={saving}>
              <Trash2 size={14} /> Ta bort kortet
            </button>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}
