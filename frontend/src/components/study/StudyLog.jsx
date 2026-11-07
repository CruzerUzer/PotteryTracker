import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Plus, Trash2 } from 'lucide-react';
import { studyAPI } from '../../services/api';
import { useToast } from '../ui/toast';
import PageSkeleton from '../PageSkeleton';
import MetricTrend from './MetricTrend';
import { blockStyle, formatDay, sessionTitle, shortBlockName } from './studyUtils';
import '../../styles/study.css';

const TABS = [
  { id: 'sessions', label: 'Pass' },
  { id: 'metrics', label: 'Mått' },
  { id: 'reviews', label: 'Utvärderingar' },
];

function SessionCard({ s, blocks }) {
  const order = blocks.find((b) => b.id === s.plan_block_id)?.order ?? 0;
  const log = s.log || {};
  return (
    <li>
      <Link to={`/studie/pass/${s.id}`} className="log-card" style={blockStyle(order)}>
        <div className="log-card-head">
          <span className="log-card-date">{formatDay(s.date, { weekday: 'short' })}</span>
          <span className="log-card-title">{sessionTitle(s)}</span>
          {s.block_name && <span className="log-card-block">{shortBlockName(s.block_name)}</span>}
        </div>
        {s.images?.[0] && (
          <img className="log-card-img" src={studyAPI.sessionImageUrl(s.images[0].id, true)} alt="" loading="lazy" />
        )}
        <div className="log-card-lines">
          {log.goal_and_measure && <p><span>Mått</span>{log.goal_and_measure}</p>}
          {log.observation && <p><span>Sett</span>{log.observation}</p>}
          {log.change && <p className="log-card-change"><span>Ändra</span>{log.change}</p>}
          {!s.log && <p className="study-muted">Ingen loggbok skriven.</p>}
        </div>
        <div className="log-card-foot">
          {s.pieces?.length > 0 && <span>{s.pieces.length} alster</span>}
          {s.series?.map((x) => <span key={x.number} className="series-mark">Märk: S{x.number}</span>)}
          {s.challenge_card_name && <span>Kort: {s.challenge_card_name}</span>}
        </div>
      </Link>
    </li>
  );
}

function MetricsTab() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [metricId, setMetricId] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => studyAPI.getMetrics().then((d) => {
    setData(d);
    setMetricId((m) => m || d.defs[0]?.id || '');
  }).catch((err) => toast.error('Kunde inte hämta måtten', err.message)), [toast]);
  useEffect(() => { load(); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await studyAPI.createMetric({ metric_id: metricId, value });
      setValue('');
      await load();
      toast.success('Måttet är sparat');
    } catch (err) {
      toast.error('Kunde inte spara måttet', err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await studyAPI.deleteMetric(id);
      await load();
    } catch (err) {
      toast.error('Kunde inte ta bort måttet', err.message);
    }
  };

  if (!data) return <PageSkeleton rows={3} title={false} />;
  const def = data.defs.find((d) => d.id === metricId);
  return (
    <div className="study-section">
      <form className="metric-form" onSubmit={add}>
        <select className="field-input" value={metricId} onChange={(e) => setMetricId(e.target.value)} aria-label="Mått">
          {data.defs.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.unit})</option>)}
        </select>
        <input className="field-input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)}
          placeholder={def?.unit || 'Värde'} aria-label="Värde" />
        <button type="submit" className="btn btn-primary" disabled={saving || !value}>
          <Plus size={16} /> Lägg till
        </button>
      </form>
      {def?.how && <p className="study-muted">{def.how}</p>}

      <div className="trend-grid">
        {data.defs.map((d) => {
          const values = data.metrics.filter((m) => m.metric_id === d.id);
          return (
            <div key={d.id} className="trend-cell">
              <MetricTrend def={d} values={values} blocks={data.blocks} />
              {values.length > 0 && (
                <details className="trend-table">
                  <summary>Visa värdena</summary>
                  <table>
                    <thead><tr><th>Datum</th><th>Block</th><th>Värde</th><th aria-label="Ta bort" /></tr></thead>
                    <tbody>
                      {values.map((v) => (
                        <tr key={v.id}>
                          <td>{formatDay(v.measured_at)}</td>
                          <td>{shortBlockName(data.blocks.find((b) => b.id === v.plan_block_id)?.name || '')}</td>
                          <td>{v.value} {d.unit}</td>
                          <td>
                            <button type="button" className="icon-btn icon-btn--ghost" onClick={() => remove(v.id)} aria-label="Ta bort värdet">
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewsTab({ blocks }) {
  const [data, setData] = useState(null);
  const [plan, setPlan] = useState(null);
  useEffect(() => {
    Promise.all([studyAPI.getReviews(), studyAPI.getPlan()]).then(([r, p]) => {
      setData(r);
      setPlan(p.plan);
    }).catch(() => setData({ reviews: [], due: null }));
  }, []);
  if (!data) return <PageSkeleton rows={2} title={false} />;
  const questions = plan?.logbook?.blockReview?.questions || [];
  return (
    <div className="study-section">
      {data.due && (
        <Link to={`/studie/utvardering/${data.due.blockId}`} className="review-due" style={blockStyle(data.due.order)}>
          <span className="study-eyebrow">{shortBlockName(data.due.name)} avklarat</span>
          <span className="review-due-title">Gör blockutvärderingen</span>
        </Link>
      )}
      {data.reviews.length === 0 && !data.due && <p className="study-muted">Inga blockutvärderingar ännu. Den första kommer när Återstart är avklarad.</p>}
      <ul className="log-list">
        {data.reviews.map((r) => {
          const block = blocks.find((b) => b.id === r.plan_block_id);
          return (
            <li key={r.id} className="study-card review-card" style={blockStyle(block?.order ?? 0)}>
              <span className="study-eyebrow">{block?.name || r.plan_block_id} · {formatDay(r.created_at)}</span>
              {r.answers.map((a, i) => a ? (
                <div key={i} className="review-answer">
                  <span className="review-q">{questions[i] || `Fråga ${i + 1}`}</span>
                  <p>{a}</p>
                </div>
              ) : null)}
              {r.next_goals && (
                <div className="review-answer">
                  <span className="review-q">Nästa blocks delmål</span>
                  <p>{r.next_goals}</p>
                </div>
              )}
              {r.new_card_id && <p className="study-muted">Nytt utmaningskort i leken.</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StudyLog() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('sessions');
  const [block, setBlock] = useState('');
  const [sessions, setSessions] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    studyAPI.getPlan().then((p) => setBlocks([...p.plan.phases].sort((a, b) => a.order - b.order))).catch(() => {});
  }, []);
  useEffect(() => {
    setSessions(null);
    studyAPI.listLog(block).then(setSessions).catch((err) => setError(err.message));
  }, [block]);

  const counted = useMemo(() => (sessions || []).filter((s) => !s.is_free).length, [sessions]);

  return (
    <div className="study study-log">
      <div className="detail-topbar">
        <button type="button" className="icon-btn" onClick={() => navigate('/studie')} aria-label="Till Idag">
          <ArrowLeft size={19} />
        </button>
        <div className="log-export">
          <a className="btn btn-secondary" href={studyAPI.exportUrl('md')} download>
            <Download size={15} /> Markdown
          </a>
          <a className="btn btn-secondary" href={studyAPI.exportUrl('csv')} download>
            <Download size={15} /> CSV
          </a>
        </div>
      </div>
      <div className="session-head">
        <span className="study-eyebrow">{sessions ? `${counted} pass${block ? ' i blocket' : ''}` : 'Studie'}</span>
        <h1 className="study-title">Loggboken</h1>
      </div>

      <div className="segmented study-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
            className={`segmented-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      {tab === 'sessions' && (
        <>
          <div className="chip-scroller">
            <div className="chip-row chip-row--nowrap">
              <button type="button" className={`chip${!block ? ' chip--active' : ''}`} onClick={() => setBlock('')}>Alla</button>
              {blocks.map((b) => (
                <button key={b.id} type="button" className={`chip${block === b.id ? ' chip--active' : ''}`} onClick={() => setBlock(b.id)}>
                  {shortBlockName(b.name)}
                </button>
              ))}
            </div>
          </div>
          {!sessions ? (
            <PageSkeleton rows={3} title={false} />
          ) : sessions.length === 0 ? (
            <p className="study-muted">Inga avslutade pass {block ? 'i blocket ' : ''}ännu.</p>
          ) : (
            <ul className="log-list">
              {sessions.map((s) => <SessionCard key={s.id} s={s} blocks={blocks} />)}
            </ul>
          )}
        </>
      )}
      {tab === 'metrics' && <MetricsTab />}
      {tab === 'reviews' && <ReviewsTab blocks={blocks} />}
    </div>
  );
}

export default StudyLog;
