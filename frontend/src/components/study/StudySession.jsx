import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Disc3, Flag, MoreHorizontal, Play, Quote, Trash2, Minus, Plus } from 'lucide-react';
import { piecesAPI, studyAPI } from '../../services/api';
import { useToast } from '../ui/toast';
import { useConfirm } from '../ui/confirm-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import PageSkeleton from '../PageSkeleton';
import ChallengeCard from './ChallengeCard';
import Inspiration from './Inspiration';
import SeriesForm from './SeriesForm';
import PiecePicker from './PiecePicker';
import SessionPieces from './SessionPieces';
import LogbookForm from './LogbookForm';
import { GlazeTestForm } from './GlazeForms';
import { GlazeTile } from './StudyGlaze';
import { Link } from 'react-router-dom';
import SegmentTimer, { QuickActions } from './SegmentTimer';
import { useStudyClock } from '../../hooks/useStudyClock';
import { useWakeLock } from '../../hooks/useWakeLock';
import {
  blockStyle,
  formatDay,
  formatTime,
  minutesLabel,
  sessionTitle,
  shortBlockName,
  todayIso,
  readLocal,
  writeLocal,
} from './studyUtils';

const CACHE_KEY = 'study.activeSession';
const START_TIME_KEY = 'study.startTime';

/** Nästa hela kvart som HH:MM, förval för "ange starttid". */
function nextQuarter(d = new Date()) {
  const t = new Date(d);
  t.setSeconds(0, 0);
  t.setMinutes(Math.ceil((t.getMinutes() + 1) / 15) * 15);
  return t.toTimeString().slice(0, 5);
}

/** HH:MM i dag (eller i morgon om det redan passerat med mer än tolv timmar). */
function timeToIso(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  if (d.getTime() - Date.now() < -12 * 3600 * 1000) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

const START_MODES = [
  { id: 'now', label: 'Starta nu' },
  { id: 'clock', label: 'Ange starttid' },
  { id: 'countdown', label: 'Nedräkning' },
];
import '../../styles/study.css';

const SINGULAR = {
  cylindrar: 'Cylinder', cylinder: 'Cylinder', bägare: 'Bägare', muggar: 'Mugg', skålar: 'Skål',
  tallrikar: 'Tallrik', burkar: 'Burk', lock: 'Lock', flaskor: 'Flaska', kannor: 'Kanna',
  klumpar: 'Klump', kroppar: 'Tekanna', fat: 'Fat', vaser: 'Vas',
};

/** "8 cylindrar à 500 g" i veckans text → förslag till serieformuläret. */
export function seriesSuggestion(text = '') {
  const re = /(\d+)\s+([a-zåäö]+)\s+à\s+([\d,–-]+)\s*(k?g)/gi;
  // Klumpar är centreringsövning, inte en serie som sparas
  const m = [...text.matchAll(re)].find((x) => x[2].toLowerCase() !== 'klumpar');
  if (!m) return null;
  const word = m[2].toLowerCase();
  let weight = parseFloat(m[3].split(/[–-]/)[0].replace(',', '.'));
  if (m[4].toLowerCase() === 'kg') weight *= 1000;
  return {
    count: Math.min(40, Number(m[1])),
    name: SINGULAR[word] || m[2][0].toUpperCase() + m[2].slice(1),
    weight: Math.round(weight) || undefined,
  };
}

function StudySession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  // localStorage är bara cache för att visa rätt läge direkt vid omladdning
  const [session, setSessionState] = useState(() => {
    const cached = readLocal(CACHE_KEY);
    return cached && String(cached.id) === String(id) ? cached : null;
  });
  const setSession = useCallback((s) => {
    setSessionState(s);
    if (s?.status === 'running') writeLocal(CACHE_KEY, s);
    else if (s && String(readLocal(CACHE_KEY)?.id) === String(s.id)) writeLocal(CACHE_KEY, null);
  }, []);
  const [startMode, setStartMode] = useState('now');
  const [startTime, setStartTime] = useState(() => readLocal(START_TIME_KEY) || nextQuarter());
  const [busyPiece, setBusyPiece] = useState(null);
  const [notifyPerm, setNotifyPerm] = useState(() => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission));
  const [error, setError] = useState(null);
  const [goal, setGoal] = useState(() => session?.goal || '');
  const [seriesOpen, setSeriesOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shelf, setShelf] = useState(null);
  const [busy, setBusy] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [drawn, setDrawn] = useState(null);
  const goalSaved = useRef('');
  const [editingLog, setEditingLog] = useState(false);
  const [glazeTests, setGlazeTests] = useState([]);
  const [glazeForm, setGlazeForm] = useState(null);
  const [reviewDue, setReviewDue] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const s = await studyAPI.getSession(id);
      setSession(s);
      setGoal(s.goal || '');
      goalSaved.current = s.goal || '';
    } catch (err) {
      setError(err.message);
    }
  }, [id, setSession]);

  useEffect(() => {
    load();
  }, [load]);

  const running = session?.status === 'running';
  const ended = session?.status === 'ended';

  useEffect(() => {
    if (!ended) return;
    studyAPI.getReviews().then((r) => setReviewDue(r.due)).catch(() => {});
  }, [ended]);
  const clock = useStudyClock(running ? session : null, { active: running });
  useWakeLock(running);

  // Notis och vibration vid segmentbyte, bara om tillåtet och sidan är öppen
  const lastIndex = useRef(null);
  useEffect(() => {
    if (!clock) return;
    const key = clock.over ? 'over' : clock.index;
    if (lastIndex.current !== null && lastIndex.current !== key && !clock.before) {
      const title = clock.over ? 'Passet är slut' : clock.current?.name;
      const body = clock.over ? 'Skriv tre rader i loggboken.' : clock.current?.description?.split('. ')[0];
      toast.info(title, body);
      try {
        navigator.vibrate?.([120, 80, 120]);
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.visibilityState === 'visible') {
          new Notification(title, { body, tag: 'studie-segment', icon: '/favicon.svg' });
        }
      } catch {
        /* tyst */
      }
    }
    lastIndex.current = key;
  }, [clock?.index, clock?.over, clock?.before]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    studyAPI.getToday().then((t) => setShelf(t.shelf)).catch(() => {});
  }, [id]);

  const loadGlaze = useCallback(() => {
    studyAPI.listGlazeTests(id).then(setGlazeTests).catch(() => {});
  }, [id]);
  useEffect(() => { loadGlaze(); }, [loadGlaze]);

  const update = async (patch, { quiet = true } = {}) => {
    try {
      const s = await studyAPI.updateSession(id, patch);
      setSession(s);
      if (!quiet) toast.success('Sparat');
      return s;
    } catch (err) {
      toast.error('Kunde inte spara', err.message);
      return null;
    }
  };

  const saveGoal = async () => {
    if (goal === goalSaved.current) return;
    goalSaved.current = goal;
    await update({ goal });
  };

  const setSegments = (segments) => {
    setSession((s) => ({ ...s, segments }));
    update({ segments });
  };

  /** Ändra segment medan passet pågår: nästa segment / +10 min. */
  const adjustCurrent = async (fn) => {
    if (!clock?.current) return;
    const segId = clock.current.id;
    const segments = session.segments.map((seg) => (seg.id === segId ? fn(seg) : seg));
    setSession({ ...session, segments });
    setBusy(true);
    await update({ segments });
    setBusy(false);
  };
  const nextSegment = () =>
    adjustCurrent((seg) => ({ ...seg, minutes: Math.max(0, Math.floor((clock.elapsedSec - clock.current.startSec) / 60)) }));
  const plusTen = () => adjustCurrent((seg) => ({ ...seg, minutes: seg.minutes + 10 }));

  const toggleQuick = async (piece, action, isDone) => {
    setBusyPiece(piece.id);
    try {
      if (isDone) {
        const link = session.pieces.find((p) => p.id === piece.id && p.action === action);
        if (link) setSession(await studyAPI.unlinkPiece(id, link.session_piece_id));
      } else {
        const res = await studyAPI.linkPiece(id, piece.id, action);
        setSession(res.session);
      }
    } catch (err) {
      toast.error('Kunde inte spara', err.message);
    } finally {
      setBusyPiece(null);
    }
  };

  const enableNotify = async () => {
    try {
      setNotifyPerm(await Notification.requestPermission());
    } catch {
      setNotifyPerm('denied');
    }
  };

  const start = async () => {
    setBusy(true);
    try {
      await saveGoal();
      const body = { mode: startMode };
      if (startMode === 'clock') {
        body.planned_start = timeToIso(startTime);
        writeLocal(START_TIME_KEY, startTime);
      }
      setSession(await studyAPI.startSession(id, body));
      window.scrollTo({ top: 0 });
    } catch (err) {
      toast.error('Kunde inte starta passet', err.message);
    } finally {
      setBusy(false);
    }
  };

  const end = async () => {
    setBusy(true);
    try {
      await saveGoal();
      const s = await studyAPI.endSession(id);
      setSession(s);
      toast.success(s.is_free ? 'Det fria passet är sparat' : `${sessionTitle(s)} är klart`);
      window.scrollTo({ top: 0 });
    } catch (err) {
      toast.error('Kunde inte avsluta passet', err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: 'Ta bort passet?',
      description: 'Passet och dess kopplingar till alster tas bort. Alstren finns kvar.',
      confirmLabel: 'Ta bort',
      destructive: true,
    });
    if (!ok) return;
    try {
      await studyAPI.deleteSession(id);
      toast.success('Passet är borttaget');
      navigate('/studie', { replace: true });
    } catch (err) {
      toast.error('Kunde inte ta bort passet', err.message);
    }
  };

  const drawCard = async () => {
    setDrawing(true);
    try {
      const res = await studyAPI.drawCard(session.plan_block_id || undefined, drawn?.id || session.challenge_card_id);
      setDrawn(null);
      await new Promise((r) => setTimeout(r, 180));
      setDrawn(res.card);
    } catch (err) {
      toast.error('Kunde inte dra ett kort', err.message);
    } finally {
      setDrawing(false);
    }
  };

  const suggestion = useMemo(() => seriesSuggestion(session?.goal || ''), [session?.goal]);

  if (error) {
    return (
      <div className="study">
        <div className="error" role="alert">{error}</div>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/studie')}>
          <ArrowLeft size={16} /> Till Idag
        </button>
      </div>
    );
  }
  if (!session) return <PageSkeleton rows={5} label="Hämtar passet" />;

  const status = session.status;
  const backdated = session.date < todayIso();
  const enabled = session.segments.filter((s) => s.enabled !== false);
  const totalMin = enabled.reduce((sum, s) => sum + (s.minutes || 0), 0);
  const card = drawn || session.challenge_card;
  const blockOrder = session.block_order ?? 0;
  const editableSegments = status === 'prepared';
  const prev = session.previous;
  const prevChange = prev?.log?.change;
  const previousQuote = prev && (prevChange || prev.goal) ? (
    <section className="study-quote">
      <Quote size={18} className="study-quote-mark" aria-hidden="true" />
      <span className="study-quote-label">
        {prevChange ? 'Förra gången bestämde du' : 'Förra gången'} · {formatDay(prev.date)}
      </span>
      <p className="study-quote-text">{prevChange || prev.goal}</p>
      {prev.log?.observation && <p className="study-quote-sub">Observation: {prev.log.observation}</p>}
    </section>
  ) : null;
  const inspirationBlock = session.inspiration?.length ? (
    <section className="study-card">
      <Inspiration items={session.inspiration} />
    </section>
  ) : null;
  const log = session.log;
  const logSummary = log ? (
    <section className="study-card log-summary">
      <div className="study-section-head">
        <h2 className="study-h2">Loggboken</h2>
        <button type="button" className="link-btn" onClick={() => setEditingLog(true)}>Redigera</button>
      </div>
      {(session.logbook_fields || []).map((f) => {
        const key = { goalAndMeasure: 'goal_and_measure', observation: 'observation', change: 'change' }[f.id];
        return log[key] ? (
          <div key={f.id} className="log-summary-line">
            <span className="study-label">{f.label}</span>
            <p>{log[key]}</p>
          </div>
        ) : null;
      })}
      <p className="log-summary-meta">
        {[log.clay_name, log.weight_grams && `${log.weight_grams} g`, log.series_number && `Märk: ${log.series_number}`, log.into_damp_box && `Fuktlåda: ${log.into_damp_box}`]
          .filter(Boolean).join(' · ')}
      </p>
      {session.images?.length > 0 && (
        <div className="logbook-photos logbook-photos--view">
          {session.images.map((img) => (
            <a key={img.id} href={studyAPI.sessionImageUrl(img.id)} target="_blank" rel="noreferrer" className="logbook-photo">
              <img src={studyAPI.sessionImageUrl(img.id, true)} alt={img.piece_name || 'Foto från passet'} />
            </a>
          ))}
        </div>
      )}
    </section>
  ) : null;

  return (
    <div className="study study-session" style={blockStyle(blockOrder)}>
      <div className="detail-topbar">
        <button type="button" className="icon-btn" onClick={() => navigate('/studie')} aria-label="Till Idag">
          <ArrowLeft size={19} />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="icon-btn" aria-label="Fler val">
              <MoreHorizontal size={19} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52" onCloseAutoFocus={(e) => e.preventDefault()}>
            <DropdownMenuItem onClick={remove} className="gap-2 text-[var(--color-error)]">
              <Trash2 size={15} /> Ta bort passet
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="session-head">
        <span className="study-eyebrow">
          {session.block_name ? shortBlockName(session.block_name) : 'Studie'} · {formatDay(session.date, { weekday: 'long' })}
        </span>
        <h1 className="study-title">{sessionTitle(session)}</h1>
        <p className="session-status">
          {status === 'prepared' && (backdated ? 'Loggas i efterhand' : 'Förberedelse')}
          {status === 'running' && (session.timer_mode === 'countdown' ? 'Nedräkning' : `Pågår · start ${formatTime(session.planned_start)}`)}
          {status === 'ended' && (
            <>
              <CheckCircle2 size={15} aria-hidden="true" /> Klart{session.started_at ? ` · ${formatTime(session.started_at)}–${formatTime(session.ended_at)}` : ''}
            </>
          )}
        </p>
      </div>

      {running && (
        <SegmentTimer
          clock={clock}
          mode={session.timer_mode}
          onNext={nextSegment}
          onPlus10={plusTen}
          onEnd={end}
          busy={busy}
          notify={notifyPerm}
          onEnableNotify={enableNotify}
        >
          {clock?.current?.id === 'in' && previousQuote}
          {clock?.current?.id === 'in' && inspirationBlock}
          {(clock?.over || clock?.current?.id === 'out') && (
            <div className="quick">
              <h3 className="quick-title">Loggboken</h3>
              <LogbookForm
                session={session}
                onChange={setSession}
                submitLabel="Spara och avsluta passet"
                onSubmitExtra={end}
                onSaved={() => {}}
              />
            </div>
          )}
          {!clock?.over && clock?.current?.id !== 'out' && (
            <QuickActions
              segmentId={clock?.current?.id}
              shelf={shelf}
              session={session}
              onSeries={() => setSeriesOpen(true)}
              onToggle={toggleQuick}
              onEnd={end}
              busyId={busyPiece}
            />
          )}
        </SegmentTimer>
      )}

      {status === 'prepared' && previousQuote}
      {status === 'prepared' && inspirationBlock}

      {ended && reviewDue && (
        <Link to={`/studie/utvardering/${reviewDue.blockId}`} className="review-due">
          <span className="study-eyebrow">{shortBlockName(reviewDue.name)} avklarat</span>
          <span className="review-due-title">Dags för blockutvärderingen</span>
          <span className="study-muted">Fem frågor, foton från blocket och nästa blocks delmål.</span>
        </Link>
      )}

      {ended && (!log || editingLog) && (
        <section className="study-section">
          <h2 className="study-h2">Loggboken</h2>
          <LogbookForm
            session={session}
            onChange={setSession}
            onSaved={async () => {
              setEditingLog(false);
              setSession(await studyAPI.getSession(id));
              toast.success('Loggboken är sparad');
            }}
          />
        </section>
      )}
      {ended && log && !editingLog && logSummary}

      <section className="study-section">
        <label className="field">
          <span className="study-h2">Dagens delmål</span>
          <textarea
            className="field-input"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onBlur={saveGoal}
            rows={3}
            placeholder="Vad ska du göra, och hur mäter du det?"
          />
        </label>
        {status === 'prepared' && !backdated && (
          <label className="study-check">
            <input type="checkbox" checked={session.is_free} onChange={(e) => update({ is_free: e.target.checked })} />
            <span>Fritt pass (räknar inte upp veckan)</span>
          </label>
        )}
      </section>

      {!backdated && !running && !ended && (
        <section className="study-section">
          <div className="study-section-head">
            <h2 className="study-h2">Dagens moment</h2>
            <span className="study-muted">{minutesLabel(totalMin)}</span>
          </div>
          <ol className="segment-list">
            {session.segments.map((seg, i) => {
              const on = seg.enabled !== false;
              return (
                <li key={seg.id} className={`segment-row${on ? '' : ' is-off'}`}>
                  <div className="segment-text">
                    <span className="segment-name">
                      {seg.wheel && <Disc3 size={14} className="segment-wheel" aria-label="På drejskivan" />}
                      {seg.name}
                    </span>
                    {on && seg.description && <span className="segment-desc">{seg.description}</span>}
                  </div>
                  {editableSegments ? (
                    <div className="segment-controls">
                      <div className="stepper stepper--sm">
                        <button type="button" className="stepper-btn" disabled={!on || seg.minutes <= 5}
                          onClick={() => setSegments(session.segments.map((s, j) => (j === i ? { ...s, minutes: s.minutes - 5 } : s)))}
                          aria-label={`Kortare ${seg.name}`}><Minus size={16} /></button>
                        <span className="stepper-value">{seg.minutes}</span>
                        <button type="button" className="stepper-btn" disabled={!on}
                          onClick={() => setSegments(session.segments.map((s, j) => (j === i ? { ...s, minutes: s.minutes + 5 } : s)))}
                          aria-label={`Längre ${seg.name}`}><Plus size={16} /></button>
                      </div>
                      <button type="button" role="switch" aria-checked={on} aria-label={`${seg.name} i dag`}
                        className={`switch${on ? ' switch--on' : ''}`}
                        onClick={() => setSegments(session.segments.map((s, j) => (j === i ? { ...s, enabled: !on } : s)))}>
                        <span className="switch-thumb" />
                      </button>
                    </div>
                  ) : (
                    <span className="segment-min">{on ? `${seg.minutes} min` : 'Hoppas över'}</span>
                  )}
                </li>
              );
            })}
          </ol>
          {editableSegments && <p className="study-muted">Ändringarna gäller bara det här passet. Mallen ändras inte.</p>}
        </section>
      )}

      <SessionPieces
        session={session}
        onChange={setSession}
        onAddSeries={() => setSeriesOpen(true)}
        onLinkExisting={() => setPickerOpen(true)}
      />

      <section className="study-section">
        <div className="study-section-head">
          <h2 className="study-h2">Provplattor{glazeTests.length ? ` · ${glazeTests.length}` : ''}</h2>
          <button type="button" className="link-btn" onClick={() => setGlazeForm({ id: null })}>
            <Plus size={13} /> Ny provplatta
          </button>
        </div>
        {glazeTests.length > 0 ? (
          <ul className="tile-list">{glazeTests.map((t) => <GlazeTile key={t.id} t={t} onOpen={(gid) => setGlazeForm({ id: gid })} />)}</ul>
        ) : (
          <p className="study-muted">Inga provplattor i passet.</p>
        )}
      </section>

      <section className="study-section">
        <h2 className="study-h2">Utmaningskort</h2>
        <ChallengeCard
          card={card}
          drawing={drawing}
          onDraw={status === 'ended' ? undefined : drawCard}
          compact
          pinned={!!session.challenge_card_id && card?.id === session.challenge_card_id}
          onPin={
            status === 'ended' || !card
              ? undefined
              : () => update({ challenge_card_id: session.challenge_card_id === card.id ? null : card.id })
          }
        />
        {status === 'ended' && !card && <p className="study-muted">Inget kort drogs.</p>}
      </section>

      {status === 'prepared' && !backdated && (
        <section className="study-section start-panel">
          <h2 className="study-h2">Starta</h2>
          <div className="segmented segmented--wrap" role="radiogroup" aria-label="Hur passet startar">
            {START_MODES.map((m) => (
              <button key={m.id} type="button" role="radio" aria-checked={startMode === m.id}
                className={`segmented-item ${startMode === m.id ? 'active' : ''}`} onClick={() => setStartMode(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
          {startMode === 'clock' && (
            <label className="field start-time">
              <span className="field-sublabel">Passet börjar</span>
              <input type="time" className="field-input field-input--lg" value={startTime} step={300}
                onChange={(e) => setStartTime(e.target.value)} />
              <span className="field-hint">Drejskivan är bokad från {(session.wheel_booking?.fromMinute ?? 15)} minuter in i passet.</span>
            </label>
          )}
          <p className="study-muted">
            {startMode === 'now' && `Klockan börjar nu. Passet är ${minutesLabel(totalMin)}.`}
            {startMode === 'clock' && 'Momenten följer klockan, så att tiden på drejskivan stämmer med bokningen.'}
            {startMode === 'countdown' && 'Bara nedräkning, utan klockslag och skivband.'}
          </p>
        </section>
      )}

      {status !== 'ended' && !running && (
        <div className="session-footer">
          {status === 'prepared' && !backdated && (
            <button type="button" className="btn btn-primary study-start-btn" onClick={start} disabled={busy || (startMode === 'clock' && !startTime)}>
              <Play size={20} /> Starta passet
            </button>
          )}
          {backdated && (
            <button type="button" className="btn btn-primary study-start-btn" onClick={end} disabled={busy}>
              <Flag size={20} /> Spara passet
            </button>
          )}
          {status === 'prepared' && !backdated && (
            <button type="button" className="link-btn" onClick={end} disabled={busy}>
              Avsluta utan att starta
            </button>
          )}
        </div>
      )}

      {status === 'ended' && (
        <div className="session-footer">
          <button type="button" className="btn btn-secondary study-start-btn" onClick={() => navigate('/studie')}>
            Till Idag
          </button>
        </div>
      )}

      <GlazeTestForm
        open={!!glazeForm}
        onOpenChange={(o) => !o && setGlazeForm(null)}
        testId={glazeForm?.id || null}
        sessionId={session.id}
        onSaved={loadGlaze}
      />
      <SeriesForm
        open={seriesOpen}
        onOpenChange={setSeriesOpen}
        sessionId={session.id}
        suggestion={suggestion}
        onCreated={(res) => setSession(res.session)}
      />
      <PiecePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        sessionId={session.id}
        shelf={shelf}
        linked={session.pieces}
        onLinked={(res, piece) => {
          setSession(res.session);
          if (res.suggestion) {
            toast.info(`Flytta till ${res.suggestion.phase_name}?`, piece.name, {
              duration: 6000,
              action: {
                label: 'Flytta',
                onClick: async () => {
                  try {
                    await piecesAPI.updatePhase(piece.id, res.suggestion.phase_id);
                    setSession(await studyAPI.getSession(id));
                  } catch (err) {
                    toast.error('Kunde inte flytta alstret', err.message);
                  }
                },
              },
            });
          }
        }}
      />
    </div>
  );
}

export default StudySession;
