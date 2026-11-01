import React from 'react';
import { Link } from 'react-router-dom';
import { Package, Image as ImageIcon, ArrowLeftRight, MapPin } from 'lucide-react';
import { imagesAPI } from '../../services/api';
import Logo from '../Logo';

function Counts({ piece }) {
  return (
    <span className="piece-counts">
      <span title="Material">
        <Package size={12} aria-hidden="true" />
        <span className="sr-only">Material:</span>
        {piece.material_count || 0}
      </span>
      <span title="Bilder">
        <ImageIcon size={12} aria-hidden="true" />
        <span className="sr-only">Bilder:</span>
        {piece.image_count || 0}
      </span>
    </span>
  );
}

/**
 * Mobilkort: bild först, namn under. Tryck öppnar snabbarket (flytta/öppna).
 */
export function TileMedia({ piece, accent, tint, showDone = true }) {
  const initial = (piece.name || '?').trim().charAt(0).toUpperCase();
  return (
    <span className="piece-tile-media" style={{ '--tile-accent': accent, '--tile-tint': tint }}>
      {piece.display_image_id ? (
        <img
          src={imagesAPI.getFileUrl(piece.display_image_id, true)}
          alt=""
          loading="lazy"
          decoding="async"
          draggable="false"
        />
      ) : (
        <span className="piece-tile-placeholder" aria-hidden="true">
          <span className="piece-tile-initial">{initial}</span>
          <Logo size={14} color="currentColor" />
        </span>
      )}
      {showDone && piece.done === 1 && <span className="piece-tile-done">Färdig</span>}
    </span>
  );
}

export function PieceTile({ piece, accent, tint, onSelect }) {
  return (
    <button
      type="button"
      className="piece-tile"
      onClick={() => onSelect(piece)}
      aria-label={`${piece.name}${piece.done === 1 ? ', färdig' : ''}. Visa alternativ`}
    >
      <TileMedia piece={piece} accent={accent} tint={tint} />
      <span className="piece-tile-body">
        <span className="piece-tile-name">{piece.name}</span>
        <Counts piece={piece} />
      </span>
    </button>
  );
}

/**
 * Kort i Lista och Färdiga: hela kortet öppnar pjäsen. Valfri flytta-knapp
 * öppnar snabbarket (ersätter de gamla fas/plats-väljarna på kortet).
 */
export function PieceLinkTile({ piece, phaseIndex = -1, phaseColorOf, onMove, showPhase = true, showDone = true }) {
  const c = phaseColorOf ? phaseColorOf(phaseIndex) : null;
  return (
    <div className="piece-tile piece-tile--link">
      <Link to={`/pieces/${piece.id}`} className="piece-tile-link">
        <TileMedia piece={piece} accent={c?.accent} tint={c?.bg} showDone={showDone} />
        <span className="piece-tile-body">
          <span className="piece-tile-name">{piece.name}</span>
          {showPhase && (piece.phase_name || piece.location_name) && (
            <span className="piece-tile-meta">
              {piece.phase_name && (
                <span
                  className="phase-dot-label"
                  style={c ? { '--dot': c.accent } : undefined}
                >
                  {piece.phase_name}
                </span>
              )}
              {piece.location_name && (
                <span className="piece-tile-location">
                  <MapPin size={11} aria-hidden="true" />
                  {piece.location_name}
                </span>
              )}
            </span>
          )}
          <Counts piece={piece} />
        </span>
      </Link>
      {onMove && (
        <button
          type="button"
          className="piece-tile-action"
          onClick={() => onMove(piece)}
          aria-label={`Flytta ${piece.name}`}
          title="Byt fas eller plats"
        >
          <ArrowLeftRight size={15} />
        </button>
      )}
    </div>
  );
}

/**
 * Desktopkort i matrisen: dragbart, klick på bilden öppnar lightboxen,
 * klick på texten öppnar pjäsen.
 */
export function MatrixCard({ piece, dragging, onDragStart, onDragEnd, onOpenImages }) {
  return (
    <div
      className={`matrix-card${dragging ? ' matrix-card--dragging' : ''}`}
      draggable
      onDragStart={(e) => onDragStart(e, piece)}
      onDragEnd={onDragEnd}
    >
      {piece.display_image_id && (
        <button
          type="button"
          className="matrix-card-media"
          onClick={(e) => onOpenImages(piece, e)}
          aria-label={`Visa bilder på ${piece.name}`}
          draggable="false"
        >
          <img
            src={imagesAPI.getFileUrl(piece.display_image_id, true)}
            alt=""
            loading="lazy"
            draggable="false"
          />
        </button>
      )}
      <Link to={`/pieces/${piece.id}`} className="matrix-card-body" draggable="false">
        <span className="matrix-card-title">
          <h4>{piece.name}</h4>
          {piece.done === 1 && <span className="done-chip">Färdig</span>}
        </span>
        <Counts piece={piece} />
      </Link>
    </div>
  );
}
