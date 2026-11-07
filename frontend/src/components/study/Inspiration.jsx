import React from 'react';
import { BookOpen, FileText, MapPin, Pencil, PlayCircle, Plus, StickyNote } from 'lucide-react';

const TYPES = {
  video: { icon: PlayCircle, label: 'Video' },
  read: { icon: FileText, label: 'Läsning' },
  book: { icon: BookOpen, label: 'Bok' },
  visit: { icon: MapPin, label: 'Besök' },
  note: { icon: StickyNote, label: 'Anteckning' },
};

/** Typerna planfilen tillåter (blockredigeraren). */
export const INSPIRATION_TYPES = ['video', 'read', 'book', 'visit'].map((id) => ({ id, label: TYPES[id].label }));
/** Typerna för egna anteckningar: anteckning först, sedan samma som planen. */
export const NOTE_TYPES = ['note', 'video', 'read', 'book', 'visit'].map((id) => ({ id, label: TYPES[id].label }));

function Item({ item, onEdit }) {
  const t = TYPES[item.type] || TYPES.read;
  const Icon = t.icon;
  return (
    <li className="inspiration-item">
      <Icon size={16} className="inspiration-icon" aria-label={t.label} />
      <div className="inspiration-text">
        {item.url ? (
          <a href={item.url} target="_blank" rel="noreferrer" className="inspiration-link">{item.title}</a>
        ) : (
          <span className="inspiration-title">{item.title}</span>
        )}
        {item.note && <span className="inspiration-note">{item.note}</span>}
      </div>
      {onEdit && (
        <button type="button" className="icon-btn icon-btn--ghost inspiration-edit" aria-label={`Ändra anteckningen ${item.title}`} onClick={() => onEdit(item)}>
          <Pencil size={14} />
        </button>
      )}
    </li>
  );
}

/**
 * Veckans inspiration ur planen (video, läsning, bok, besök) och användarens
 * egna anteckningar inför passet. Länkar öppnas i ny flik.
 * `onAdd` visar knappen för att lägga till en egen anteckning, `onEditNote` pennan på varje egen rad.
 */
export default function Inspiration({ items, notes, onAdd, onEditNote, label = 'Inspiration', notesLabel = 'Dina anteckningar', className = '' }) {
  const planItems = items || [];
  const own = notes || [];
  if (!planItems.length && !own.length && !onAdd) return null;
  return (
    <div className={`inspiration ${className}`.trim()}>
      {planItems.length > 0 && (
        <>
          <span className="study-label">{label}</span>
          <ul className="inspiration-list">
            {planItems.map((it, i) => <Item key={i} item={it} />)}
          </ul>
        </>
      )}
      {(own.length > 0 || onAdd) && (
        <div className={`inspiration-own${planItems.length ? ' has-plan' : ''}`}>
          {own.length > 0 && (
            <>
              <span className="study-label">{notesLabel}</span>
              <ul className="inspiration-list">
                {own.map((n) => <Item key={n.id} item={n} onEdit={onEditNote} />)}
              </ul>
            </>
          )}
          {onAdd && (
            <button type="button" className="link-btn inspiration-add" onClick={onAdd}>
              <Plus size={14} /> {own.length ? 'Lägg till en anteckning' : 'Lägg till en egen anteckning eller länk'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
