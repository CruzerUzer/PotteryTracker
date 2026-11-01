import React from 'react';
import { BookOpen, FileText, MapPin, PlayCircle } from 'lucide-react';

const TYPES = {
  video: { icon: PlayCircle, label: 'Video' },
  read: { icon: FileText, label: 'Läsning' },
  book: { icon: BookOpen, label: 'Bok' },
  visit: { icon: MapPin, label: 'Besök' },
};

export const INSPIRATION_TYPES = Object.entries(TYPES).map(([id, t]) => ({ id, label: t.label }));

/** Veckans inspiration ur planen: video, läsning, bok eller besök. Länkar öppnas i ny flik. */
export default function Inspiration({ items, label = 'Inspiration', className = '' }) {
  if (!items?.length) return null;
  return (
    <div className={`inspiration ${className}`.trim()}>
      <span className="study-label">{label}</span>
      <ul className="inspiration-list">
        {items.map((it, i) => {
          const t = TYPES[it.type] || TYPES.read;
          const Icon = t.icon;
          return (
            <li key={i} className="inspiration-item">
              <Icon size={16} className="inspiration-icon" aria-label={t.label} />
              <div className="inspiration-text">
                {it.url ? (
                  <a href={it.url} target="_blank" rel="noreferrer" className="inspiration-link">{it.title}</a>
                ) : (
                  <span className="inspiration-title">{it.title}</span>
                )}
                {it.note && <span className="inspiration-note">{it.note}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
