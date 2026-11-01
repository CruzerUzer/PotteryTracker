import React from 'react';
import { Shuffle, Pin, PinOff, Sparkles } from 'lucide-react';

/**
 * Utmaningskortet som ett riktigt kort: baksidan visas tills man drar,
 * sedan vänds det. Kan fästas vid passet.
 */
function ChallengeCard({ card, drawing, onDraw, onPin, pinned, deckLabel, compact = false }) {
  const flipped = !!card;
  return (
    <div className={`challenge${compact ? ' challenge--compact' : ''}`}>
      <div className={`challenge-card${flipped ? ' is-flipped' : ''}`}>
        <div className="challenge-face challenge-back" aria-hidden={flipped}>
          <Sparkles size={26} aria-hidden="true" />
          <span className="challenge-back-title">Utmaningskort</span>
          {deckLabel && <span className="challenge-back-deck">{deckLabel}</span>}
          {!flipped && onDraw && (
            <button type="button" className="btn btn-primary challenge-draw" onClick={onDraw} disabled={drawing}>
              <Shuffle size={16} /> {drawing ? 'Blandar…' : 'Dra ett kort'}
            </button>
          )}
        </div>
        <div className="challenge-face challenge-front" aria-hidden={!flipped} aria-live="polite">
          {card && (
            <>
              <span className="challenge-eyebrow">Utmaning</span>
              <h3 className="challenge-name">{card.name}</h3>
              <p className="challenge-how">{card.how}</p>
              {card.trains && <p className="challenge-trains">Tränar: {card.trains}</p>}
            </>
          )}
        </div>
      </div>
      {flipped && (onDraw || onPin) && (
        <div className="challenge-actions">
          {onDraw && (
            <button type="button" className="btn btn-secondary" onClick={onDraw} disabled={drawing}>
              <Shuffle size={15} /> Dra igen
            </button>
          )}
          {onPin && (
            <button type="button" className={`btn ${pinned ? 'btn-secondary' : 'btn-primary'}`} onClick={onPin}>
              {pinned ? <PinOff size={15} /> : <Pin size={15} />}
              {pinned ? 'Lossa från passet' : 'Fäst vid passet'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ChallengeCard;
