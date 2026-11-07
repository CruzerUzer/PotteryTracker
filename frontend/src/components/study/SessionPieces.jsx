import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Layers, Link2, Plus, X } from 'lucide-react';
import { imagesAPI, piecesAPI, studyAPI } from '../../services/api';
import { useToast } from '../ui/toast';
import { ACTIONS } from './studyUtils';

/**
 * Alstren i passet, grupperade per åtgärd. Fasförslag visas som knapp;
 * alstret flyttas bara när användaren trycker.
 */
function SessionPieces({ session, onChange, onAddSeries, onLinkExisting }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const groups = ACTIONS.map((a) => ({ ...a, pieces: session.pieces.filter((p) => p.action === a.id) })).filter((g) => g.pieces.length);

  const move = async (piece) => {
    setBusy(piece.session_piece_id);
    try {
      await piecesAPI.updatePhase(piece.id, piece.suggestion.phase_id);
      toast.success(`Flyttat till ${piece.suggestion.phase_name}`, piece.name);
      onChange(await studyAPI.getSession(session.id));
    } catch (err) {
      toast.error('Kunde inte flytta alstret', err.message);
    } finally {
      setBusy(null);
    }
  };

  const moveAll = async (pieces) => {
    setBusy('all');
    try {
      for (const p of pieces) await piecesAPI.updatePhase(p.id, p.suggestion.phase_id);
      toast.success(`${pieces.length} alster flyttade till ${pieces[0].suggestion.phase_name}`);
      onChange(await studyAPI.getSession(session.id));
    } catch (err) {
      toast.error('Kunde inte flytta alstren', err.message);
      onChange(await studyAPI.getSession(session.id));
    } finally {
      setBusy(null);
    }
  };

  const unlink = async (piece) => {
    setBusy(piece.session_piece_id);
    try {
      onChange(await studyAPI.unlinkPiece(session.id, piece.session_piece_id));
    } catch (err) {
      toast.error('Kunde inte ta bort kopplingen', err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="study-section">
      <div className="study-section-head">
        <h2 className="study-h2">Alster i passet</h2>
        {session.series.length > 0 && (
          <span className="series-marks">
            {session.series.map((s) => (
              <span key={s.id} className="series-mark" title={`${s.name}, ${s.count} st`}>Märk: S{s.number}</span>
            ))}
          </span>
        )}
      </div>

      {groups.length === 0 && <p className="study-muted">Inga alster kopplade ännu.</p>}

      {groups.map((g) => {
        const suggestible = g.pieces.filter((p) => p.suggestion);
        const sameTarget = suggestible.length > 1 && suggestible.every((p) => p.suggestion.phase_id === suggestible[0].suggestion.phase_id);
        return (
          <div key={g.id} className="sp-group">
            <h3 className="sp-group-title">{g.label} <span className="sp-count">{g.pieces.length}</span></h3>
            {sameTarget && (
              <button type="button" className="suggest-btn suggest-btn--all" onClick={() => moveAll(suggestible)} disabled={!!busy}>
                <Layers size={15} /> Flytta alla {suggestible.length} till {suggestible[0].suggestion.phase_name}?
              </button>
            )}
            <ul className="sp-list">
              {g.pieces.map((p) => (
                <li key={p.session_piece_id} className="sp-row">
                  <Link to={`/pieces/${p.id}`} className="sp-main">
                    <span className="pick-thumb">
                      {p.display_image_id ? <img src={imagesAPI.getFileUrl(p.display_image_id, true)} alt="" loading="lazy" /> : <span className="pick-thumb-initial">{p.name[0]}</span>}
                    </span>
                    <span className="pick-text">
                      <span className="pick-name">{p.name}</span>
                      <span className="pick-meta">{p.phase_name || 'Ingen fas'}</span>
                    </span>
                  </Link>
                  {p.suggestion && (
                    <button type="button" className="suggest-btn" onClick={() => move(p)} disabled={!!busy}>
                      <ArrowRight size={14} /> {p.suggestion.phase_name}?
                    </button>
                  )}
                  <button type="button" className="icon-btn icon-btn--ghost" onClick={() => unlink(p)} disabled={!!busy} aria-label={`Ta bort ${p.name} från passet`}>
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <div className="study-actions-row">
        <button type="button" className="btn btn-secondary study-big-btn" onClick={onAddSeries}>
          <Plus size={18} /> Ny serie
        </button>
        <button type="button" className="btn btn-secondary study-big-btn" onClick={onLinkExisting}>
          <Link2 size={18} /> Koppla alster
        </button>
      </div>
    </section>
  );
}

export default SessionPieces;
