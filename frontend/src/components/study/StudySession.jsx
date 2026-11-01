import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Disc3, Flag, MoreHorizontal, Play, Quote, Trash2, Minus, Plus } from 'lucide-react';
import { piecesAPI, studyAPI } from '../../services/api';
import { useToast } from '../ui/toast';
import { useConfirm } from '../ui/confirm-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import PageSkeleton from '../PageSkeleton';
import ChallengeCard from './ChallengeCard';
import SeriesForm from './SeriesForm';
import PiecePicker from './PiecePicker';
import SessionPieces from './SessionPieces';
import {
  blockStyle,
  formatDay,
  formatTime,
  minutesLabel,
  sessionTitle,
  shortBlockName,
  todayIso,
} from './studyUtils';
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
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);
  const [goal, setGoal] = useState('');
  const [seriesOpen, setSeriesOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shelf, setShelf] = useState(null);
  const [busy, setBusy] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [drawn, setDrawn] = useState(null);
  const goalSaved = useRef('');

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
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    studyAPI.getToday().then((t) => setShelf(t.shelf)).catch(() => {});
  }, [id]);

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

  const start = async () => {
    setBusy(true);
    try {
      await saveGoal();
      setSession(await studyAPI.startSession(id));
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
          {status === 'running' && `Pågår sedan ${formatTime(session.started_at)}`}
          {status === 'ended' && (
            <>
              <CheckCircle2 size={15} aria-hidden="true" /> Klart{session.started_at ? ` · ${formatTime(session.started_at)}–${formatTime(session.ended_at)}` : ''}
            </>
          )}
        </p>
      </div>

      {status !== 'ended' && session.previous?.goal && (
        <section className="study-quote">
          <Quote size={18} className="study-quote-mark" aria-hidden="true" />
          <span className="study-quote-label">Förra gången · {formatDay(session.previous.date)}</span>
          <p className="study-quote-text">{session.previous.goal}</p>
        </section>
      )}

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
            <span>Fritt pass (räknas inte upp veckan)</span>
          </label>
        )}
      </section>

      {!backdated && (
        <section className="study-section">
          <div className="study-section-head">
            <h2 className="study-h2">Dagens segment</h2>
            <span className="study-muted">{minutesLabel(totalMin)}</span>
          </div>
          <ol className="segment-list">
            {session.segments.map((seg, i) => {
              const on = seg.enabled !== false;
              return (
                <li key={seg.id} className={`segment-row${on ? '' : ' is-off'}`}>
                  <div className="segment-text">
                    <span className="segment-name">
                      {seg.wheel && <Disc3 size={14} className="segment-wheel" aria-label="På skivan" />}
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

      {status !== 'ended' && (
        <div className="session-footer">
          {status === 'prepared' && !backdated && (
            <button type="button" className="btn btn-primary study-start-btn" onClick={start} disabled={busy}>
              <Play size={20} /> Starta passet
            </button>
          )}
          {(status === 'running' || backdated) && (
            <button type="button" className="btn btn-primary study-start-btn" onClick={end} disabled={busy}>
              <Flag size={20} /> {backdated ? 'Spara passet' : 'Avsluta passet'}
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
