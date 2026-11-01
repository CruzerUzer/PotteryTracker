import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ChevronDown, Disc3 } from 'lucide-react';
import { phasesAPI, studyAPI } from '../../services/api';
import { useToast } from '../ui/toast';
import PageSkeleton from '../PageSkeleton';
import Markdown from './Markdown';
import { blockStyle, shortBlockName, blockTheme, minutesLabel } from './studyUtils';
import '../../styles/study.css';

const TABS = [
  { id: 'plan', label: 'Planen' },
  { id: 'about', label: 'Om planen' },
  { id: 'firing', label: 'Bränningsflöde' },
];

function weekLabel(w) {
  return w.weekFrom === w.weekTo ? `v. ${w.weekFrom}` : `v. ${w.weekFrom}–${w.weekTo}`;
}

function BlockChapter({ block, current, week, cards, checked, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const theme = blockTheme(block.name);
  const isPast = week > block.weekTo;
  return (
    <li className={`chapter${current ? ' is-current' : ''}${isPast ? ' is-past' : ''}`} style={blockStyle(block.order)}>
      <span className="chapter-dot" aria-hidden="true" />
      <button type="button" className="chapter-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="chapter-title">
          <span className="chapter-name">{shortBlockName(block.name)}</span>
          {theme && <span className="chapter-theme">{theme}</span>}
        </span>
        <span className="chapter-weeks">v. {block.weekFrom}–{block.weekTo}</span>
        <ChevronDown size={16} className={`shelf-chevron${open ? ' is-open' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="chapter-body">
          {block.themeTechnical && <p><strong>Tekniskt:</strong> {block.themeTechnical}</p>}
          {block.themeCreative && <p><strong>Kreativt:</strong> {block.themeCreative}</p>}
          <ol className="chapter-weeks-list">
            {block.weeks.map((w) => {
              const here = current && week >= w.weekFrom && week <= w.weekTo;
              return (
                <li key={w.weekFrom} className={`week-row${here ? ' is-here' : ''}`}>
                  <span className="week-num">{weekLabel(w)}{here && <span className="week-here">nu</span>}</span>
                  <div className="week-text">
                    <p>{w.main}</p>
                    {w.finish && <p className="week-finish"><span>Finish:</span> {w.finish}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
          {block.gate?.length > 0 && (
            <>
              <h4 className="chapter-sub">Grind</h4>
              <ul className="chapter-gate">
                {block.gate.map((g, i) => (
                  <li key={i} className={checked.includes(i) ? 'is-checked' : ''}>
                    <span className="gate-box gate-box--sm" aria-hidden="true">{checked.includes(i) && <Check size={12} />}</span>
                    {g}
                  </li>
                ))}
              </ul>
            </>
          )}
          {cards.length > 0 && (
            <>
              <h4 className="chapter-sub">Lek</h4>
              <div className="chip-row">
                {cards.map((c) => (
                  <span key={c.id} className="chip chip--static" title={c.how}>{c.name}</span>
                ))}
              </div>
            </>
          )}
          {block.safety && <p className="chapter-safety">{block.safety}</p>}
        </div>
      )}
    </li>
  );
}

function FiringTab({ plan }) {
  const toast = useToast();
  const [phases, setPhases] = useState([]);
  const [map, setMap] = useState(null);

  useEffect(() => {
    Promise.all([phasesAPI.getAll(), studyAPI.getStageMap()])
      .then(([p, m]) => {
        setPhases([...p].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)));
        setMap(m.map);
      })
      .catch((err) => toast.error('Kunde inte hämta mappningen', err.message));
  }, [toast]);

  const save = async (stage, value) => {
    setMap((m) => ({ ...m, [stage]: value ? Number(value) : null }));
    try {
      const res = await studyAPI.updateStageMap({ [stage]: value ? Number(value) : null });
      setMap(res.map);
      toast.success('Mappningen är sparad');
    } catch (err) {
      toast.error('Kunde inte spara', err.message);
    }
  };

  const pipeline = plan.firingPipeline;
  return (
    <div className="study-section">
      {pipeline.description && <p className="study-lead">{pipeline.description}</p>}
      <p className="study-muted">
        Välj vilken av dina faser varje steg motsvarar. Appen använder det för gods på hyllan och för att föreslå
        fasbyten. Den flyttar aldrig något själv.
      </p>
      {!map ? (
        <PageSkeleton rows={3} title={false} />
      ) : (
        <ol className="stage-list">
          {pipeline.stages.map((st) => (
            <li key={st.id} className="stage-row">
              <div className="stage-text">
                <span className="stage-week">Vecka {st.week}</span>
                <span className="stage-name">{st.name}</span>
                {st.action && <span className="stage-action">{st.action}</span>}
              </div>
              <select className="field-input stage-select" value={map[st.id] ?? ''} onChange={(e) => save(st.id, e.target.value)} aria-label={`Fas för ${st.name}`}>
                <option value="">Ingen fas</option>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </li>
          ))}
        </ol>
      )}
      {pipeline.labeling && <p className="study-muted">{pipeline.labeling}</p>}
    </div>
  );
}

function StudyPlan() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('plan');
  const [data, setData] = useState(null);
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    studyAPI.getPlan().then(setData).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (tab === 'about' && doc === null) {
      studyAPI.getPlanDocument().then((d) => setDoc(d.markdown)).catch((err) => setError(err.message));
    }
  }, [tab, doc]);

  if (error) return <div className="study"><div className="error" role="alert">{error}</div></div>;
  if (!data) return <PageSkeleton rows={5} label="Hämtar planen" />;

  const { plan, progress, gateChecks } = data;
  const cardsById = Object.fromEntries((plan.challengeCards || []).map((c) => [c.id, c]));
  const blocks = [...plan.phases].sort((a, b) => a.order - b.order);
  const template = plan.sessionTemplate;

  return (
    <div className="study study-plan">
      <div className="detail-topbar">
        <button type="button" className="icon-btn" onClick={() => navigate('/studie')} aria-label="Till Idag">
          <ArrowLeft size={19} />
        </button>
      </div>
      <div className="session-head">
        <span className="study-eyebrow">Version {data.version} · pass {progress.week} av {progress.totalWeeks}</span>
        <h1 className="study-title">Planen</h1>
      </div>

      <div className="segmented study-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
            className={`segmented-item ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'plan' && (
        <>
          <ol className="timeline">
            {blocks.map((b) => (
              <BlockChapter
                key={b.id}
                block={b}
                week={progress.week}
                current={progress.block?.id === b.id}
                defaultOpen={progress.block?.id === b.id}
                cards={(b.playCards || []).map((id) => cardsById[id]).filter(Boolean)}
                checked={gateChecks[b.id] || []}
              />
            ))}
          </ol>

          <section className="study-section">
            <div className="study-section-head">
              <h2 className="study-h2">Passmallen</h2>
              <span className="study-muted">{minutesLabel(template.totalMinutes)}</span>
            </div>
            <ol className="segment-list">
              {template.segments.map((s) => (
                <li key={s.id} className="segment-row">
                  <div className="segment-text">
                    <span className="segment-name">
                      {s.wheel && <Disc3 size={14} className="segment-wheel" aria-label="På skivan" />}
                      {s.name}
                    </span>
                    <span className="segment-desc">{s.description}</span>
                  </div>
                  <span className="segment-min">{s.toMinute - s.fromMinute} min</span>
                </li>
              ))}
            </ol>
            {template.whenShort && <p className="study-muted"><strong>Om tiden är knapp:</strong> {template.whenShort}</p>}
          </section>

          {plan.rules?.length > 0 && (
            <section className="study-section">
              <h2 className="study-h2">Regler</h2>
              <ul className="study-rules">
                {plan.rules.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </section>
          )}
        </>
      )}

      {tab === 'about' && (doc === null ? <PageSkeleton rows={6} title={false} /> : <Markdown source={doc} skipTitle />)}

      {tab === 'firing' && <FiringTab plan={plan} />}
    </div>
  );
}

export default StudyPlan;
