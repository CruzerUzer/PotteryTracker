import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CalendarPlus,
  Check,
  ChevronDown,
  Feather,
  Hammer,
  Paintbrush,
  Play,
  Quote,
} from 'lucide-react';
import { studyAPI, imagesAPI } from '../../services/api';
import { useToast } from '../ui/toast';
import { Sheet, SheetContent } from '../ui/sheet';
import PageSkeleton from '../PageSkeleton';
import ProgressRing from './ProgressRing';
import ChallengeCard from './ChallengeCard';
import {
  blockStyle,
  shortBlockName,
  blockTheme,
  formatDay,
  todayIso,
  readLocal,
  writeLocal,
  sessionTitle,
} from './studyUtils';
import '../../styles/study.css';

const CARD_KEY = 'study.drawnCard';

function ShelfRow({ icon: Icon, title, pieces, dateLabel }) {
  const [open, setOpen] = useState(false);
  if (!pieces.length) return null;
  const names = [...new Set(pieces.map((p) => p.name.replace(/\s*·\s*S\d+-\d+$/, '')))];
  return (
    <li className="shelf-row">
      <button type="button" className="shelf-row-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="shelf-icon"><Icon size={17} /></span>
        <span className="shelf-text">
          <span className="shelf-title">{title}: {pieces.length} {pieces.length === 1 ? 'alster' : 'alster'}</span>
          <span className="shelf-meta">{names.slice(0, 3).join(', ')}{names.length > 3 ? ' …' : ''}{dateLabel ? ` · ${dateLabel}` : ''}</span>
        </span>
        <ChevronDown size={16} className={`shelf-chevron${open ? ' is-open' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <ul className="shelf-pieces">
          {pieces.map((p) => (
            <li key={p.id}>
              <Link to={`/pieces/${p.id}`} className="shelf-piece">
                <span className="pick-thumb">
                  {p.display_image_id ? <img src={imagesAPI.getFileUrl(p.display_image_id, true)} alt="" loading="lazy" /> : <span className="pick-thumb-initial">{p.name[0]}</span>}
                </span>
                <span className="pick-name">{p.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function StudyToday() {
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [card, setCard] = useState(() => readLocal(CARD_KEY));
  const [drawing, setDrawing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [lateOpen, setLateOpen] = useState(false);
  const [lateDate, setLateDate] = useState(todayIso());
  const [lateFree, setLateFree] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await studyAPI.getToday());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const drawCard = async (deck) => {
    setDrawing(true);
    try {
      const res = await studyAPI.drawCard(deck, card?.id);
      // Låt baksidan synas ett ögonblick innan kortet vänds
      setCard(null);
      await new Promise((r) => setTimeout(r, 180));
      setCard(res.card);
      writeLocal(CARD_KEY, res.card);
    } catch (err) {
      toast.error('Kunde inte dra ett kort', err.message);
    } finally {
      setDrawing(false);
    }
  };

  const startSession = async ({ isFree = false, date } = {}) => {
    if (data?.activeSession && !date) {
      navigate(`/studie/pass/${data.activeSession.id}`);
      return;
    }
    setStarting(true);
    try {
      const session = await studyAPI.createSession({
        is_free: isFree,
        date,
        challenge_card_id: card?.id || null,
      });
      writeLocal(CARD_KEY, null);
      navigate(`/studie/pass/${session.id}`);
    } catch (err) {
      toast.error('Kunde inte skapa passet', err.message);
      setStarting(false);
    }
  };

  const toggleGate = async (index, checked) => {
    const blockId = data.gate.blockId;
    const optimistic = checked ? data.gate.checked.filter((i) => i !== index) : [...data.gate.checked, index];
    setData((d) => ({ ...d, gate: { ...d.gate, checked: optimistic } }));
    try {
      const res = checked ? await studyAPI.uncheckGate(blockId, index) : await studyAPI.checkGate(blockId, index);
      setData((d) => ({ ...d, gate: { ...d.gate, checked: res.checked } }));
    } catch (err) {
      toast.error('Kunde inte spara grinden', err.message);
      load();
    }
  };

  if (error) {
    return (
      <div className="study">
        <div className="error" role="alert">{error}</div>
        <button type="button" className="btn btn-secondary" onClick={load}>Försök igen</button>
      </div>
    );
  }
  if (!data) return <PageSkeleton rows={5} label="Hämtar dagens pass" />;

  const { progress, activeSession, lastSession, shelf, gate, blockCards, betweenSessions } = data;
  const block = progress.block;
  const entry = progress.weekEntry;
  const theme = blockTheme(block?.name);
  const firstThrown = shelf.toTrim.reduce((min, p) => (!min || (p.thrown_date && p.thrown_date < min) ? p.thrown_date : min), null);

  return (
    <div className="study" style={blockStyle(block?.order)}>
      <div className="study-hero">
        <div className="study-hero-text">
          <span className="study-eyebrow">
            {shortBlockName(block?.name)} · vecka {progress.weekInBlock} av {progress.blockLength}
          </span>
          <h1 className="study-title">{theme || block?.name}</h1>
          <p className="study-year">
            {progress.finished ? 'Årets plan är genomförd' : `Pass ${progress.week} av ${progress.totalWeeks}`}
            <Link to="/studie/plan" className="study-hero-link">
              Planen <ArrowRight size={13} />
            </Link>
          </p>
        </div>
        <ProgressRing value={progress.doneInBlock} max={progress.blockLength} label={`${progress.doneInBlock} av ${progress.blockLength} pass i blocket`} />
      </div>

      {lastSession && (
        <section className="study-quote">
          <Quote size={18} className="study-quote-mark" aria-hidden="true" />
          <span className="study-quote-label">Förra gången · {formatDay(lastSession.date)}</span>
          <p className="study-quote-text">{lastSession.goal || 'Inget delmål skrevs.'}</p>
          <Link to={`/studie/pass/${lastSession.id}`} className="study-quote-link">{sessionTitle(lastSession)}</Link>
        </section>
      )}

      <section className="study-card study-week">
        <div className="study-week-item">
          <span className="study-label">Veckans huvudpass</span>
          <p className="study-week-main">{entry?.main || 'Fri form.'}</p>
        </div>
        {entry?.finish && (
          <div className="study-week-item">
            <span className="study-label">Finish</span>
            <p>{entry.finish}</p>
          </div>
        )}
      </section>

      {(shelf.toTrim.length > 0 || shelf.toGlaze.length > 0) && (
        <section className="study-section">
          <h2 className="study-h2">Gods på hyllan</h2>
          <ul className="shelf">
            <ShelfRow icon={Hammer} title="Att svarva" pieces={shelf.toTrim} dateLabel={firstThrown ? `drejade ${formatDay(firstThrown)}` : ''} />
            <ShelfRow icon={Paintbrush} title="Att glasera" pieces={shelf.toGlaze} dateLabel="skröjbrända" />
          </ul>
        </section>
      )}

      <section className="study-start">
        <button type="button" className="btn btn-primary study-start-btn" onClick={() => startSession()} disabled={starting}>
          <Play size={20} />
          {activeSession ? `Fortsätt ${sessionTitle(activeSession).toLowerCase()}` : starting ? 'Förbereder…' : 'Starta passet'}
        </button>
        {card && !activeSession && <p className="study-start-note">Kortet "{card.name}" följer med passet.</p>}
        <div className="study-start-alt">
          <button type="button" className="link-btn" onClick={() => startSession({ isFree: true })} disabled={starting || !!activeSession}>
            <Feather size={14} /> Fritt pass
          </button>
          <button type="button" className="link-btn" onClick={() => setLateOpen(true)}>
            <CalendarPlus size={14} /> Logga ett pass i efterhand
          </button>
        </div>
        <p className="study-muted study-start-hint">Ett fritt pass räknas inte upp veckan.</p>
      </section>

      {gate && gate.items.length > 0 && (
        <section className="study-section">
          <h2 className="study-h2">Blockets grind</h2>
          <ul className="gate-list">
            {gate.items.map((text, i) => {
              const checked = gate.checked.includes(i);
              return (
                <li key={i}>
                  <button type="button" className={`gate-item${checked ? ' is-checked' : ''}`} onClick={() => toggleGate(i, checked)} aria-pressed={checked}>
                    <span className="gate-box" aria-hidden="true">{checked && <Check size={16} />}</span>
                    <span>{text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="study-section">
        <h2 className="study-h2">Utmaningskort</h2>
        <ChallengeCard
          card={card}
          drawing={drawing}
          onDraw={() => drawCard(block?.id)}
          deckLabel={blockCards.length ? `${shortBlockName(block?.name)}s lek · ${blockCards.length} kort` : 'Hela leken'}
          onPin={
            activeSession
              ? async () => {
                  try {
                    await studyAPI.updateSession(activeSession.id, { challenge_card_id: card.id });
                    toast.success('Kortet är fäst vid passet');
                  } catch (err) {
                    toast.error('Kunde inte fästa kortet', err.message);
                  }
                }
              : undefined
          }
        />
        {card && (
          <button type="button" className="link-btn study-deck-all" onClick={() => drawCard('all')} disabled={drawing}>
            Dra ur hela leken i stället
          </button>
        )}
      </section>

      {(betweenSessions || progress.nextWeekEntry) && (
        <section className="study-section study-next">
          <h2 className="study-h2">Inför nästa pass</h2>
          {betweenSessions && <p>{betweenSessions}</p>}
          {progress.nextWeekEntry && (
            <p className="study-next-week">
              <BookOpen size={14} aria-hidden="true" />
              <span>
                <strong>Vecka {progress.nextWeek}{progress.nextBlock ? `, ${shortBlockName(progress.nextBlock.name)}` : ''}:</strong>{' '}
                {progress.nextWeekEntry.main}
              </span>
            </p>
          )}
        </section>
      )}

      <Sheet open={lateOpen} onOpenChange={setLateOpen}>
        <SheetContent
          title="Logga ett pass i efterhand"
          description="Passet får det datum du väljer. Koppla alster och spara sedan passet."
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setLateOpen(false)}>Avbryt</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!lateDate || starting}
                onClick={() => startSession({ date: lateDate, isFree: lateFree })}
              >
                Fortsätt
              </button>
            </>
          }
        >
          <div className="study-form">
            <label className="field">
              <span className="field-sublabel">Datum</span>
              <input type="date" className="field-input field-input--lg" value={lateDate} max={todayIso()} onChange={(e) => setLateDate(e.target.value)} />
            </label>
            <label className="study-check">
              <input type="checkbox" checked={lateFree} onChange={(e) => setLateFree(e.target.checked)} />
              <span>Fritt pass (räknas inte upp veckan)</span>
            </label>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default StudyToday;
