import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FlaskConical, Plus } from 'lucide-react';
import { studyAPI } from '../../services/api';
import PageSkeleton from '../PageSkeleton';
import { GlazeTestForm, RecipeForm, METHOD_LABEL } from './GlazeForms';
import { formatDay, sessionTitle } from './studyUtils';
import '../../styles/study.css';

const TABS = [
  { id: 'tests', label: 'Provplattor' },
  { id: 'recipes', label: 'Recept' },
];

export function GlazeTile({ t, onOpen }) {
  const glaze = t.recipe_name || t.glaze_name || 'Okänd glasyr';
  const how = [
    t.method ? METHOD_LABEL[t.method] : null,
    t.method === 'dip' && t.dip_seconds ? `${String(t.dip_seconds).replace('.', ',')} s` : null,
    t.coats ? `${t.coats} lager` : null,
  ].filter(Boolean).join(' · ');
  return (
    <li>
      <button type="button" className="tile-card" onClick={() => onOpen(t.id)}>
        <span className="tile-thumb">
          {t.image_id ? <img src={studyAPI.glazeImageUrl(t.image_id, true)} alt="" loading="lazy" /> : <FlaskConical size={22} aria-hidden="true" />}
          <span className="tile-code">{t.tile_code}</span>
        </span>
        <span className="tile-text">
          <span className="tile-glaze">{glaze}{t.layering ? ` · ${t.layering}` : ''}</span>
          <span className="tile-meta">{[t.clay_name, how, t.firing].filter(Boolean).join(' · ') || 'Inga detaljer'}</span>
          {t.result && <span className="tile-result">{t.result}</span>}
          {t.session_date && (
            <span className="tile-meta">{formatDay(t.session_date)} · {sessionTitle({ is_free: t.session_is_free, week_number: t.session_week })}</span>
          )}
        </span>
      </button>
    </li>
  );
}

function StudyGlaze() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('tests');
  const [tests, setTests] = useState(null);
  const [recipes, setRecipes] = useState(null);
  const [testForm, setTestForm] = useState(null); // { id } | { id: null }
  const [recipeForm, setRecipeForm] = useState(null); // { recipe } | { recipe: null }
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    studyAPI.listGlazeTests().then(setTests).catch((err) => setError(err.message));
    studyAPI.listRecipes().then(setRecipes).catch((err) => setError(err.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="study study-glaze">
      <div className="detail-topbar">
        <button type="button" className="icon-btn" onClick={() => navigate('/studie')} aria-label="Till Idag">
          <ArrowLeft size={19} />
        </button>
        <button type="button" className="btn btn-primary" onClick={() => (tab === 'tests' ? setTestForm({ id: null }) : setRecipeForm({ recipe: null }))}>
          <Plus size={16} /> {tab === 'tests' ? 'Ny provplatta' : 'Nytt recept'}
        </button>
      </div>
      <div className="session-head">
        <span className="study-eyebrow">{tests ? `${tests.length} ${tests.length === 1 ? 'provplatta' : 'provplattor'}` : 'Studie'}</span>
        <h1 className="study-title">Glasyrloggen</h1>
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

      {tab === 'tests' && (!tests ? <PageSkeleton rows={3} title={false} /> : tests.length === 0 ? (
        <p className="study-muted">Inga provplattor ännu. Varje pass kan ge tre: kod, glasyr, dopptid och resultat.</p>
      ) : (
        <ul className="tile-list">{tests.map((t) => <GlazeTile key={t.id} t={t} onOpen={(id) => setTestForm({ id })} />)}</ul>
      ))}

      {tab === 'recipes' && (!recipes ? <PageSkeleton rows={2} title={false} /> : recipes.length === 0 ? (
        <p className="study-muted">Inga egna recept ännu. Den första egna glasyren kommer i Block 3.</p>
      ) : (
        <ul className="log-list">
          {recipes.map((r) => {
            const sum = r.ingredients.reduce((s, x) => s + x.percent, 0);
            return (
              <li key={r.id}>
                <button type="button" className="recipe-card" onClick={() => setRecipeForm({ recipe: r })}>
                  <span className="recipe-card-head">
                    <span className="tile-glaze">{r.name}</span>
                    {r.cone && <span className="tile-meta">Kon {r.cone}</span>}
                  </span>
                  <span className="tile-meta">{r.ingredients.map((x) => `${x.material} ${String(x.percent).replace('.', ',')}`).join(' · ')}{r.ingredients.length ? ` (${Math.round(sum * 10) / 10} %)` : ''}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ))}

      <GlazeTestForm open={!!testForm} onOpenChange={(o) => !o && setTestForm(null)} testId={testForm?.id || null} onSaved={load} />
      <RecipeForm open={!!recipeForm} onOpenChange={(o) => !o && setRecipeForm(null)} recipe={recipeForm?.recipe || null} onSaved={load} />
    </div>
  );
}

export default StudyGlaze;
