import React, { useEffect, useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Sheet, SheetContent } from '../ui/sheet';
import { useToast } from '../ui/toast';
import { piecesAPI, imagesAPI, studyAPI } from '../../services/api';
import { ACTIONS } from './studyUtils';

function Thumb({ piece }) {
  return piece.display_image_id ? (
    <img src={imagesAPI.getFileUrl(piece.display_image_id, true)} alt="" loading="lazy" />
  ) : (
    <span className="pick-thumb-initial">{piece.name?.[0] || '?'}</span>
  );
}

/**
 * Koppla befintliga alster till passet. Välj åtgärd först, tryck sedan på
 * alstren. Gods på hyllan föreslås överst.
 */
function PiecePicker({ open, onOpenChange, sessionId, initialAction = 'trimmed', shelf, linked = [], onLinked }) {
  const toast = useToast();
  const [action, setAction] = useState(initialAction);
  const [pieces, setPieces] = useState([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (!open) return;
    setAction(initialAction);
    setQuery('');
    piecesAPI.getAll({ done: 'false' }).then(setPieces).catch(() => setPieces([]));
  }, [open, initialAction]);

  const linkedKeys = useMemo(() => new Set(linked.map((p) => `${p.id}:${p.action}`)), [linked]);

  const suggested = useMemo(() => {
    if (!shelf) return [];
    if (action === 'trimmed' || action === 'handled') return shelf.toTrim || [];
    if (action === 'glazed') return shelf.toGlaze || [];
    return [];
  }, [shelf, action]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const notDone = pieces.filter((p) => !p.done);
    const list = q ? notDone.filter((p) => p.name.toLowerCase().includes(q)) : notDone;
    const sugIds = new Set(suggested.map((p) => p.id));
    return list.filter((p) => q || !sugIds.has(p.id));
  }, [pieces, query, suggested]);

  const link = async (piece) => {
    if (linkedKeys.has(`${piece.id}:${action}`)) return;
    setBusy(piece.id);
    try {
      const result = await studyAPI.linkPiece(sessionId, piece.id, action);
      onLinked?.(result, piece);
    } catch (err) {
      toast.error('Kunde inte koppla alstret', err.message);
    } finally {
      setBusy(null);
    }
  };

  const row = (p) => {
    const done = linkedKeys.has(`${p.id}:${action}`);
    return (
      <li key={p.id}>
        <button type="button" className={`pick-row${done ? ' pick-row--done' : ''}`} onClick={() => link(p)} disabled={busy === p.id || done}>
          <span className="pick-thumb"><Thumb piece={p} /></span>
          <span className="pick-text">
            <span className="pick-name">{p.name}</span>
            <span className="pick-meta">{p.phase_name || 'Ingen fas'}{p.thrown_date ? ` · drejad ${p.thrown_date}` : ''}</span>
          </span>
          <span className="pick-check" aria-hidden="true">{done ? <Check size={18} /> : null}</span>
        </button>
      </li>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent title="Koppla alster" description="Välj vad du gjorde, tryck sedan på alstren.">
        <div className="segmented segmented--wrap" role="radiogroup" aria-label="Åtgärd">
          {ACTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={action === a.id}
              className={`segmented-item ${action === a.id ? 'active' : ''}`}
              onClick={() => setAction(a.id)}
            >
              {a.label}
            </button>
          ))}
        </div>

        <label className="search-field mt-3">
          <Search size={16} aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Sök bland dina alster" aria-label="Sök alster" />
        </label>

        {!query && suggested.length > 0 && (
          <>
            <h3 className="pick-heading">{action === 'glazed' ? 'Skröjbränt, att glasera' : 'Drejat, att beskicka'}</h3>
            <ul className="pick-list">{suggested.map(row)}</ul>
          </>
        )}
        <h3 className="pick-heading">{query ? 'Sökresultat' : 'Alla pågående alster'}</h3>
        {filtered.length ? (
          <ul className="pick-list">{filtered.map(row)}</ul>
        ) : (
          <p className="study-muted">Inga alster hittades.</p>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default PiecePicker;
