import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { imagesAPI, studyAPI } from '../../services/api';
import { useToast } from '../ui/toast';
import PageSkeleton from '../PageSkeleton';
import MetricTrend from './MetricTrend';
import { blockStyle, shortBlockName } from './studyUtils';
import '../../styles/study.css';

/**
 * Blockutvärderingen som avslutning: "Block 1 avklarat", foton från blockets
 * alster, måttens trend och sedan de fem frågorna. Fråga 3 kan bli ett nytt kort.
 */
function BlockReview() {
  const { blockId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [ctx, setCtx] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState(['', '', '', '', '']);
  const [nextGoals, setNextGoals] = useState('');
  const [makeCard, setMakeCard] = useState(false);
  const [card, setCard] = useState({ name: '', how: '', trains: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([studyAPI.getReviewContext(blockId), studyAPI.getMetrics()])
      .then(([c, m]) => {
        setCtx(c);
        setBlocks(m.blocks);
        setAnswers(c.questions.map(() => ''));
      })
      .catch((err) => setError(err.message));
  }, [blockId]);

  const setAnswer = (i, v) => setAnswers((a) => a.map((x, j) => (j === i ? v : x)));

  const toggleCard = () => {
    setMakeCard((v) => {
      if (!v && !card.how && answers[2]) setCard((c) => ({ ...c, how: `Träna bort: ${answers[2]}` }));
      return !v;
    });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await studyAPI.createReview({
        plan_block_id: blockId,
        answers,
        next_goals: nextGoals,
        new_card: makeCard ? card : null,
      });
      toast.success('Utvärderingen är sparad', makeCard ? `Kortet "${card.name}" ligger i leken.` : undefined);
      navigate('/studie', { replace: true });
    } catch (err) {
      toast.error('Kunde inte spara utvärderingen', err.message);
      setSaving(false);
    }
  };

  if (error) return <div className="study"><div className="error" role="alert">{error}</div></div>;
  if (!ctx) return <PageSkeleton rows={5} label="Hämtar blocket" />;

  const { block } = ctx;
  const withValues = ctx.metricDefs.filter((d) => ctx.metrics.some((m) => m.metric_id === d.id));

  return (
    <div className="study study-review" style={blockStyle(block.order)}>
      <div className="detail-topbar">
        <button type="button" className="icon-btn" onClick={() => navigate(-1)} aria-label="Tillbaka">
          <ArrowLeft size={19} />
        </button>
      </div>

      <div className="review-hero">
        <Sparkles size={28} className="review-hero-mark" aria-hidden="true" />
        <span className="study-eyebrow">Vecka {block.weekFrom}–{block.weekTo}</span>
        <h1 className="review-hero-title">{shortBlockName(block.name)} avklarat</h1>
        <p className="review-hero-stats">
          {ctx.sessionCount} pass · {ctx.pieceCount} alster{ctx.gallery.length ? ` · ${ctx.gallery.length} ${ctx.gallery.length === 1 ? 'foto' : 'foton'}` : ''}
        </p>
        {ctx.lastChange && <p className="review-hero-quote">Senaste förändringen: {ctx.lastChange}</p>}
      </div>

      {ctx.gallery.length > 0 && (
        <section className="study-section">
          <h2 className="study-h2">Blockets alster</h2>
          <div className="review-gallery">
            {ctx.gallery.slice(0, 24).map((g) => (
              <figure key={`${g.kind}-${g.id}`} className="review-photo">
                <img src={g.kind === 'session' ? studyAPI.sessionImageUrl(g.id, true) : imagesAPI.getFileUrl(g.id, true)} alt={g.name || ''} loading="lazy" />
                {g.name && <figcaption>{g.name}</figcaption>}
              </figure>
            ))}
          </div>
        </section>
      )}

      {withValues.length > 0 && (
        <section className="study-section">
          <h2 className="study-h2">Måtten</h2>
          <div className="trend-grid">
            {withValues.map((d) => (
              <div key={d.id} className="trend-cell">
                <MetricTrend def={d} values={ctx.metrics.filter((m) => m.metric_id === d.id)} blocks={blocks} />
              </div>
            ))}
          </div>
        </section>
      )}

      <form className="study-section review-form" onSubmit={save}>
        <h2 className="study-h2">Fem frågor</h2>
        {ctx.questions.map((q, i) => (
          <label key={q} className="field review-question">
            <span className="logbook-label"><span className="logbook-num">{i + 1}</span> {q}</span>
            <textarea className="field-input" rows={3} value={answers[i] || ''} onChange={(e) => setAnswer(i, e.target.value)} />
            {i === 2 && (
              <button type="button" className={`chip${makeCard ? ' chip--active' : ''} review-card-toggle`} onClick={toggleCard} aria-pressed={makeCard}>
                <Sparkles size={14} /> Gör ett utmaningskort av felet
              </button>
            )}
            {i === 2 && makeCard && (
              <div className="review-newcard">
                <input className="field-input" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} placeholder="Kortets namn, t.ex. Tunn botten" maxLength={60} />
                <textarea className="field-input" rows={2} value={card.how} onChange={(e) => setCard({ ...card, how: e.target.value })} placeholder="Hur kortet spelas" />
                <input className="field-input" value={card.trains} onChange={(e) => setCard({ ...card, trains: e.target.value })} placeholder="Tränar (valfritt)" />
                <span className="field-hint">Kortet läggs i leken{ctx.nextBlock ? ` och i ${shortBlockName(ctx.nextBlock.name)}s lek` : ''}.</span>
              </div>
            )}
          </label>
        ))}
        <label className="field review-question">
          <span className="logbook-label">Nästa blocks delmål</span>
          {ctx.nextBlock && <span className="logbook-prompt">{ctx.nextBlock.name}: {ctx.nextBlock.themeTechnical}</span>}
          <textarea className="field-input" rows={3} value={nextGoals} onChange={(e) => setNextGoals(e.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary study-start-btn" disabled={saving}>
          {saving ? 'Sparar…' : 'Spara utvärderingen'}
        </button>
      </form>
    </div>
  );
}

export default BlockReview;
