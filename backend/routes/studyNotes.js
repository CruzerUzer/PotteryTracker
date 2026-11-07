/**
 * Studie: egna anteckningar och länkar inför ett pass.
 * Ägaren sitter och tittar på en video, kommer på något att tänka på och vill
 * lägga in det på rätt pass direkt. Anteckningarna knyts till veckonumret,
 * inte till planens JSON, så de överlever när planen uppdateras.
 */
import express from 'express';
import { getDb } from '../utils/db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireStudy } from '../middleware/study.js';
import logger from '../utils/logger.js';
import { computeProgress, planWeeks } from '../utils/studyPlan.js';
import { getOrSeedPlan, countCompleted, handle, formatNote } from './study.js';

const router = express.Router();
router.use(requireAuth);
router.use(requireStudy);

export const NOTE_TYPES = ['note', 'video', 'read', 'book', 'visit'];
const URL_RE = /^https?:\/\/\S+$/i;

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** "youtube.com/watch?v=…" blir "https://youtube.com/watch?v=…"; tomt blir null. */
export function normalizeUrl(input) {
  const raw = text(input, 1000);
  if (!raw) return null;
  const url = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`; // har redan schema (http:, mailto: …)
  if (!URL_RE.test(url)) return undefined; // ogiltig
  try {
    const u = new URL(url);
    if (!u.hostname.includes('.')) return undefined;
  } catch {
    return undefined;
  }
  return url;
}

/**
 * Kontrollerar och städar en anteckning från klienten.
 * @returns {{ error?: string, values?: object }}
 */
export function sanitizeNote(body, totalWeeks) {
  const b = body || {};
  const week = Number(b.week_number);
  if (!Number.isInteger(week) || week < 1 || week > totalWeeks) {
    return { error: `Passet ska vara mellan 1 och ${totalWeeks}` };
  }
  const type = b.type ? String(b.type) : 'note';
  if (!NOTE_TYPES.includes(type)) return { error: 'Okänd typ av anteckning' };
  const title = text(b.title, 200);
  if (!title) return { error: 'Skriv vad du vill komma ihåg' };
  const url = normalizeUrl(b.url);
  if (url === undefined) return { error: 'Länken ska börja med http:// eller https://' };
  const note = text(b.note, 2000) || null;
  return { values: { week_number: week, type, title, url, note } };
}

router.get('/notes', handle('hämta anteckningarna', async (req, res) => {
  const db = await getDb();
  const planRow = await getOrSeedPlan(db, req.userId);
  const progress = computeProgress(planRow.plan, await countCompleted(db, req.userId));
  const rows = await db.all(
    'SELECT * FROM study_notes WHERE user_id = ? ORDER BY week_number, created_at, id',
    [req.userId]
  );
  res.json({
    week: progress.week,
    weeks: planWeeks(planRow.plan),
    notes: rows.map(formatNote),
  });
}));

async function saveNote(req, res, id) {
  const db = await getDb();
  const planRow = await getOrSeedPlan(db, req.userId);
  const { totalWeeks } = computeProgress(planRow.plan, 0);
  const { error, values } = sanitizeNote(req.body, totalWeeks);
  if (error) return res.status(400).json({ error });
  const params = [values.week_number, values.type, values.title, values.url, values.note];
  if (id) {
    const r = await db.run(
      "UPDATE study_notes SET week_number = ?, type = ?, title = ?, url = ?, note = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?",
      [...params, id, req.userId]
    );
    if (!r.changes) return res.status(404).json({ error: 'Anteckningen hittades inte' });
    return res.json(formatNote(await db.get('SELECT * FROM study_notes WHERE id = ?', [id])));
  }
  const r = await db.run(
    'INSERT INTO study_notes (user_id, week_number, type, title, url, note) VALUES (?, ?, ?, ?, ?, ?)',
    [req.userId, ...params]
  );
  logger.info('Study note created', { userId: req.userId, noteId: r.lastID, week: values.week_number });
  return res.status(201).json(formatNote(await db.get('SELECT * FROM study_notes WHERE id = ?', [r.lastID])));
}

router.post('/notes', handle('spara anteckningen', (req, res) => saveNote(req, res, null)));

router.put('/notes/:id', handle('spara anteckningen', (req, res) => saveNote(req, res, Number(req.params.id))));

router.delete('/notes/:id', handle('ta bort anteckningen', async (req, res) => {
  const db = await getDb();
  const r = await db.run('DELETE FROM study_notes WHERE id = ? AND user_id = ?', [Number(req.params.id), req.userId]);
  if (!r.changes) return res.status(404).json({ error: 'Anteckningen hittades inte' });
  res.json({ message: 'Anteckningen är borttagen' });
}));

export default router;
