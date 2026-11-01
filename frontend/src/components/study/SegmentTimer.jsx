import React from 'react';
import { Bell, Check, Disc3, Flag, Plus, SkipForward } from 'lucide-react';
import { imagesAPI } from '../../services/api';
import { formatCountdown, formatDuration, clockTime } from '../../hooks/useStudyClock';

function WheelBand({ wheel }) {
  if (!wheel) return null;
  const range = `${clockTime(wheel.fromMs)}–${clockTime(wheel.toMs)}`;
  let text;
  if (wheel.state === 'before') text = `Skivan börjar om ${formatDuration(wheel.secondsToChange)}`;
  else if (wheel.state === 'on') text = `På skivan, ${formatDuration(wheel.secondsToChange)} kvar`;
  else text = 'Skivtiden är slut';
  return (
    <div className={`wheel-band wheel-band--${wheel.state}`} role="status">
      <Disc3 size={16} aria-hidden="true" className={wheel.state === 'on' ? 'wheel-spin' : ''} />
      <span className="wheel-text">{text}</span>
      <span className="wheel-range">Skivan {range}</span>
    </div>
  );
}

/** Rad i snabbåtgärderna: tryck för att bocka av alstret i passet. */
function QuickPiece({ piece, done, label, onToggle, busy }) {
  return (
    <li>
      <button type="button" className={`quick-piece${done ? ' is-done' : ''}`} onClick={() => onToggle(piece)} disabled={busy}>
        <span className="pick-thumb">
          {piece.display_image_id ? <img src={imagesAPI.getFileUrl(piece.display_image_id, true)} alt="" loading="lazy" /> : <span className="pick-thumb-initial">{piece.name[0]}</span>}
        </span>
        <span className="pick-name">{piece.name}</span>
        <span className="quick-check" aria-hidden="true">{done ? <Check size={18} /> : label}</span>
      </button>
    </li>
  );
}

/** Snabbåtgärder för det aktuella segmentet. */
export function QuickActions({ segmentId, shelf, session, onSeries, onToggle, onEnd, busyId }) {
  const linked = (action) => new Set(session.pieces.filter((p) => p.action === action).map((p) => p.id));
  if (segmentId === 'main') {
    return (
      <div className="quick">
        <button type="button" className="btn btn-primary study-big-btn quick-wide" onClick={onSeries}>
          <Plus size={18} /> Lägg till nya alster
        </button>
      </div>
    );
  }
  if (segmentId === 'finish') {
    const trimmed = linked('trimmed');
    const pieces = shelf?.toTrim || [];
    return (
      <div className="quick">
        <h3 className="quick-title">Att svarva och hänkla</h3>
        {pieces.length ? (
          <ul className="quick-list">
            {pieces.map((p) => (
              <QuickPiece key={p.id} piece={p} done={trimmed.has(p.id)} label="Svarvat" busy={busyId === p.id} onToggle={(x) => onToggle(x, 'trimmed', trimmed.has(x.id))} />
            ))}
          </ul>
        ) : (
          <p className="study-muted">Inget drejat gods väntar. Koppla alster nedan om du svarvar något annat.</p>
        )}
      </div>
    );
  }
  if (segmentId === 'surface') {
    const glazed = linked('glazed');
    const pieces = shelf?.toGlaze || [];
    return (
      <div className="quick">
        <h3 className="quick-title">Skröjbränt att glasera</h3>
        {pieces.length ? (
          <ul className="quick-list">
            {pieces.map((p) => (
              <QuickPiece key={p.id} piece={p} done={glazed.has(p.id)} label="Glaserat" busy={busyId === p.id} onToggle={(x) => onToggle(x, 'glazed', glazed.has(x.id))} />
            ))}
          </ul>
        ) : (
          <p className="study-muted">Inget skröjbränt gods på hyllan.</p>
        )}
      </div>
    );
  }
  if (segmentId === 'out') {
    return (
      <div className="quick">
        <p className="study-muted">Städa, märk godset och skriv tre rader i loggboken.</p>
        <button type="button" className="btn btn-primary study-big-btn quick-wide" onClick={onEnd}>
          <Flag size={18} /> Avsluta och skriv i loggboken
        </button>
      </div>
    );
  }
  return null;
}

/**
 * Timern: stora siffror, aktuellt segment, tid kvar, nästa segment och
 * skivbandet. Allt räknas från klockan (useStudyClock).
 */
function SegmentTimer({ clock, mode, onNext, onPlus10, onEnd, busy, notify, onEnableNotify, children }) {
  if (!clock) return null;
  const { current, next, before, over } = clock;
  const showClock = mode !== 'countdown';
  return (
    <section className={`timer${current?.wheel ? ' timer--wheel' : ''}${over ? ' timer--over' : ''}`} aria-live="polite">
      {showClock && <WheelBand wheel={clock.wheel} />}

      {over ? (
        <div className="timer-main">
          <span className="timer-seg-label">Passet är slut</span>
          <div className="timer-digits timer-digits--over">+{formatCountdown(clock.overtimeSec)}</div>
          <p className="timer-desc">Avsluta och skriv de tre raderna i loggboken.</p>
        </div>
      ) : (
        <div className="timer-main">
          <span className="timer-seg-label">
            {before ? `Passet börjar ${clockTime(clock.startMs)}` : `Segment ${clock.index + 1} av ${clock.timeline.length}`}
          </span>
          <h2 className="timer-seg-name">
            {current?.wheel && <Disc3 size={20} aria-label="På skivan" className="timer-seg-wheel" />}
            {current?.name}
          </h2>
          <div className="timer-digits" role="timer" aria-label={`${formatDuration(clock.segRemainingSec)} kvar i segmentet`}>
            {formatCountdown(clock.segRemainingSec)}
          </div>
          <div className="timer-bar" aria-hidden="true">
            <span style={{ transform: `scaleX(${clock.segProgress})` }} />
          </div>
          {current?.description && <p className="timer-desc">{current.description}</p>}
        </div>
      )}

      <dl className="timer-facts">
        <div>
          <dt>Kvar av passet</dt>
          <dd>{formatDuration(clock.totalRemainingSec)}</dd>
        </div>
        {showClock && (
          <div>
            <dt>Slutar</dt>
            <dd>{clockTime(clock.endMs)}</dd>
          </div>
        )}
        {next && (
          <div className="timer-next">
            <dt>Sedan</dt>
            <dd>
              {next.wheel && <Disc3 size={12} aria-hidden="true" />} {next.name}
              {showClock ? ` · ${clockTime(next.startMs)}` : ` · ${next.minutes} min`}
            </dd>
          </div>
        )}
      </dl>

      <div className="timer-buttons">
        {!over && (
          <button type="button" className="btn btn-secondary timer-btn" onClick={onNext} disabled={busy || !next}>
            <SkipForward size={18} /> Nästa segment
          </button>
        )}
        {!over && (
          <button type="button" className="btn btn-secondary timer-btn" onClick={onPlus10} disabled={busy}>
            <Plus size={18} /> 10 min
          </button>
        )}
        <button type="button" className={`btn ${over ? 'btn-primary' : 'btn-secondary'} timer-btn timer-btn--end`} onClick={onEnd} disabled={busy}>
          <Flag size={18} /> Avsluta passet
        </button>
      </div>

      {notify === 'default' && (
        <button type="button" className="link-btn timer-notify" onClick={onEnableNotify}>
          <Bell size={14} /> Påminn mig vid segmentbyte
        </button>
      )}

      {children}

      {showClock && (
        <ol className="timer-timeline" aria-label="Dagens segment">
          {clock.timeline.map((s, i) => (
            <li key={s.id} className={`${i === clock.index ? 'is-now' : ''}${clock.index > i || over ? ' is-past' : ''}${s.endSec === s.startSec ? ' is-empty' : ''}`}>
              <span className="tl-time">{clockTime(s.startMs)}</span>
              <span className="tl-name">{s.wheel && <Disc3 size={12} aria-hidden="true" />} {s.name}</span>
              <span className="tl-min">{s.minutes} min</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default SegmentTimer;
