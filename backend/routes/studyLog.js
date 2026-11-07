/**
 * Studie modul 3: loggbok, foton, blockutvärdering, mått och export.
 * Monteras på /api/study bredvid routes/study.js.
 */
import express from 'express';
import { copyFileSync, existsSync, unlinkSync } from 'fs';
import { getDb } from '../utils/db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireStudy } from '../middleware/study.js';
import upload, { optimizeImage } from '../middleware/upload.js';
import logger from '../utils/logger.js';
import { getImagePath, getThumbnailPath } from '../utils/paths.js';
import {
  validatePlan,
  findBlock,
  computeProgress,
  reviewDueBlock,
  addCardToPlan,
  nextBlock,
  ACTION_LABELS,
} from '../utils/studyPlan.js';
import { logToMarkdown, logToCsv } from '../utils/studyExport.js';
import {
  getOrSeedPlan,
  countCompleted,
  getSessionRow,
  formatSession,
  handle,
} from './study.js';

const router = express.Router();
router.use(requireAuth);
router.use(requireStudy);

const TEXT_MAX = 4000;
const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};
const textOrNull = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, TEXT_MAX) : null);
const thumbName = (filename) => filename.replace(/\.[^/.]+$/, '.jpg');

// ─── Loggboken för ett pass ─────────────────────────────────────────

export async function getLog(db, userId, sessionId) {
  return db.get(
    `SELECT l.*, m.name AS clay_name FROM study_log_entries l
     LEFT JOIN materials m ON m.id = l.clay_material_id AND m.user_id = l.user_id
     WHERE l.session_id = ? AND l.user_id = ?`,
    [sessionId, userId]
  );
}

export async function getSessionImages(db, userId, sessionId) {
  return db.all(
    `SELECT i.id, i.session_id, i.piece_id, i.piece_image_id, i.original_filename, i.created_at, p.name AS piece_name
     FROM study_session_images i
     LEFT JOIN ceramic_pieces p ON p.id = i.piece_id AND p.user_id = i.user_id
     WHERE i.session_id = ? AND i.user_id = ? ORDER BY i.created_at, i.id`,
    [sessionId, userId]
  );
}

router.get('/sessions/:id/log', handle('hämta loggboken', async (req, res) => {
  const db = await getDb();
  const session = await getSessionRow(db, req.userId, req.params.id);
  if (!session) return res.status(404).json({ error: 'Passet hittades inte' });
  res.json({
    log: (await getLog(db, req.userId, session.id)) || null,
    images: await getSessionImages(db, req.userId, session.id),
  });
}));

router.put('/sessions/:id/log', handle('spara loggboken', async (req, res) => {
  const db = await getDb();
  const session = await getSessionRow(db, req.userId, req.params.id);
  if (!session) return res.status(404).json({ error: 'Passet hittades inte' });
  const b = req.body || {};

  const clayId = b.clay_material_id ? toInt(b.clay_material_id) : null;
  if (b.clay_material_id && !clayId) return res.status(400).json({ error: 'Ogiltig lera' });
  if (clayId) {
    const clay = await db.get('SELECT id FROM materials WHERE id = ? AND user_id = ?', [clayId, req.userId]);
    if (!clay) return res.status(400).json({ error: 'Leran finns inte bland dina material' });
  }
  const weight = b.weight_grams === null || b.weight_grams === undefined || b.weight_grams === '' ? null : toInt(b.weight_grams);
  if (weight !== null && (weight < 1 || weight > 50000)) return res.status(400).json({ error: 'Vikten ska anges i gram' });

  const values = [
    textOrNull(b.goal_and_measure),
    textOrNull(b.observation),
    textOrNull(b.change),
    clayId,
    weight,
    typeof b.series_number === 'string' ? b.series_number.trim().slice(0, 40) || null : null,
    textOrNull(b.into_damp_box),
  ];
  const existing = await db.get('SELECT id FROM study_log_entries WHERE session_id = ? AND user_id = ?', [session.id, req.userId]);
  if (existing) {
    await db.run(
      `UPDATE study_log_entries SET goal_and_measure = ?, observation = ?, change = ?, clay_material_id = ?,
         weight_grams = ?, series_number = ?, into_damp_box = ?, updated_at = datetime('now') WHERE id = ?`,
      [...values, existing.id]
    );
  } else {
    await db.run(
      `INSERT INTO study_log_entries (session_id, user_id, goal_and_measure, observation, change,
         clay_material_id, weight_grams, series_number, into_damp_box) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [session.id, req.userId, ...values]
    );
  }
  logger.info('Study log saved', { userId: req.userId, sessionId: session.id });
  res.json({ log: await getLog(db, req.userId, session.id) });
}));

// ─── Foton ──────────────────────────────────────────────────────────

const removeFiles = (filename) => {
  for (const p of [getImagePath(filename), getThumbnailPath(thumbName(filename))]) {
    try {
      if (existsSync(p)) unlinkSync(p);
    } catch (e) {
      logger.warn('Could not remove study image file', { error: e.message });
    }
  }
};

router.post(
  '/sessions/:id/images',
  upload.single('image'),
  (err, req, res, next) => {
    if (err) return res.status(400).json({ error: err.message || 'Uppladdningen misslyckades' });
    return next();
  },
  optimizeImage,
  handle('ladda upp fotot', async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Ingen bild skickades' });
    const db = await getDb();
    const session = await getSessionRow(db, req.userId, req.params.id);
    if (!session) {
      removeFiles(req.file.filename);
      return res.status(404).json({ error: 'Passet hittades inte' });
    }
    let pieceId = req.body?.piece_id ? toInt(req.body.piece_id) : null;
    let pieceImageId = null;
    if (pieceId) {
      const piece = await db.get('SELECT id, current_phase_id FROM ceramic_pieces WHERE id = ? AND user_id = ?', [pieceId, req.userId]);
      if (!piece) {
        removeFiles(req.file.filename);
        return res.status(400).json({ error: 'Alstret finns inte' });
      }
      // Kopia till alstrets galleri: egen fil, så att radering på ena stället
      // aldrig tar bort bilden på det andra.
      const phaseId = piece.current_phase_id
        || (await db.get('SELECT id FROM phases WHERE user_id = ? ORDER BY display_order, id LIMIT 1', [req.userId]))?.id;
      if (phaseId) {
        const copyName = `s${req.file.filename}`;
        copyFileSync(getImagePath(req.file.filename), getImagePath(copyName));
        if (existsSync(getThumbnailPath(thumbName(req.file.filename)))) {
          copyFileSync(getThumbnailPath(thumbName(req.file.filename)), getThumbnailPath(thumbName(copyName)));
        }
        const r = await db.run(
          'INSERT INTO piece_images (piece_id, phase_id, filename, original_filename) VALUES (?, ?, ?, ?)',
          [pieceId, phaseId, copyName, req.file.originalname]
        );
        pieceImageId = r.lastID;
      } else {
        pieceId = null;
      }
    }
    const result = await db.run(
      'INSERT INTO study_session_images (session_id, user_id, piece_id, piece_image_id, filename, original_filename) VALUES (?, ?, ?, ?, ?, ?)',
      [session.id, req.userId, pieceId, pieceImageId, req.file.filename, req.file.originalname]
    );
    logger.info('Study image uploaded', { userId: req.userId, sessionId: session.id, imageId: result.lastID, pieceId });
    res.status(201).json({ id: result.lastID, piece_id: pieceId, piece_image_id: pieceImageId });
  })
);

router.get('/session-images/:imageId/file', handle('visa fotot', async (req, res) => {
  const db = await getDb();
  const img = await db.get('SELECT filename FROM study_session_images WHERE id = ? AND user_id = ?', [req.params.imageId, req.userId]);
  if (!img) return res.status(404).json({ error: 'Fotot hittades inte' });
  if (req.query.thumbnail === 'true') {
    const t = getThumbnailPath(thumbName(img.filename));
    if (existsSync(t)) return res.sendFile(t);
  }
  const p = getImagePath(img.filename);
  if (!existsSync(p)) return res.status(404).json({ error: 'Filen saknas' });
  return res.sendFile(p);
}));

router.delete('/session-images/:imageId', handle('ta bort fotot', async (req, res) => {
  const db = await getDb();
  const img = await db.get('SELECT id, filename FROM study_session_images WHERE id = ? AND user_id = ?', [req.params.imageId, req.userId]);
  if (!img) return res.status(404).json({ error: 'Fotot hittades inte' });
  await db.run('DELETE FROM study_session_images WHERE id = ?', [img.id]);
  removeFiles(img.filename);
  res.json({ message: 'Fotot är borttaget' });
}));

// ─── Loggboken som lista ────────────────────────────────────────────

async function sessionsWithLogs(db, userId, plan, blockId) {
  const params = [userId];
  let where = 's.user_id = ? AND s.ended_at IS NOT NULL';
  if (blockId) {
    where += ' AND s.plan_block_id = ?';
    params.push(blockId);
  }
  const rows = await db.all(`SELECT s.* FROM study_sessions s WHERE ${where} ORDER BY s.date DESC, s.id DESC`, params);
  const out = [];
  for (const row of rows) {
    const [log, images, pieces, series] = await Promise.all([
      getLog(db, userId, row.id),
      getSessionImages(db, userId, row.id),
      db.all(
        `SELECT p.id, p.name, sp.action FROM study_session_pieces sp
         JOIN ceramic_pieces p ON p.id = sp.piece_id AND p.user_id = ?
         WHERE sp.session_id = ? ORDER BY sp.id`,
        [userId, row.id]
      ),
      db.all('SELECT number, name, count FROM study_series WHERE user_id = ? AND session_id = ? ORDER BY number', [userId, row.id]),
    ]);
    const s = formatSession(row, plan);
    out.push({
      ...s,
      log: log || null,
      images,
      pieces: pieces.map((p) => ({ ...p, action_label: ACTION_LABELS[p.action] })),
      series,
      challenge_card_name: s.challenge_card?.name || null,
    });
  }
  return out;
}

router.get('/log', handle('hämta loggboken', async (req, res) => {
  const db = await getDb();
  const planRow = await getOrSeedPlan(db, req.userId);
  const blockId = typeof req.query.block === 'string' && req.query.block ? req.query.block : null;
  res.json(await sessionsWithLogs(db, req.userId, planRow.plan, blockId));
}));

// ─── Blockutvärdering ──────────────────────────────────────────────

const parseReview = (r) => ({ ...r, answers: JSON.parse(r.answers_json || '[]') });

export async function reviewStatus(db, userId, plan) {
  const reviews = await db.all('SELECT plan_block_id FROM study_block_reviews WHERE user_id = ?', [userId]);
  const block = reviewDueBlock(plan, await countCompleted(db, userId), reviews.map((r) => r.plan_block_id));
  return block ? { blockId: block.id, name: block.name, order: block.order } : null;
}

router.get('/reviews', handle('hämta utvärderingarna', async (req, res) => {
  const db = await getDb();
  const planRow = await getOrSeedPlan(db, req.userId);
  const rows = await db.all('SELECT * FROM study_block_reviews WHERE user_id = ? ORDER BY created_at DESC, id DESC', [req.userId]);
  res.json({
    reviews: rows.map(parseReview),
    due: await reviewStatus(db, req.userId, planRow.plan),
  });
}));

/** Underlag för firandet: blockets pass, foton och mått. */
router.get('/reviews/:blockId/context', handle('hämta blockets underlag', async (req, res) => {
  const db = await getDb();
  const planRow = await getOrSeedPlan(db, req.userId);
  const plan = planRow.plan;
  const block = findBlock(plan, req.params.blockId);
  if (!block) return res.status(404).json({ error: 'Blocket finns inte' });

  const sessions = await db.all(
    `SELECT id, date, week_number FROM study_sessions
     WHERE user_id = ? AND plan_block_id = ? AND ended_at IS NOT NULL AND is_free = 0 ORDER BY date`,
    [req.userId, block.id]
  );
  const sessionImages = await db.all(
    `SELECT i.id, i.piece_id, p.name AS piece_name FROM study_session_images i
     JOIN study_sessions s ON s.id = i.session_id
     LEFT JOIN ceramic_pieces p ON p.id = i.piece_id
     WHERE i.user_id = ? AND s.plan_block_id = ? ORDER BY i.created_at`,
    [req.userId, block.id]
  );
  const pieceImages = await db.all(
    `SELECT DISTINCT p.id AS piece_id, p.name AS piece_name,
       COALESCE(p.default_image_id, (SELECT pi.id FROM piece_images pi WHERE pi.piece_id = p.id ORDER BY pi.created_at DESC LIMIT 1)) AS image_id
     FROM study_session_pieces sp
     JOIN study_sessions s ON s.id = sp.session_id AND s.user_id = ?
     JOIN ceramic_pieces p ON p.id = sp.piece_id AND p.user_id = ?
     WHERE s.plan_block_id = ?`,
    [req.userId, req.userId, block.id]
  );
  const metrics = await db.all(
    'SELECT * FROM study_metrics WHERE user_id = ? ORDER BY measured_at, id',
    [req.userId]
  );
  const lastChange = await db.get(
    `SELECT l.change FROM study_log_entries l JOIN study_sessions s ON s.id = l.session_id
     WHERE l.user_id = ? AND s.plan_block_id = ? AND l.change IS NOT NULL ORDER BY s.date DESC LIMIT 1`,
    [req.userId, block.id]
  );
  const next = nextBlock(plan, block.id);
  res.json({
    block: { id: block.id, name: block.name, order: block.order, gate: block.gate || [], weekFrom: block.weekFrom, weekTo: block.weekTo },
    nextBlock: next ? { id: next.id, name: next.name, themeTechnical: next.themeTechnical } : null,
    sessionCount: sessions.length,
    pieceCount: pieceImages.length,
    gallery: [
      ...sessionImages.map((i) => ({ kind: 'session', id: i.id, name: i.piece_name })),
      ...pieceImages.filter((p) => p.image_id).map((p) => ({ kind: 'piece', id: p.image_id, name: p.piece_name, piece_id: p.piece_id })),
    ],
    metrics,
    metricDefs: plan.logbook?.metrics || [],
    questions: plan.logbook?.blockReview?.questions || [],
    output: plan.logbook?.blockReview?.output || null,
    lastChange: lastChange?.change || null,
  });
}));

router.post('/reviews', handle('spara utvärderingen', async (req, res) => {
  const db = await getDb();
  const planRow = await getOrSeedPlan(db, req.userId);
  const plan = planRow.plan;
  const { plan_block_id, answers, next_goals, new_card } = req.body || {};
  const block = findBlock(plan, plan_block_id);
  if (!block) return res.status(400).json({ error: 'Blocket finns inte' });
  const questions = plan.logbook?.blockReview?.questions || [];
  if (!Array.isArray(answers) || answers.length > Math.max(questions.length, 5)) {
    return res.status(400).json({ error: 'Ogiltiga svar' });
  }
  const cleanAnswers = answers.map((a) => (typeof a === 'string' ? a.trim().slice(0, TEXT_MAX) : ''));
  if (!cleanAnswers.some(Boolean)) return res.status(400).json({ error: 'Svara på minst en fråga' });

  let newCardId = null;
  if (new_card && (new_card.name || new_card.how)) {
    if (!new_card.name?.trim() || !new_card.how?.trim()) {
      return res.status(400).json({ error: 'Kortet behöver namn och beskrivning' });
    }
    // Kortet hamnar i leken och i nästa blocks lek (eller blockets eget om det är sista)
    const target = nextBlock(plan, block.id) || block;
    const { plan: updated, card } = addCardToPlan(plan, new_card, target.id);
    const { valid, errors } = validatePlan(updated);
    if (!valid) return res.status(400).json({ error: `Kortet gör planen ogiltig: ${errors[0]}` });
    const json = JSON.stringify(updated);
    await db.run("UPDATE study_plans SET json = ?, updated_at = datetime('now') WHERE id = ?", [json, planRow.id]);
    await db.run(
      "INSERT INTO study_plan_revisions (plan_id, user_id, author, summary, snapshot) VALUES (?, ?, 'user', ?, ?)",
      [planRow.id, req.userId, `Nytt utmaningskort från blockutvärderingen: ${card.name}`, json]
    );
    newCardId = card.id;
  }

  const result = await db.run(
    'INSERT INTO study_block_reviews (user_id, plan_id, plan_block_id, answers_json, next_goals, new_card_id) VALUES (?, ?, ?, ?, ?, ?)',
    [req.userId, planRow.id, block.id, JSON.stringify(cleanAnswers), textOrNull(next_goals), newCardId]
  );
  logger.info('Block review saved', { userId: req.userId, blockId: block.id, newCardId });
  const row = await db.get('SELECT * FROM study_block_reviews WHERE id = ?', [result.lastID]);
  res.status(201).json(parseReview(row));
}));

// ─── Mått ───────────────────────────────────────────────────────────

router.get('/metrics', handle('hämta måtten', async (req, res) => {
  const db = await getDb();
  const planRow = await getOrSeedPlan(db, req.userId);
  const rows = await db.all('SELECT * FROM study_metrics WHERE user_id = ? ORDER BY measured_at, id', [req.userId]);
  res.json({
    metrics: rows,
    defs: planRow.plan.logbook?.metrics || [],
    blocks: (planRow.plan.phases || []).map((b) => ({ id: b.id, name: b.name, order: b.order, weekFrom: b.weekFrom, weekTo: b.weekTo })),
  });
}));

router.post('/metrics', handle('spara måttet', async (req, res) => {
  const db = await getDb();
  const planRow = await getOrSeedPlan(db, req.userId);
  const plan = planRow.plan;
  const { metric_id, value, plan_block_id, session_id, measured_at, note } = req.body || {};
  if (!(plan.logbook?.metrics || []).some((m) => m.id === metric_id)) return res.status(400).json({ error: 'Okänt mått' });
  const v = Number(String(value).replace(',', '.'));
  if (value === '' || value === null || value === undefined || !Number.isFinite(v)) {
    return res.status(400).json({ error: 'Värdet ska vara ett tal' });
  }
  let blockId = plan_block_id || null;
  if (blockId && !findBlock(plan, blockId)) return res.status(400).json({ error: 'Blocket finns inte' });
  if (!blockId) blockId = computeProgress(plan, await countCompleted(db, req.userId)).block?.id || null;
  let sessionId = null;
  if (session_id) {
    const s = await getSessionRow(db, req.userId, session_id);
    if (!s) return res.status(400).json({ error: 'Passet finns inte' });
    sessionId = s.id;
  }
  const when = measured_at && !Number.isNaN(Date.parse(measured_at)) ? measured_at : new Date().toISOString();
  const r = await db.run(
    'INSERT INTO study_metrics (user_id, plan_block_id, metric_id, value, measured_at, session_id, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [req.userId, blockId, metric_id, v, when, sessionId, textOrNull(note)]
  );
  res.status(201).json(await db.get('SELECT * FROM study_metrics WHERE id = ?', [r.lastID]));
}));

router.delete('/metrics/:id', handle('ta bort måttet', async (req, res) => {
  const db = await getDb();
  const r = await db.run('DELETE FROM study_metrics WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!r.changes) return res.status(404).json({ error: 'Måttet hittades inte' });
  res.json({ message: 'Måttet är borttaget' });
}));

// ─── Export ─────────────────────────────────────────────────────────

router.get('/export', handle('exportera loggboken', async (req, res) => {
  const format = req.query.format === 'csv' ? 'csv' : 'md';
  const db = await getDb();
  const planRow = await getOrSeedPlan(db, req.userId);
  const plan = planRow.plan;
  const sessions = (await sessionsWithLogs(db, req.userId, plan, null)).reverse(); // äldst först
  const date = new Date().toISOString().slice(0, 10);
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="loggbok-${date}.csv"`);
    return res.send(logToCsv(sessions));
  }
  const reviews = (await db.all('SELECT * FROM study_block_reviews WHERE user_id = ? ORDER BY created_at', [req.userId])).map(parseReview);
  const metrics = await db.all('SELECT * FROM study_metrics WHERE user_id = ? ORDER BY measured_at', [req.userId]);
  const md = logToMarkdown({
    title: plan.title,
    sessions,
    reviews,
    metrics,
    metricDefs: plan.logbook?.metrics || [],
    questions: plan.logbook?.blockReview?.questions || [],
    blockName: (id) => findBlock(plan, id)?.name || id || '–',
  });
  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="loggbok-${date}.md"`);
  return res.send(md);
}));

export default router;
