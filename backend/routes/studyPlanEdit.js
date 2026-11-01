/**
 * Studie modul 5: versionerad plan, manuell redigering och filversioner.
 * Varje sparad ändring blir en revision. Inget byts ut utan att användaren
 * väljer det. AI-redigeringen (author 'ai') byggs senare; ai_prompt finns.
 */
import express from 'express';
import { getDb } from '../utils/db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireStudy } from '../middleware/study.js';
import logger from '../utils/logger.js';
import { loadPlanFile, validatePlan, fileUpdateInfo } from '../utils/studyPlan.js';
import { getOrSeedPlan, handle } from './study.js';

const router = express.Router();
router.use(requireAuth);
router.use(requireStudy);

const SUMMARY_MAX = 300;

/**
 * Sparar planen och en revision. Planradens version är filversionen den
 * bygger på; den ändras bara när en fil hämtas eller en version återställs.
 */
async function saveRevision(db, planRow, userId, plan, author, summary, { setVersion = false } = {}) {
  const json = JSON.stringify(plan);
  await db.run(
    "UPDATE study_plans SET json = ?, title = ?, version = ?, updated_at = datetime('now') WHERE id = ?",
    [json, plan.title, setVersion ? plan.version : planRow.version, planRow.id]
  );
  const r = await db.run(
    'INSERT INTO study_plan_revisions (plan_id, user_id, author, summary, snapshot) VALUES (?, ?, ?, ?, ?)',
    [planRow.id, userId, author, summary, json]
  );
  logger.info('Study plan revision saved', { userId, planId: planRow.id, author, revisionId: r.lastID });
  return r.lastID;
}

router.get('/plan/file-version', handle('jämföra planversionerna', async (req, res) => {
  const db = await getDb();
  const planRow = await getOrSeedPlan(db, req.userId);
  res.json(fileUpdateInfo(planRow));
}));

router.post('/plan/adopt-file', handle('hämta planfilen', async (req, res) => {
  const db = await getDb();
  const planRow = await getOrSeedPlan(db, req.userId);
  const file = loadPlanFile();
  const { valid, errors } = validatePlan(file);
  if (!valid) return res.status(500).json({ error: `Planfilen är ogiltig: ${errors[0]}` });
  const info = fileUpdateInfo(planRow);
  const summary = `Planen v${file.version} hämtad från filen${info.summary ? `: ${info.summary}` : ''}`.slice(0, SUMMARY_MAX);
  const revisionId = await saveRevision(db, planRow, req.userId, file, 'file', summary, { setVersion: true });
  res.json({ revisionId, version: file.version });
}));

router.get('/plan/revisions', handle('hämta versionerna', async (req, res) => {
  const db = await getDb();
  const planRow = await getOrSeedPlan(db, req.userId);
  const rows = await db.all(
    'SELECT id, created_at, author, summary FROM study_plan_revisions WHERE plan_id = ? AND user_id = ? ORDER BY id DESC',
    [planRow.id, req.userId]
  );
  res.json({ revisions: rows, current: rows[0]?.id || null });
}));

router.get('/plan/revisions/:revId', handle('hämta versionen', async (req, res) => {
  const db = await getDb();
  const planRow = await getOrSeedPlan(db, req.userId);
  const rev = await db.get(
    'SELECT * FROM study_plan_revisions WHERE id = ? AND plan_id = ? AND user_id = ?',
    [req.params.revId, planRow.id, req.userId]
  );
  if (!rev) return res.status(404).json({ error: 'Versionen hittades inte' });
  res.json({ ...rev, snapshot: JSON.parse(rev.snapshot) });
}));

/** Spara en manuellt redigerad plan. Valideras mot schemat innan sparning. */
router.put('/plan', handle('spara planen', async (req, res) => {
  const { plan, summary } = req.body || {};
  if (!plan || typeof plan !== 'object') return res.status(400).json({ error: 'Planen saknas' });
  const db = await getDb();
  const planRow = await getOrSeedPlan(db, req.userId);
  // Filversionen och id:t ändras bara via filen
  const next = { ...plan, id: planRow.plan.id, version: planRow.plan.version };
  const { valid, errors } = validatePlan(next);
  if (!valid) return res.status(400).json({ error: 'Planen är inte giltig', errors });
  const text = typeof summary === 'string' && summary.trim() ? summary.trim().slice(0, SUMMARY_MAX) : 'Planen ändrad';
  const revisionId = await saveRevision(db, planRow, req.userId, next, 'user', text);
  res.json({ revisionId, plan: next });
}));

router.post('/plan/revisions/:revId/restore', handle('återställa versionen', async (req, res) => {
  const db = await getDb();
  const planRow = await getOrSeedPlan(db, req.userId);
  const rev = await db.get(
    'SELECT * FROM study_plan_revisions WHERE id = ? AND plan_id = ? AND user_id = ?',
    [req.params.revId, planRow.id, req.userId]
  );
  if (!rev) return res.status(404).json({ error: 'Versionen hittades inte' });
  const snapshot = JSON.parse(rev.snapshot);
  const { valid, errors } = validatePlan(snapshot);
  if (!valid) return res.status(400).json({ error: `Versionen är inte giltig längre: ${errors[0]}` });
  const date = String(rev.created_at).slice(0, 10);
  const revisionId = await saveRevision(db, planRow, req.userId, snapshot, 'user',
    `Återställd till versionen från ${date}${rev.summary ? ` (${rev.summary})` : ''}`.slice(0, SUMMARY_MAX), { setVersion: true });
  res.json({ revisionId });
}));

export default router;
