import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { PieceTile } from './PieceCard';
import { phaseColor } from './phaseColors';

const STORAGE_KEY = 'kanban-mobile-phase';

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Mobil-Kanban: en sida per fas, swipe i sidled med scroll-snap.
 * Fassväljaren under headern visar antal och följer med vid scroll.
 * Inom fasen grupperas pjäserna per plats.
 */
function PhasePager({ phases, locations, pieces, onSelectPiece, jumpKey }) {
  const trackRef = useRef(null);
  const barRef = useRef(null);
  const rootRef = useRef(null);
  const pageRefs = useRef([]);
  const [height, setHeight] = useState(null);

  const [active, setActive] = useState(() => {
    try {
      const saved = Number(sessionStorage.getItem(STORAGE_KEY));
      const idx = phases.findIndex((p) => p.id === saved);
      return idx >= 0 ? idx : 0;
    } catch {
      return 0;
    }
  });
  const activeIdx = Math.min(active, Math.max(0, phases.length - 1));

  // Hoppa direkt till sparad fas vid första render
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (track) track.scrollLeft = activeIdx * track.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phases.length]);

  // Spara vald fas och håll aktivt chip synligt
  useEffect(() => {
    const phase = phases[activeIdx];
    if (phase) {
      try {
        sessionStorage.setItem(STORAGE_KEY, String(phase.id));
      } catch {
        /* privat läge */
      }
    }
    const bar = barRef.current;
    const chip = bar?.children[activeIdx];
    if (bar && chip) {
      const left = chip.offsetLeft - (bar.clientWidth - chip.offsetWidth) / 2;
      bar.scrollTo({ left, behavior: reduceMotion() ? 'auto' : 'smooth' });
    }
  }, [activeIdx, phases]);

  // Spårets höjd följer aktiv sida, så korta faser inte lämnar tomrum
  useEffect(() => {
    const page = pageRefs.current[activeIdx];
    if (!page || typeof ResizeObserver === 'undefined') return undefined;
    const set = () => setHeight(page.offsetHeight);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(page);
    return () => ro.disconnect();
  }, [activeIdx, pieces, phases]);

  const onScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track || !track.clientWidth) return;
    const idx = Math.round(track.scrollLeft / track.clientWidth);
    setActive((prev) => (prev === idx ? prev : idx));
  }, []);

  const goTo = (idx) => {
    const track = trackRef.current;
    if (!track) return;
    setActive(idx);
    track.scrollTo({ left: idx * track.clientWidth, behavior: reduceMotion() ? 'auto' : 'smooth' });
    // Har användaren scrollat långt ner: visa början av den nya fasen
    const root = rootRef.current;
    if (root) {
      const headerH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-header-h')) || 54;
      const top = root.getBoundingClientRect().top + window.scrollY - headerH;
      if (window.scrollY > top) window.scrollTo({ top, behavior: reduceMotion() ? 'auto' : 'smooth' });
    }
  };

  // Inaktiva fassidor är inerta: inte i tabbordningen eller för skärmläsare
  useEffect(() => {
    pageRefs.current.forEach((el, i) => {
      if (!el) return;
      if (i === activeIdx) el.removeAttribute('inert');
      else el.setAttribute('inert', '');
    });
  }, [activeIdx, phases.length]);

  const onTabKeyDown = (e) => {
    let next = null;
    if (e.key === 'ArrowRight') next = Math.min(phases.length - 1, activeIdx + 1);
    else if (e.key === 'ArrowLeft') next = Math.max(0, activeIdx - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = phases.length - 1;
    if (next === null) return;
    e.preventDefault();
    goTo(next);
    barRef.current?.children[next]?.focus();
  };

  const groupsFor = (phase) => {
    const inPhase = pieces.filter((p) => p.current_phase_id === phase.id);
    const groups = locations
      .map((loc) => ({ key: loc.id, name: loc.name, items: inPhase.filter((p) => p.current_location_id === loc.id) }))
      .filter((g) => g.items.length > 0);
    const noLoc = inPhase.filter((p) => !p.current_location_id);
    if (noLoc.length) groups.push({ key: 'none', name: 'Ingen plats', items: noLoc });
    return { total: inPhase.length, groups };
  };

  const data = phases.map(groupsFor);

  // Nytt filter: står vi på en tom fas men andra har träffar, gå till första med träffar
  const lastJumpKey = useRef(jumpKey);
  useEffect(() => {
    if (lastJumpKey.current === jumpKey) return;
    lastJumpKey.current = jumpKey;
    if (data[activeIdx]?.total > 0) return;
    const first = data.findIndex((d) => d.total > 0);
    if (first >= 0) goTo(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpKey]);

  return (
    <div className="phase-pager" ref={rootRef}>
      <div className="phase-bar" role="tablist" aria-label="Faser" ref={barRef}>
        {phases.map((phase, i) => {
          const c = phaseColor(i);
          const selected = i === activeIdx;
          return (
            <button
              key={phase.id}
              type="button"
              role="tab"
              id={`phase-tab-${phase.id}`}
              aria-selected={selected}
              aria-controls={`phase-page-${phase.id}`}
              tabIndex={selected ? 0 : -1}
              onKeyDown={onTabKeyDown}
              className={`phase-tab${selected ? ' phase-tab--active' : ''}`}
              style={{ '--tab-bg': c.bg, '--tab-border': c.border, '--tab-accent': c.accent }}
              onClick={() => goTo(i)}
            >
              <span className="phase-tab-name">{phase.name}</span>
              <span className="phase-tab-count">{data[i].total}</span>
            </button>
          );
        })}
      </div>

      <div
        className="phase-track"
        ref={trackRef}
        onScroll={onScroll}
        style={height ? { height } : undefined}
      >
        {phases.map((phase, i) => {
          const { total, groups } = data[i];
          const c = phaseColor(i);
          return (
            <section
              key={phase.id}
              id={`phase-page-${phase.id}`}
              role="tabpanel"
              aria-labelledby={`phase-tab-${phase.id}`}
              className="phase-page"
              ref={(el) => {
                pageRefs.current[i] = el;
              }}
            >
              {total === 0 ? (
                <div className="phase-empty">
                  <span className="phase-empty-mark" style={{ background: c.bg, borderColor: c.border }} />
                  <p>Inga pjäser i {phase.name.toLowerCase()} just nu.</p>
                  {i < phases.length - 1 && (
                    <button type="button" className="link-btn" onClick={() => goTo(i + 1)}>
                      Nästa fas: {phases[i + 1].name} →
                    </button>
                  )}
                </div>
              ) : (
                groups.map((g) => (
                  <div className="phase-group" key={g.key}>
                    <h3 className="phase-group-title">
                      <MapPin size={13} aria-hidden="true" />
                      {g.name}
                    </h3>
                    <div className="tile-grid">
                      {g.items.map((piece) => (
                        <PieceTile
                          key={piece.id}
                          piece={piece}
                          accent={c.accent}
                          tint={c.bg}
                          onSelect={onSelectPiece}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default PhasePager;
