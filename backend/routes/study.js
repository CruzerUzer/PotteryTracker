/**
 * Studie-modulen: plan, pass, alster i passet, milstolpar och utmaningskort.
 * Se design/STUDIE_PLAN.md. Alla routes kräver inloggning och study_enabled.
 */
import express from 'express';
import { getDb } from '../utils/db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireStudy } from '../middleware/study.js';
import logger from '../utils/logger.js';
import { existsSync, unlinkSync } from 'fs';
import { getImagePath, getThumbnailPath } from '../utils/paths.js';
import {
  loadPlanFile,
  loadPlanDocument,
  validatePlan,
  computeProgress,
  findBlock,
  blockForWeek,
  templateSegments,
  sanitizeSegments,
  guessStageMap,
  pickRandom,
  reviewDueBlock,
  fileUpdateInfo,
  STAGE_IDS,
  SESSION_ACTIONS,
  ACTION_TO_STAGE,
  ACTION_LABELS,
  weekEntry,
} from '../utils/studyPlan.js';

const router = express.Router();
router.use(requireAuth);
router.use(requireStudy);

// ─── Hjälpfunktioner ────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Dagens datum i Sverige som YYYY-MM-DD. */
export function todayStockholm(now = new Date()) {
  return now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
}

const parseJson = (text, fallback) => {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
};

/** Hämtar användarens plan, seedar från filen första gången. */
export async function getOrSeedPlan(db, userId) {
  let row = await db.get('SELECT * FROM study_plans WHERE user_id = ?', [userId]);
  if (!row) {
    const plan = loadPlanFile();
    const { valid, errors } = validatePlan(plan);
    if (!valid) {
      throw new Error(`Planfilen är ogiltig: ${errors.slice(0, 3).join('; ')}`);
    }
    const json = JSON.stringify(plan);
    const result = await db.run(
      'INSERT INTO study_plans (user_id, version, title, json) VALUES (?, ?, ?, ?)',
      [userId, plan.version, plan.title, json]
    );
    await db.run(
      "INSERT INTO study_plan_revisions (plan_id, user_id, author, summary, snapshot) VALUES (?, ?, 'seed', ?, ?)",
      [result.lastID, userId, `Planen v${plan.version} hämtad från filen`, json]
    );
    logger.info('Study plan seeded', { userId, planId: result.lastID, version: plan.version });
    row = await db.get('SELECT * FROM study_plans WHERE id = ?', [result.lastID]);
  }
  return { ...row, plan: parseJson(row.json, {}) };
}

export async function countCompleted(db, userId) {
  const r = await db.get(
    'SELECT COUNT(*) AS n FROM study_sessions WHERE user_id = ? AND ended_at IS NOT NULL AND is_free = 0',
    [userId]
  );
  return r?.n || 0;
}

/** Mappningen bränningsflöde → faser. Gissas från fasnamnen första gången. */
export async function getStageMap(db, userId) {
  const rows = await db.all('SELECT stage_id, phase_id FROM study_stage_phase_map WHERE user_id = ?', [userId]);
  if (rows.length === 0) {
    const phases = await db.all('SELECT id, name, display_order FROM phases WHERE user_id = ?', [userId]);
    const guess = guessStageMap(phases);
    for (const stage of STAGE_IDS) {
      await db.run(
        'INSERT OR IGNORE INTO study_stage_phase_map (user_id, stage_id, phase_id) VALUES (?, ?, ?)',
        [userId, stage, guess[stage] ?? null]
      );
    }
    return Object.fromEntries(STAGE_IDS.map((s) => [s, guess[s] ?? null]));
  }
  const map = Object.fromEntries(STAGE_IDS.map((s) => [s, null]));
  for (const r of rows) map[r.stage_id] = r.phase_id;
  return map;
}

export function cardById(plan, id) {
  return (plan.challengeCards || []).find((c) => c.id === id) || null;
}

export function formatSession(row, plan) {
  if (!row) return null;
  const block = row.plan_block_id ? findBlock(plan, row.plan_block_id) : null;
  return {
    id: row.id,
    plan_id: row.plan_id,
    plan_block_id: row.plan_block_id,
    block_name: block?.name || null,
    block_order: block?.order ?? null,
    week_number: row.week_number,
    date: row.date,
    is_free: row.is_free === 1,
    goal: row.goal,
    planned_start: row.planned_start,
    timer_mode: row.timer_mode || null,
    started_at: row.started_at,
    ended_at: row.ended_at,
    segments: parseJson(row.segments_json, []),
    challenge_card_id: row.challenge_card_id,
    challenge_card: row.challenge_card_id ? cardById(plan, row.challenge_card_id) : null,
    created_at: row.created_at,
    status: row.ended_at ? 'ended' : row.started_at ? 'running' : 'prepared',
    piece_count: row.piece_count ?? undefined,
  };
}

export async function getSessionRow(db, userId, id) {
  return db.get('SELECT * FROM study_sessions WHERE id = ? AND user_id = ?', [id, userId]);
}

async function logFor(db, userId, sessionId) {
  return db.get(
    `SELECT l.*, m.name AS clay_name FROM study_log_entries l
     LEFT JOIN materials m ON m.id = l.clay_material_id AND m.user_id = l.user_id
     WHERE l.session_id = ? AND l.user_id = ?`,
    [sessionId, userId]
  );
}

async function imagesFor(db, userId, sessionId) {
  return db.all(
    `SELECT i.id, i.piece_id, i.piece_image_id, i.created_at, p.name AS piece_name
     FROM study_session_images i
     LEFT JOIN ceramic_pieces p ON p.id = i.piece_id AND p.user_id = i.user_id
     WHERE i.session_id = ? AND i.user_id = ? ORDER BY i.created_at, i.id`,
    [sessionId, userId]
  );
}

async function reviewDue(db, userId, plan, completed) {
  const rows = await db.all('SELECT plan_block_id FROM study_block_reviews WHERE user_id = ?', [userId]);
  const block = reviewDueBlock(plan, completed, rows.map((r) => r.plan_block_id));
  return block ? { blockId: block.id, name: block.name, order: block.order } : null;
}

const PIECE_COLUMNS = `
  p.id, p.name, p.current_phase_id, p.current_location_id, p.done, p.created_at,
  ph.name AS phase_name, ph.display_order AS phase_order,
  COALESCE(p.default_image_id, (
    SELECT pi.id FROM piece_images pi WHERE pi.piece_id = p.id ORDER BY pi.created_at DESC LIMIT 1
  )) AS display_image_id
`;

/**
 * Fasförslag: åtgärden motsvarar ett steg i bränningsflödet vars fas ligger
 * senare än alstrets nuvarande fas. Flytten görs aldrig automatiskt.
 */
function suggestionFor(action, piece, stageMap, phasesById) {
  const stage = ACTION_TO_STAGE[action];
  if (!stage) return null;
  const targetId = stageMap[stage];
  if (!targetId || targetId === piece.current_phase_id) return null;
  const target = phasesById.get(targetId);
  if (!target) return null;
  const current = piece.current_phase_id ? phasesById.get(piece.current_phase_id) : null;
  if (current && (current.display_order || 0) >= (target.display_order || 0)) return null;
  return { phase_id: target.id, phase_name: target.name };
}

async function phasesMap(db, userId) {
  const phases = await db.all('SELECT id, name, display_order FROM phases WHERE user_id = ?', [userId]);
  return new Map(phases.map((p) => [p.id, p]));
}

async function sessionPieces(db, userId, sessionId) {
  return db.all(
    `SELECT sp.id AS session_piece_id, sp.action, sp.created_at AS linked_at, ${PIECE_COLUMNS}
     FROM study_session_pieces sp
     JOIN ceramic_pieces p ON p.id = sp.piece_id AND p.user_id = ?
     LEFT JOIN phases ph ON ph.id = p.current_phase_id
     WHERE sp.session_id = ?
     ORDER BY sp.created_at, sp.id`,
    [userId, sessionId]
  );
}

async function sessionDetail(db, userId, row, plan) {
  const [pieces, stageMap, phasesById, series] = await Promise.all([
    sessionPieces(db, userId, row.id),
    getStageMap(db, userId),
    phasesMap(db, userId),
    db.all('SELECT * FROM study_series WHERE user_id = ? AND session_id = ? ORDER BY number', [userId, row.id]),
  ]);
  const previous = await db.get(
    `SELECT * FROM study_sessions
     WHERE user_id = ? AND ended_at IS NOT NULL AND id != ?
       AND (date < ? OR (date = ? AND id < ?))
     ORDER BY date DESC, ended_at DESC LIMIT 1`,
    [userId, row.id, row.date, row.date, row.id]
  );
  const [log, images, previousLog] = await Promise.all([
    logFor(db, userId, row.id),
    imagesFor(db, userId, row.id),
    previous ? logFor(db, userId, previous.id) : null,
  ]);
  return {
    ...formatSession(row, plan),
    log: log || null,
    images,
    pieces: pieces.map((p) => ({
      ...p,
      action_label: ACTION_LABELS[p.action],
      suggestion: suggestionFor(p.action, p, stageMap, phasesById),
    })),
    series,
    previous: previous ? { ...formatSession(previous, plan), log: previousLog || null } : null,
    wheel_booking: plan.sessionTemplate?.wheelBooking || null,
    logbook_fields: plan.logbook?.perSession || [],
    inspiration: (row.plan_block_id && row.week_number ? weekEntry(findBlock(plan, row.plan_block_id), row.week_number)?.inspiration : null) || [],
  };
}

/** Gods på hyllan: drejat men inte beskickat, och skröjbränt som väntar på glasyr. */
async function shelf(db, userId, stageMap) {
  const toTrim = await db.all(
    `SELECT ${PIECE_COLUMNS}, MAX(s.date) AS thrown_date
     FROM study_session_pieces sp
     JOIN study_sessions s ON s.id = sp.session_id AND s.user_id = ?
     JOIN ceramic_pieces p ON p.id = sp.piece_id AND p.user_id = ?
     LEFT JOIN phases ph ON ph.id = p.current_phase_id
     WHERE sp.action = 'thrown' AND p.done = 0
       AND NOT EXISTS (
         SELECT 1 FROM study_session_pieces sp2
         WHERE sp2.piece_id = p.id AND sp2.action = 'trimmed'
       )
       ${stageMap.thrown ? 'AND (p.current_phase_id = ? OR p.current_phase_id IS NULL)' : ''}
     GROUP BY p.id
     ORDER BY thrown_date, p.id`,
    stageMap.thrown ? [userId, userId, stageMap.thrown] : [userId, userId]
  );
  const toGlaze = stageMap.bisque
    ? await db.all(
        `SELECT ${PIECE_COLUMNS}
         FROM ceramic_pieces p
         LEFT JOIN phases ph ON ph.id = p.current_phase_id
         WHERE p.user_id = ? AND p.done = 0 AND p.current_phase_id = ?
         ORDER BY p.updated_at, p.id`,
        [userId, stageMap.bisque]
      )
    : [];
  return { toTrim, toGlaze };
}

async function gateChecks(db, userId) {
  const rows = await db.all(
    'SELECT plan_block_id, gate_index, checked_at FROM study_gate_checks WHERE user_id = ?',
    [userId]
  );
  const out = {};
  for (const r of rows) {
    (out[r.plan_block_id] ||= []).push(r.gate_index);
  }
  return out;
}

export const handle = (label, fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (error) {
    logger.error(`Study: ${label}`, { error: error.message, stack: error.stack, userId: req.userId });
    res.status(500).json({ error: `Kunde inte ${label}` });
  }
};

function removeStudyFiles(filename) {
  for (const p of [getImagePath(filename), getThumbnailPath(filename.replace(/\.[^/.]+$/, '.jpg'))]) {
    try {
      if (existsSync(p)) unlinkSync(p);
    } catch (e) {
      logger.warn('Could not remove study image file', { error: e.message });
    }
  }
}

// ─── Plan ───────────────────────────────────────────────────────────

router.get('/plan', handle('hämta planen', async (req, res) => {
  const db = await getDb();
  const planRow = await getOrSeedPlan(db, req.userId);
  const completed = await countCompleted(db, req.userId);
  res.json({
    id: planRow.id,
    version: planRow.version,
    title: planRow.title,
    updated_at: planRow.updated_at,
    plan: planRow.plan,
    progress: computeProgress(planRow.plan, completed),
    gateChecks: await gateChecks(db, req.userId),
  });
}));

router.post('/plan/seed', handle('seeda planen', async (req, res) => {
  const db = await getDb();
  const planRow = await getOrSeedPlan(db, req.userId);
  res.status(201).json({ id: planRow.id, version: planRow.version, title: planRow.title });
}));

router.get('/plan/document', handle('hämta planens text', async (req, res) => {
  res.json({ markdown: loadPlanDocument() });
}));

// ─── Mappning bränningsflöde → faser ────────────────────────────────

router.get('/stage-map', handle('hämta mappningen', async (req, res) => {
  const db = await getDb();
  const planRow = await getOrSeedPlan(db, req.userId);
  res.json({
    map: await getStageMap(db, req.userId),
    stages: planRow.plan.firingPipeline?.stages || [],
  });
}));

router.put('/stage-map', handle('spara mappningen', async (req, res) => {
  const body = req.body || {};
  const db = await getDb();
  const updates = {};
  for (const stage of STAGE_IDS) {
    if (!(stage in body)) continue;
    const value = body[stage];
    if (value === null || value === '') {
      updates[stage] = null;
      continue;
    }
    const phaseId = toInt(value);
    const phase = phaseId ? await db.get('SELECT id FROM phases WHERE id = ? AND user_id = ?', [phaseId, req.userId]) : null;
    if (!phase) return res.status(400).json({ error: `Ogiltig fas för ${stage}` });
    updates[stage] = phaseId;
  }
  await getStageMap(db, req.userId); // se till att raderna finns
  for (const [stage, phaseId] of Object.entries(updates)) {
    await db.run(
      'INSERT OR REPLACE INTO study_stage_phase_map (user_id, stage_id, phase_id) VALUES (?, ?, ?)',
      [req.userId, stage, phaseId]
    );
  }
  res.json({ map: await getStageMap(db, req.userId) });
}));

// ─── Idag ───────────────────────────────────────────────────────────

router.get('/today', handle('hämta dagens pass', async (req, res) => {
  const db = await getDb();
  const planRow = await getOrSeedPlan(db, req.userId);
  const plan = planRow.plan;
  const completed = await countCompleted(db, req.userId);
  const progress = computeProgress(plan, completed);
  const stageMap = await getStageMap(db, req.userId);

  const active = await db.get(
    'SELECT * FROM study_sessions WHERE user_id = ? AND ended_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 1',
    [req.userId]
  );
  const last = await db.get(
    'SELECT * FROM study_sessions WHERE user_id = ? AND ended_at IS NOT NULL ORDER BY date DESC, ended_at DESC LIMIT 1',
    [req.userId]
  );
  const block = progress.block ? findBlock(plan, progress.block.id) : null;
  const checks = await gateChecks(db, req.userId);

  res.json({
    plan: { id: planRow.id, version: planRow.version, title: planRow.title },
    progress,
    activeSession: formatSession(active, plan),
    lastSession: last ? { ...formatSession(last, plan), log: (await logFor(db, req.userId, last.id)) || null } : null,
    reviewDue: await reviewDue(db, req.userId, plan, completed),
    fileUpdate: (() => {
      try {
        const info = fileUpdateInfo(planRow);
        return info.newer ? info : null;
      } catch {
        return null;
      }
    })(),
    shelf: await shelf(db, req.userId, stageMap),
    gate: block
      ? { blockId: block.id, items: block.gate || [], checked: checks[block.id] || [] }
      : null,
    blockCards: (block?.playCards || []).map((id) => cardById(plan, id)).filter(Boolean),
    betweenSessions: plan.sessionTemplate?.betweenSessions || null,
    stageMap,
  });
}));

// ─── Pass ───────────────────────────────────────────────────────────

router.get('/sessions', handle('hämta passen', async (req, res) => {
  const db = await getDb();
  const planRow = await getOrSeedPlan(db, req.userId);
  const rows = await db.all(
    `SELECT s.*, (SELECT COUNT(*) FROM study_session_pieces sp WHERE sp.session_id = s.id) AS piece_count
     FROM study_sessions s WHERE s.user_id = ?
     ORDER BY s.date DESC, s.id DESC`,
    [req.userId]
  );
  res.json(rows.map((r) => formatSession(r, planRow.plan)));
}));

router.post('/sessions', handle('skapa passet', async (req, res) => {
  const { date, is_free, goal, challenge_card_id } = req.body || {};
  if (date !== undefined && date !== null && !DATE_RE.test(String(date))) {
    return res.status(400).json({ error: 'Datumet ska skrivas ÅÅÅÅ-MM-DD' });
  }
  const db = await getDb();
  const planRow = await getOrSeedPlan(db, req.userId);
  const plan = planRow.plan;
  if (challenge_card_id && !cardById(plan, challenge_card_id)) {
    return res.status(400).json({ error: 'Kortet finns inte i leken' });
  }
  const progress = computeProgress(plan, await countCompleted(db, req.userId));
  const free = is_free ? 1 : 0;
  const defaultGoal = progress.weekEntry?.main || '';
  const result = await db.run(
    `INSERT INTO study_sessions
       (user_id, plan_id, plan_block_id, week_number, date, is_free, goal, segments_json, challenge_card_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.userId,
      planRow.id,
      progress.block?.id || null,
      free ? null : progress.week,
      date || todayStockholm(),
      free,
      typeof goal === 'string' ? goal.slice(0, 2000) : defaultGoal,
      JSON.stringify(templateSegments(plan)),
      challenge_card_id || null,
    ]
  );
  const row = await getSessionRow(db, req.userId, result.lastID);
  logger.info('Study session created', { userId: req.userId, sessionId: row.id, week: row.week_number, free });
  res.status(201).json(await sessionDetail(db, req.userId, row, plan));
}));

router.get('/sessions/:id', handle('hämta passet', async (req, res) => {
  const db = await getDb();
  const row = await getSessionRow(db, req.userId, req.params.id);
  if (!row) return res.status(404).json({ error: 'Passet hittades inte' });
  const planRow = await getOrSeedPlan(db, req.userId);
  res.json(await sessionDetail(db, req.userId, row, planRow.plan));
}));

router.patch('/sessions/:id', handle('spara passet', async (req, res) => {
  const db = await getDb();
  const row = await getSessionRow(db, req.userId, req.params.id);
  if (!row) return res.status(404).json({ error: 'Passet hittades inte' });
  const planRow = await getOrSeedPlan(db, req.userId);
  const body = req.body || {};
  const sets = [];
  const params = [];

  if ('goal' in body) {
    if (body.goal !== null && typeof body.goal !== 'string') return res.status(400).json({ error: 'Ogiltigt delmål' });
    sets.push('goal = ?');
    params.push(body.goal ? body.goal.slice(0, 2000) : null);
  }
  if ('date' in body) {
    if (!DATE_RE.test(String(body.date))) return res.status(400).json({ error: 'Datumet ska skrivas ÅÅÅÅ-MM-DD' });
    sets.push('date = ?');
    params.push(body.date);
  }
  if ('segments' in body) {
    const segments = sanitizeSegments(body.segments);
    if (!segments) return res.status(400).json({ error: 'Ogiltiga segment' });
    sets.push('segments_json = ?');
    params.push(JSON.stringify(segments));
  }
  if ('planned_start' in body) {
    const v = body.planned_start;
    if (v !== null && !TIME_RE.test(String(v)) && Number.isNaN(Date.parse(v))) {
      return res.status(400).json({ error: 'Ogiltig starttid' });
    }
    sets.push('planned_start = ?');
    params.push(v || null);
  }
  if ('challenge_card_id' in body) {
    const id = body.challenge_card_id;
    if (id && !cardById(planRow.plan, id)) return res.status(400).json({ error: 'Kortet finns inte i leken' });
    sets.push('challenge_card_id = ?');
    params.push(id || null);
  }
  if ('is_free' in body) {
    if (row.ended_at) return res.status(400).json({ error: 'Ett avslutat pass kan inte bli fritt eller räknat i efterhand' });
    const free = body.is_free ? 1 : 0;
    sets.push('is_free = ?', 'week_number = ?');
    const progress = computeProgress(planRow.plan, await countCompleted(db, req.userId));
    params.push(free, free ? null : progress.week);
  }
  if (sets.length === 0) return res.status(400).json({ error: 'Inget att spara' });

  await db.run(`UPDATE study_sessions SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, [...params, row.id, req.userId]);
  const updated = await getSessionRow(db, req.userId, row.id);
  res.json(await sessionDetail(db, req.userId, updated, planRow.plan));
}));

const TIMER_MODES = ['now', 'clock', 'countdown'];

/**
 * Startar passet. Läget räknas alltid fram från planned_start och klockan:
 *   now        planned_start = nu
 *   clock      planned_start = angivet klockslag (t.ex. 10:00 för skivbokningen)
 *   countdown  ren nedräkning från nu, utan klockslag
 */
router.post('/sessions/:id/start', handle('starta passet', async (req, res) => {
  const db = await getDb();
  const row = await getSessionRow(db, req.userId, req.params.id);
  if (!row) return res.status(404).json({ error: 'Passet hittades inte' });
  if (row.ended_at) return res.status(400).json({ error: 'Passet är redan avslutat' });
  const { planned_start, mode = 'now' } = req.body || {};
  if (!TIMER_MODES.includes(mode)) return res.status(400).json({ error: 'Ogiltigt startsätt' });
  const now = new Date();
  let start = now.toISOString();
  if (mode === 'clock') {
    const t = Date.parse(planned_start);
    if (!planned_start || Number.isNaN(t)) return res.status(400).json({ error: 'Ange en giltig starttid' });
    if (Math.abs(t - now.getTime()) > 12 * 3600 * 1000) {
      return res.status(400).json({ error: 'Starttiden ska ligga inom tolv timmar från nu' });
    }
    start = new Date(t).toISOString();
  }
  await db.run(
    'UPDATE study_sessions SET started_at = ?, planned_start = ?, timer_mode = ? WHERE id = ? AND user_id = ?',
    [now.toISOString(), start, mode, row.id, req.userId]
  );
  const planRow = await getOrSeedPlan(db, req.userId);
  res.json(await sessionDetail(db, req.userId, await getSessionRow(db, req.userId, row.id), planRow.plan));
}));

router.post('/sessions/:id/end', handle('avsluta passet', async (req, res) => {
  const db = await getDb();
  const row = await getSessionRow(db, req.userId, req.params.id);
  if (!row) return res.status(404).json({ error: 'Passet hittades inte' });
  if (row.ended_at) return res.status(400).json({ error: 'Passet är redan avslutat' });
  const planRow = await getOrSeedPlan(db, req.userId);
  const now = new Date().toISOString();
  if (row.is_free) {
    await db.run('UPDATE study_sessions SET ended_at = ? WHERE id = ? AND user_id = ?', [now, row.id, req.userId]);
  } else {
    // Ögonblicksbild av vecka och block när passet räknas, så att historiken
    // står kvar även om planen ändras senare.
    const progress = computeProgress(planRow.plan, await countCompleted(db, req.userId));
    await db.run(
      'UPDATE study_sessions SET ended_at = ?, week_number = ?, plan_block_id = ? WHERE id = ? AND user_id = ?',
      [now, progress.week, progress.block?.id || null, row.id, req.userId]
    );
  }
  logger.info('Study session ended', { userId: req.userId, sessionId: row.id });
  res.json(await sessionDetail(db, req.userId, await getSessionRow(db, req.userId, row.id), planRow.plan));
}));

router.delete('/sessions/:id', handle('ta bort passet', async (req, res) => {
  const db = await getDb();
  const row = await getSessionRow(db, req.userId, req.params.id);
  if (!row) return res.status(404).json({ error: 'Passet hittades inte' });
  await db.run('DELETE FROM study_session_pieces WHERE session_id = ?', [row.id]);
  await db.run('DELETE FROM study_log_entries WHERE session_id = ? AND user_id = ?', [row.id, req.userId]);
  const imgs = await db.all('SELECT filename FROM study_session_images WHERE session_id = ? AND user_id = ?', [row.id, req.userId]);
  await db.run('DELETE FROM study_session_images WHERE session_id = ? AND user_id = ?', [row.id, req.userId]);
  for (const img of imgs || []) removeStudyFiles(img.filename);
  await db.run('UPDATE study_series SET session_id = NULL WHERE session_id = ? AND user_id = ?', [row.id, req.userId]);
  await db.run('UPDATE glaze_tests SET session_id = NULL WHERE session_id = ? AND user_id = ?', [row.id, req.userId]);
  await db.run('UPDATE study_metrics SET session_id = NULL WHERE session_id = ? AND user_id = ?', [row.id, req.userId]);
  await db.run('DELETE FROM study_sessions WHERE id = ? AND user_id = ?', [row.id, req.userId]);
  logger.info('Study session deleted', { userId: req.userId, sessionId: row.id });
  res.json({ message: 'Passet är borttaget' });
}));

// ─── Alster i passet ────────────────────────────────────────────────

async function createSeries(db, userId, session, input, stageMap) {
  const count = toInt(input.count);
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const weight = input.weight_grams === undefined || input.weight_grams === null || input.weight_grams === ''
    ? null
    : toInt(input.weight_grams);
  if (!count || count < 1 || count > 40) return { error: 'Antal ska vara 1–40' };
  if (!name || name.length > 80) return { error: 'Serien behöver ett namn' };
  if (weight !== null && (weight < 1 || weight > 50000)) return { error: 'Vikten ska anges i gram' };

  const clayId = input.clay_material_id ? toInt(input.clay_material_id) : null;
  if (clayId) {
    const clay = await db.get('SELECT id FROM materials WHERE id = ? AND user_id = ?', [clayId, userId]);
    if (!clay) return { error: 'Leran finns inte bland dina material' };
  }
  const locationId = input.location_id ? toInt(input.location_id) : null;
  if (locationId) {
    const loc = await db.get('SELECT id FROM locations WHERE id = ? AND user_id = ?', [locationId, userId]);
    if (!loc) return { error: 'Platsen finns inte' };
  }
  let phaseId = stageMap.thrown;
  if (!phaseId) {
    const first = await db.get('SELECT id FROM phases WHERE user_id = ? ORDER BY display_order, id LIMIT 1', [userId]);
    phaseId = first?.id || null;
  }

  const maxRow = await db.get('SELECT MAX(number) AS n FROM study_series WHERE user_id = ?', [userId]);
  const number = (maxRow?.n || 0) + 1;
  const seriesResult = await db.run(
    'INSERT INTO study_series (user_id, number, session_id, name, weight_grams, clay_material_id, count) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, number, session.id, name, weight, clayId, count]
  );

  const label = weight ? `${name} ${weight} g` : name;
  const description = `Serie S${number}, drejad ${session.date}${session.week_number ? ` (pass ${session.week_number})` : ''}.`;
  const pieceIds = [];
  for (let i = 1; i <= count; i++) {
    const r = await db.run(
      'INSERT INTO ceramic_pieces (user_id, name, description, current_phase_id, current_location_id, done) VALUES (?, ?, ?, ?, ?, 0)',
      [userId, `${label} · S${number}-${i}`, description, phaseId, locationId]
    );
    pieceIds.push(r.lastID);
    if (clayId) {
      await db.run('INSERT OR IGNORE INTO piece_materials (piece_id, material_id) VALUES (?, ?)', [r.lastID, clayId]);
    }
    await db.run(
      "INSERT OR IGNORE INTO study_session_pieces (session_id, piece_id, action) VALUES (?, ?, 'thrown')",
      [session.id, r.lastID]
    );
  }
  logger.info('Study series created', { userId, sessionId: session.id, number, count });
  return { series: { id: seriesResult.lastID, number, name, weight_grams: weight, count }, pieceIds };
}

router.post('/sessions/:id/pieces', handle('koppla alster', async (req, res) => {
  const db = await getDb();
  const session = await getSessionRow(db, req.userId, req.params.id);
  if (!session) return res.status(404).json({ error: 'Passet hittades inte' });
  const planRow = await getOrSeedPlan(db, req.userId);
  const stageMap = await getStageMap(db, req.userId);
  const body = req.body || {};

  if (body.series) {
    const result = await createSeries(db, req.userId, session, body.series, stageMap);
    if (result.error) return res.status(400).json({ error: result.error });
    const detail = await sessionDetail(db, req.userId, session, planRow.plan);
    return res.status(201).json({ series: result.series, piece_ids: result.pieceIds, session: detail });
  }

  const pieceId = toInt(body.piece_id);
  const action = body.action;
  if (!pieceId) return res.status(400).json({ error: 'Välj ett alster' });
  if (!SESSION_ACTIONS.includes(action)) return res.status(400).json({ error: 'Ogiltig åtgärd' });
  const piece = await db.get('SELECT id, current_phase_id FROM ceramic_pieces WHERE id = ? AND user_id = ?', [pieceId, req.userId]);
  if (!piece) return res.status(404).json({ error: 'Alstret hittades inte' });

  await db.run(
    'INSERT OR IGNORE INTO study_session_pieces (session_id, piece_id, action) VALUES (?, ?, ?)',
    [session.id, pieceId, action]
  );
  const suggestion = suggestionFor(action, piece, stageMap, await phasesMap(db, req.userId));
  const detail = await sessionDetail(db, req.userId, session, planRow.plan);
  res.status(201).json({ suggestion, session: detail });
}));

router.delete('/sessions/:id/pieces/:spId', handle('ta bort kopplingen', async (req, res) => {
  const db = await getDb();
  const session = await getSessionRow(db, req.userId, req.params.id);
  if (!session) return res.status(404).json({ error: 'Passet hittades inte' });
  const result = await db.run(
    'DELETE FROM study_session_pieces WHERE id = ? AND session_id = ?',
    [req.params.spId, session.id]
  );
  if (!result.changes) return res.status(404).json({ error: 'Kopplingen hittades inte' });
  const planRow = await getOrSeedPlan(db, req.userId);
  res.json(await sessionDetail(db, req.userId, session, planRow.plan));
}));

router.get('/pieces/:pieceId/sessions', handle('hämta alstrets pass', async (req, res) => {
  const db = await getDb();
  const piece = await db.get('SELECT id FROM ceramic_pieces WHERE id = ? AND user_id = ?', [req.params.pieceId, req.userId]);
  if (!piece) return res.status(404).json({ error: 'Alstret hittades inte' });
  const rows = await db.all(
    `SELECT sp.id, sp.action, s.id AS session_id, s.date, s.week_number, s.is_free, s.ended_at
     FROM study_session_pieces sp
     JOIN study_sessions s ON s.id = sp.session_id AND s.user_id = ?
     WHERE sp.piece_id = ?
     ORDER BY s.date, s.id, sp.id`,
    [req.userId, piece.id]
  );
  res.json(rows.map((r) => ({
    ...r,
    is_free: r.is_free === 1,
    action_label: ACTION_LABELS[r.action],
  })));
}));

// ─── Milstolpe och kort ─────────────────────────────────────────────────

async function validateGate(db, userId, blockId, index) {
  const planRow = await getOrSeedPlan(db, userId);
  const block = findBlock(planRow.plan, blockId);
  const i = toInt(index);
  if (!block || i === null || i < 0 || i >= (block.gate || []).length) return null;
  return { block, index: i };
}

router.post('/gates/:blockId/:index', handle('kryssa milstolpen', async (req, res) => {
  const db = await getDb();
  const gate = await validateGate(db, req.userId, req.params.blockId, req.params.index);
  if (!gate) return res.status(404).json({ error: 'Punkten i milstolpen finns inte' });
  await db.run(
    'INSERT OR IGNORE INTO study_gate_checks (user_id, plan_block_id, gate_index) VALUES (?, ?, ?)',
    [req.userId, gate.block.id, gate.index]
  );
  res.json({ blockId: gate.block.id, checked: (await gateChecks(db, req.userId))[gate.block.id] || [] });
}));

router.delete('/gates/:blockId/:index', handle('avkryssa milstolpen', async (req, res) => {
  const db = await getDb();
  const gate = await validateGate(db, req.userId, req.params.blockId, req.params.index);
  if (!gate) return res.status(404).json({ error: 'Punkten i milstolpen finns inte' });
  await db.run(
    'DELETE FROM study_gate_checks WHERE user_id = ? AND plan_block_id = ? AND gate_index = ?',
    [req.userId, gate.block.id, gate.index]
  );
  res.json({ blockId: gate.block.id, checked: (await gateChecks(db, req.userId))[gate.block.id] || [] });
}));

router.get('/cards/draw', handle('dra ett kort', async (req, res) => {
  const db = await getDb();
  const planRow = await getOrSeedPlan(db, req.userId);
  const plan = planRow.plan;
  const all = plan.challengeCards || [];
  let deck = all;
  const blockParam = req.query.block;
  if (blockParam && blockParam !== 'all') {
    const block = findBlock(plan, blockParam);
    if (!block) return res.status(404).json({ error: 'Blocket finns inte' });
    const ids = new Set(block.playCards || []);
    if (ids.size) deck = all.filter((c) => ids.has(c.id));
  } else if (!blockParam) {
    const progress = computeProgress(plan, await countCompleted(db, req.userId));
    const block = progress.block ? findBlock(plan, progress.block.id) : blockForWeek(plan, 1);
    const ids = new Set(block?.playCards || []);
    if (ids.size) deck = all.filter((c) => ids.has(c.id));
  }
  if (req.query.exclude && deck.length > 1) {
    deck = deck.filter((c) => c.id !== req.query.exclude);
  }
  const card = pickRandom(deck);
  if (!card) return res.status(404).json({ error: 'Leken är tom' });
  res.json({ card, deckSize: deck.length });
}));

export default router;
