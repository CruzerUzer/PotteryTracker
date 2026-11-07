/**
 * Studie modul 4: glasyrtester, minsta version.
 * Provplattor med lera, glasyr (Material) eller eget recept, applicering,
 * bränning, resultat och foto, valfritt kopplade till ett pass.
 * Linjeblandning kommer senare.
 */
import express from 'express';
import { existsSync, unlinkSync } from 'fs';
import { getDb } from '../utils/db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireStudy } from '../middleware/study.js';
import upload, { optimizeImage } from '../middleware/upload.js';
import logger from '../utils/logger.js';
import { getImagePath, getThumbnailPath } from '../utils/paths.js';
import { handle } from './study.js';

const router = express.Router();
router.use(requireAuth);
router.use(requireStudy);

export const METHODS = ['dip', 'brush', 'pour', 'spray', 'other'];
const TEXT_MAX = 2000;
const text = (v, max = TEXT_MAX) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const intOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
};
const numOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};
const thumbName = (f) => f.replace(/\.[^/.]+$/, '.jpg');
const removeFiles = (filename) => {
  for (const p of [getImagePath(filename), getThumbnailPath(thumbName(filename))]) {
    try {
      if (existsSync(p)) unlinkSync(p);
    } catch (e) {
      logger.warn('Could not remove glaze image file', { error: e.message });
    }
  }
};

// ─── Recept ─────────────────────────────────────────────────────────

/** Ingredienser [{ material, percent }]; summan behöver inte vara exakt 100. */
export function sanitizeIngredients(input) {
  if (!Array.isArray(input) || input.length > 40) return null;
  const out = [];
  for (const row of input) {
    const material = text(row?.material, 80);
    const percent = numOrNull(row?.percent);
    if (!material && (percent === null || percent === 0)) continue; // tom rad
    if (!material || percent === null || Number.isNaN(percent) || percent < 0 || percent > 1000) return null;
    out.push({ material, percent: Math.round(percent * 100) / 100 });
  }
  return out;
}

const formatRecipe = (r) => ({ ...r, ingredients: JSON.parse(r.ingredients_json || '[]') });

router.get('/glaze/recipes', handle('hämta recepten', async (req, res) => {
  const db = await getDb();
  const rows = await db.all('SELECT * FROM glaze_recipes WHERE user_id = ? ORDER BY name COLLATE NOCASE', [req.userId]);
  res.json(rows.map(formatRecipe));
}));

async function saveRecipe(req, res, id) {
  const db = await getDb();
  const b = req.body || {};
  const name = text(b.name, 80);
  if (!name) return res.status(400).json({ error: 'Receptet behöver ett namn' });
  const ingredients = sanitizeIngredients(b.ingredients || []);
  if (!ingredients) return res.status(400).json({ error: 'Varje ingrediens behöver namn och procent' });
  const values = [name, text(b.cone, 20), JSON.stringify(ingredients), text(b.notes)];
  if (id) {
    const r = await db.run(
      "UPDATE glaze_recipes SET name = ?, cone = ?, ingredients_json = ?, notes = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?",
      [...values, id, req.userId]
    );
    if (!r.changes) return res.status(404).json({ error: 'Receptet hittades inte' });
    return res.json(formatRecipe(await db.get('SELECT * FROM glaze_recipes WHERE id = ?', [id])));
  }
  const r = await db.run(
    'INSERT INTO glaze_recipes (user_id, name, cone, ingredients_json, notes) VALUES (?, ?, ?, ?, ?)',
    [req.userId, ...values]
  );
  return res.status(201).json(formatRecipe(await db.get('SELECT * FROM glaze_recipes WHERE id = ?', [r.lastID])));
}

router.post('/glaze/recipes', handle('spara receptet', (req, res) => saveRecipe(req, res, null)));
router.put('/glaze/recipes/:id', handle('spara receptet', (req, res) => saveRecipe(req, res, Number(req.params.id))));

router.delete('/glaze/recipes/:id', handle('ta bort receptet', async (req, res) => {
  const db = await getDb();
  const r = await db.run('DELETE FROM glaze_recipes WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!r.changes) return res.status(404).json({ error: 'Receptet hittades inte' });
  await db.run('UPDATE glaze_tests SET recipe_id = NULL WHERE recipe_id = ? AND user_id = ?', [req.params.id, req.userId]);
  res.json({ message: 'Receptet är borttaget' });
}));

// ─── Provplattor ────────────────────────────────────────────────────

const TEST_SELECT = `
  SELECT t.*, c.name AS clay_name, g.name AS glaze_name, r.name AS recipe_name,
    s.date AS session_date, s.week_number AS session_week, s.is_free AS session_is_free,
    (SELECT i.id FROM glaze_test_images i WHERE i.glaze_test_id = t.id ORDER BY i.id DESC LIMIT 1) AS image_id,
    (SELECT COUNT(*) FROM glaze_test_images i WHERE i.glaze_test_id = t.id) AS image_count
  FROM glaze_tests t
  LEFT JOIN materials c ON c.id = t.clay_material_id AND c.user_id = t.user_id
  LEFT JOIN materials g ON g.id = t.glaze_material_id AND g.user_id = t.user_id
  LEFT JOIN glaze_recipes r ON r.id = t.recipe_id AND r.user_id = t.user_id
  LEFT JOIN study_sessions s ON s.id = t.session_id AND s.user_id = t.user_id
`;

router.get('/glaze/tests', handle('hämta provplattorna', async (req, res) => {
  const db = await getDb();
  const params = [req.userId];
  let where = 't.user_id = ?';
  if (req.query.session_id) {
    where += ' AND t.session_id = ?';
    params.push(req.query.session_id);
  }
  const rows = await db.all(`${TEST_SELECT} WHERE ${where} ORDER BY t.created_at DESC, t.id DESC`, params);
  res.json(rows);
}));

router.get('/glaze/tests/next-code', handle('föreslå en kod', async (req, res) => {
  res.json({ code: await nextTileCode(await getDb(), req.userId) });
}));

router.get('/glaze/tests/:id', handle('hämta provplattan', async (req, res) => {
  const db = await getDb();
  const row = await db.get(`${TEST_SELECT} WHERE t.id = ? AND t.user_id = ?`, [req.params.id, req.userId]);
  if (!row) return res.status(404).json({ error: 'Provplattan hittades inte' });
  const images = await db.all('SELECT id, created_at FROM glaze_test_images WHERE glaze_test_id = ? AND user_id = ? ORDER BY id', [row.id, req.userId]);
  res.json({ ...row, images });
}));

/** Nästa lediga kod P1, P2, … för användaren. */
export async function nextTileCode(db, userId) {
  const rows = await db.all("SELECT tile_code FROM glaze_tests WHERE user_id = ? AND tile_code LIKE 'P%'", [userId]);
  const max = rows.reduce((m, r) => {
    const n = Number(String(r.tile_code).slice(1));
    return Number.isInteger(n) && n > m ? n : m;
  }, 0);
  return `P${max + 1}`;
}

async function validateTest(db, userId, b) {
  const clayId = intOrNull(b.clay_material_id);
  const glazeId = intOrNull(b.glaze_material_id);
  const recipeId = intOrNull(b.recipe_id);
  const sessionId = intOrNull(b.session_id);
  const coats = intOrNull(b.coats);
  const dip = numOrNull(b.dip_seconds);
  if ([clayId, glazeId, recipeId, sessionId, coats].some(Number.isNaN) || Number.isNaN(dip)) {
    return { error: 'Ogiltigt värde i formuläret' };
  }
  if (b.method && !METHODS.includes(b.method)) return { error: 'Okänd appliceringsmetod' };
  if (coats !== null && (coats < 1 || coats > 20)) return { error: 'Antal lager ska vara 1–20' };
  if (dip !== null && (dip < 0 || dip > 120)) return { error: 'Doppet ska vara 0–120 sekunder' };
  if (clayId && !(await db.get("SELECT id FROM materials WHERE id = ? AND user_id = ?", [clayId, userId]))) {
    return { error: 'Leran finns inte bland dina material' };
  }
  if (glazeId && !(await db.get("SELECT id FROM materials WHERE id = ? AND user_id = ?", [glazeId, userId]))) {
    return { error: 'Glasyren finns inte bland dina material' };
  }
  if (recipeId && !(await db.get('SELECT id FROM glaze_recipes WHERE id = ? AND user_id = ?', [recipeId, userId]))) {
    return { error: 'Receptet finns inte' };
  }
  if (sessionId && !(await db.get('SELECT id FROM study_sessions WHERE id = ? AND user_id = ?', [sessionId, userId]))) {
    return { error: 'Passet finns inte' };
  }
  return {
    values: {
      session_id: sessionId,
      clay_material_id: clayId,
      glaze_material_id: glazeId,
      recipe_id: recipeId,
      method: b.method || null,
      dip_seconds: dip,
      coats,
      layering: text(b.layering, 200),
      firing: text(b.firing, 200),
      result: text(b.result),
    },
  };
}

router.post('/glaze/tests', handle('spara provplattan', async (req, res) => {
  const db = await getDb();
  const b = req.body || {};
  const v = await validateTest(db, req.userId, b);
  if (v.error) return res.status(400).json({ error: v.error });
  const code = text(b.tile_code, 40) || (await nextTileCode(db, req.userId));
  const x = v.values;
  const r = await db.run(
    `INSERT INTO glaze_tests (user_id, session_id, tile_code, clay_material_id, glaze_material_id, recipe_id,
       method, dip_seconds, coats, layering, firing, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.userId, x.session_id, code, x.clay_material_id, x.glaze_material_id, x.recipe_id, x.method,
      x.dip_seconds, x.coats, x.layering, x.firing, x.result]
  );
  logger.info('Glaze test created', { userId: req.userId, id: r.lastID, code });
  res.status(201).json(await db.get(`${TEST_SELECT} WHERE t.id = ?`, [r.lastID]));
}));

router.put('/glaze/tests/:id', handle('spara provplattan', async (req, res) => {
  const db = await getDb();
  const existing = await db.get('SELECT id, tile_code FROM glaze_tests WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Provplattan hittades inte' });
  const b = req.body || {};
  const v = await validateTest(db, req.userId, b);
  if (v.error) return res.status(400).json({ error: v.error });
  const x = v.values;
  await db.run(
    `UPDATE glaze_tests SET tile_code = ?, session_id = ?, clay_material_id = ?, glaze_material_id = ?, recipe_id = ?,
       method = ?, dip_seconds = ?, coats = ?, layering = ?, firing = ?, result = ?, updated_at = datetime('now')
     WHERE id = ? AND user_id = ?`,
    [text(b.tile_code, 40) || existing.tile_code, x.session_id, x.clay_material_id, x.glaze_material_id, x.recipe_id,
      x.method, x.dip_seconds, x.coats, x.layering, x.firing, x.result, existing.id, req.userId]
  );
  res.json(await db.get(`${TEST_SELECT} WHERE t.id = ?`, [existing.id]));
}));

router.delete('/glaze/tests/:id', handle('ta bort provplattan', async (req, res) => {
  const db = await getDb();
  const existing = await db.get('SELECT id FROM glaze_tests WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
  if (!existing) return res.status(404).json({ error: 'Provplattan hittades inte' });
  const images = await db.all('SELECT filename FROM glaze_test_images WHERE glaze_test_id = ?', [existing.id]);
  await db.run('DELETE FROM glaze_test_images WHERE glaze_test_id = ?', [existing.id]);
  await db.run('DELETE FROM glaze_tests WHERE id = ?', [existing.id]);
  for (const img of images || []) removeFiles(img.filename);
  res.json({ message: 'Provplattan är borttagen' });
}));

// ─── Foton ──────────────────────────────────────────────────────────

router.post(
  '/glaze/tests/:id/images',
  upload.single('image'),
  (err, req, res, next) => {
    if (err) return res.status(400).json({ error: err.message || 'Uppladdningen misslyckades' });
    return next();
  },
  optimizeImage,
  handle('ladda upp fotot', async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Ingen bild skickades' });
    const db = await getDb();
    const test = await db.get('SELECT id FROM glaze_tests WHERE id = ? AND user_id = ?', [req.params.id, req.userId]);
    if (!test) {
      removeFiles(req.file.filename);
      return res.status(404).json({ error: 'Provplattan hittades inte' });
    }
    const r = await db.run(
      'INSERT INTO glaze_test_images (glaze_test_id, user_id, filename, original_filename) VALUES (?, ?, ?, ?)',
      [test.id, req.userId, req.file.filename, req.file.originalname]
    );
    res.status(201).json({ id: r.lastID });
  })
);

router.get('/glaze-images/:imageId/file', handle('visa fotot', async (req, res) => {
  const db = await getDb();
  const img = await db.get('SELECT filename FROM glaze_test_images WHERE id = ? AND user_id = ?', [req.params.imageId, req.userId]);
  if (!img) return res.status(404).json({ error: 'Fotot hittades inte' });
  if (req.query.thumbnail === 'true') {
    const t = getThumbnailPath(thumbName(img.filename));
    if (existsSync(t)) return res.sendFile(t);
  }
  const p = getImagePath(img.filename);
  if (!existsSync(p)) return res.status(404).json({ error: 'Filen saknas' });
  return res.sendFile(p);
}));

router.delete('/glaze-images/:imageId', handle('ta bort fotot', async (req, res) => {
  const db = await getDb();
  const img = await db.get('SELECT id, filename FROM glaze_test_images WHERE id = ? AND user_id = ?', [req.params.imageId, req.userId]);
  if (!img) return res.status(404).json({ error: 'Fotot hittades inte' });
  await db.run('DELETE FROM glaze_test_images WHERE id = ?', [img.id]);
  removeFiles(img.filename);
  res.json({ message: 'Fotot är borttaget' });
}));

export default router;
