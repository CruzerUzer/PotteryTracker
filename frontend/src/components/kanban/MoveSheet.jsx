import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Images, MapPin, Check, Layers } from 'lucide-react';
import { Sheet, SheetContent } from '../ui/sheet';
import { imagesAPI } from '../../services/api';
import { phaseColor } from './phaseColors';
import Logo from '../Logo';

/**
 * Snabbark för en pjäs: byt fas och plats med chips, öppna pjäsen eller bilderna.
 * Används från Kanban (tryck på kort) och detaljvyn (tryck på fas/plats).
 *
 * onMove(piece, { phaseId } | { locationId }) ska returnera ett promise.
 */
function MoveSheet({
  open,
  onOpenChange,
  piece,
  phases,
  locations,
  onMove,
  onOpenImages,
  showOpenLink = true,
  focus = 'phase',
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = React.useState(null);
  // Behåll senaste pjäsen så att arket kan animera ut när piece blir null
  const last = React.useRef(piece);
  if (piece) last.current = piece;
  piece = piece || last.current;

  if (!piece) return null;

  const move = async (patch, key) => {
    if (busy) return;
    setBusy(key);
    try {
      await onMove(piece, patch);
    } finally {
      setBusy(null);
    }
  };

  const phaseSection = (
    <section className="move-section" key="phase">
      <h3 className="move-section-title">
        <Layers size={14} aria-hidden="true" /> Fas
      </h3>
      <div className="chip-row" role="radiogroup" aria-label="Fas">
        {phases.map((phase, i) => {
          const active = piece.current_phase_id === phase.id;
          const c = phaseColor(i);
          return (
            <button
              key={phase.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`chip chip--phase${active ? ' chip--active' : ''}`}
              style={{ '--chip-bg': c.bg, '--chip-border': c.border, '--chip-accent': c.accent }}
              onClick={() => !active && move({ phaseId: phase.id }, `p${phase.id}`)}
              disabled={!!busy}
            >
              {active && <Check size={14} aria-hidden="true" />}
              {phase.name}
              {busy === `p${phase.id}` && <span className="chip-spinner" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </section>
  );

  const locationOptions = [...locations, { id: null, name: 'Ingen plats' }];
  const locationSection = (
    <section className="move-section" key="location">
      <h3 className="move-section-title">
        <MapPin size={14} aria-hidden="true" /> Plats
      </h3>
      <div className="chip-row" role="radiogroup" aria-label="Plats">
        {locationOptions.map((loc) => {
          const active = (piece.current_location_id ?? null) === loc.id;
          const key = `l${loc.id}`;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              className={`chip${active ? ' chip--active' : ''}${loc.id === null ? ' chip--muted' : ''}`}
              onClick={() => !active && move({ locationId: loc.id }, key)}
              disabled={!!busy}
            >
              {active && <Check size={14} aria-hidden="true" />}
              {loc.name}
              {busy === key && <span className="chip-spinner" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </section>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={piece.name}
        className="move-sheet"
        footer={
          showOpenLink ? (
            <>
              {onOpenImages && piece.display_image_id ? (
                <button type="button" className="btn btn-secondary" onClick={() => onOpenImages(piece)}>
                  <Images size={16} /> Bilder
                </button>
              ) : null}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/pieces/${piece.id}`);
                }}
              >
                Öppna pjäsen <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={() => onOpenChange(false)}>
              Klar
            </button>
          )
        }
      >
        {showOpenLink && (
          <div className="move-hero">
            <span className="move-hero-media">
              {piece.display_image_id ? (
                <img src={imagesAPI.getFileUrl(piece.display_image_id, true)} alt="" />
              ) : (
                <Logo size={26} color="currentColor" />
              )}
            </span>
            <span className="move-hero-text">
              {piece.done === 1 && <span className="done-chip">Färdig</span>}
              <span className="move-hero-meta">
                {piece.material_count || 0} material · {piece.image_count || 0} bilder
              </span>
            </span>
          </div>
        )}
        {focus === 'location' ? [locationSection, phaseSection] : [phaseSection, locationSection]}
      </SheetContent>
    </Sheet>
  );
}

export default MoveSheet;
