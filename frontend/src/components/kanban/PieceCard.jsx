import React from 'react';
import { Link } from 'react-router-dom';
import { Package, Image as ImageIcon } from 'lucide-react';
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
export function PieceTile({ piece, accent, tint, onSelect }) {
  const initial = (piece.name || '?').trim().charAt(0).toUpperCase();
  return (
    <button
      type="button"
      className="piece-tile"
      onClick={() => onSelect(piece)}
      aria-label={`${piece.name}${piece.done === 1 ? ', färdig' : ''}. Visa alternativ`}
    >
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
        {piece.done === 1 && <span className="piece-tile-done">Färdig</span>}
      </span>
      <span className="piece-tile-body">
        <span className="piece-tile-name">{piece.name}</span>
        <Counts piece={piece} />
      </span>
    </button>
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
