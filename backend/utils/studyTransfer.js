/**
 * Export, import och kopiering av Studie-data mellan användare.
 * Används av arkivet (utils/archive.js) och tools/copy-user.mjs, så att båda
 * mappar om id:n (alster, faser, material, pass) på samma sätt.
 */

/** Tabellerna som tas med, i den ordning de skrivs till arkivet. */
export const STUDY_EXPORT_FILES = [
  'study_plans',
  'study_plan_revisions',
  'study_stage_phase_map',
  'study_sessions',
  'study_session_pieces',
  'study_gate_checks',
  'study_series',
  'study_log_entries',
  'study_session_images',
  'study_block_reviews',
  'study_metrics',
];

/** Läser all studiedata för en användare. */
export async function exportStudyData(db, userId) {
  return {
    study_plans: await db.all('SELECT * FROM study_plans WHERE user_id = ? ORDER BY id', [userId]),
    study_plan_revisions: await db.all('SELECT * FROM study_plan_revisions WHERE user_id = ? ORDER BY id', [userId]),
    study_stage_phase_map: await db.all('SELECT * FROM study_stage_phase_map WHERE user_id = ?', [userId]),
    study_sessions: await db.all('SELECT * FROM study_sessions WHERE user_id = ? ORDER BY id', [userId]),
    study_session_pieces: await db.all(
      `SELECT sp.* FROM study_session_pieces sp
       JOIN study_sessions s ON s.id = sp.session_id
       WHERE s.user_id = ? ORDER BY sp.id`,
      [userId]
    ),
    study_gate_checks: await db.all('SELECT * FROM study_gate_checks WHERE user_id = ? ORDER BY id', [userId]),
    study_series: await db.all('SELECT * FROM study_series WHERE user_id = ? ORDER BY id', [userId]),
    study_log_entries: await db.all('SELECT * FROM study_log_entries WHERE user_id = ? ORDER BY id', [userId]),
    study_session_images: await db.all('SELECT * FROM study_session_images WHERE user_id = ? ORDER BY id', [userId]),
    study_block_reviews: await db.all('SELECT * FROM study_block_reviews WHERE user_id = ? ORDER BY id', [userId]),
    study_metrics: await db.all('SELECT * FROM study_metrics WHERE user_id = ? ORDER BY id', [userId]),
  };
}

/**
 * Raderar en användares studiedata (för copy-user --wipe).
 * Fotofilerna på disk lämnas kvar; copy-user kopierar dem till egna namn.
 */
export async function deleteStudyData(db, userId) {
  await db.run(
    'DELETE FROM study_session_pieces WHERE session_id IN (SELECT id FROM study_sessions WHERE user_id = ?)',
    [userId]
  );
  for (const table of ['study_metrics', 'study_block_reviews', 'study_session_images', 'study_log_entries', 'study_series', 'study_gate_checks', 'study_sessions', 'study_stage_phase_map', 'study_plan_revisions', 'study_plans']) {
    await db.run(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
  }
}

const lookup = (m) => (id) => {
  if (id === null || id === undefined) return null;
  if (m instanceof Map) return m.get(id) ?? null;
  return m?.[id] ?? null;
};

/**
 * Skriver in studiedata hos målanvändaren och mappar om främmande nycklar.
 * Har målet redan en plan behålls den, och passen kopplas till den.
 * @param {object} data   som från exportStudyData (saknade nycklar = tomt)
 * @param {object} maps   { pieces, phases, materials, pieceImages } som Map eller objekt (gammalt id → nytt)
 *                        och valfritt copyFile(filnamn) → nytt filnamn för studiefoton
 */
export async function importStudyData(db, data, targetUserId, maps = {}) {
  const piece = lookup(maps.pieces);
  const phase = lookup(maps.phases);
  const material = lookup(maps.materials);
  const pieceImage = lookup(maps.pieceImages);
  const counts = { plans: 0, sessions: 0, sessionPieces: 0, series: 0, gateChecks: 0, logEntries: 0, images: 0, reviews: 0, metrics: 0 };

  const plans = data.study_plans || [];
  const planMap = new Map();
  const existingPlan = await db.get('SELECT id FROM study_plans WHERE user_id = ?', [targetUserId]);
  for (const p of plans) {
    if (existingPlan) {
      planMap.set(p.id, existingPlan.id);
      continue;
    }
    const r = await db.run(
      'INSERT INTO study_plans (user_id, version, title, json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [targetUserId, p.version, p.title, p.json, p.created_at, p.updated_at]
    );
    planMap.set(p.id, r.lastID);
    counts.plans++;
    for (const rev of (data.study_plan_revisions || []).filter((x) => x.plan_id === p.id)) {
      await db.run(
        'INSERT INTO study_plan_revisions (plan_id, user_id, created_at, author, summary, snapshot, ai_prompt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [r.lastID, targetUserId, rev.created_at, rev.author, rev.summary, rev.snapshot, rev.ai_prompt]
      );
    }
    break; // en plan per användare
  }

  for (const m of data.study_stage_phase_map || []) {
    await db.run(
      'INSERT OR IGNORE INTO study_stage_phase_map (user_id, stage_id, phase_id) VALUES (?, ?, ?)',
      [targetUserId, m.stage_id, phase(m.phase_id)]
    );
  }

  const sessionMap = new Map();
  for (const s of data.study_sessions || []) {
    const r = await db.run(
      `INSERT INTO study_sessions
         (user_id, plan_id, plan_block_id, week_number, date, is_free, goal, planned_start,
          started_at, ended_at, segments_json, challenge_card_id, created_at, timer_mode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        targetUserId, planMap.get(s.plan_id) ?? existingPlan?.id ?? null, s.plan_block_id, s.week_number,
        s.date, s.is_free, s.goal, s.planned_start, s.started_at, s.ended_at, s.segments_json,
        s.challenge_card_id, s.created_at, s.timer_mode ?? null,
      ]
    );
    sessionMap.set(s.id, r.lastID);
    counts.sessions++;
  }

  for (const sp of data.study_session_pieces || []) {
    const sessionId = sessionMap.get(sp.session_id);
    const pieceId = piece(sp.piece_id);
    if (!sessionId || !pieceId) continue;
    await db.run(
      'INSERT OR IGNORE INTO study_session_pieces (session_id, piece_id, action, created_at) VALUES (?, ?, ?, ?)',
      [sessionId, pieceId, sp.action, sp.created_at]
    );
    counts.sessionPieces++;
  }

  for (const g of data.study_gate_checks || []) {
    await db.run(
      'INSERT OR IGNORE INTO study_gate_checks (user_id, plan_block_id, gate_index, checked_at) VALUES (?, ?, ?, ?)',
      [targetUserId, g.plan_block_id, g.gate_index, g.checked_at]
    );
    counts.gateChecks++;
  }

  // Serienumren är unika per användare. Krockar de förskjuts de importerade.
  const series = data.study_series || [];
  if (series.length) {
    const max = (await db.get('SELECT MAX(number) AS n FROM study_series WHERE user_id = ?', [targetUserId]))?.n || 0;
    const offset = max > 0 ? max : 0;
    for (const s of series) {
      await db.run(
        'INSERT INTO study_series (user_id, number, session_id, name, weight_grams, clay_material_id, count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [targetUserId, s.number + offset, sessionMap.get(s.session_id) ?? null, s.name, s.weight_grams,
          material(s.clay_material_id), s.count, s.created_at]
      );
      counts.series++;
    }
  }

  for (const l of data.study_log_entries || []) {
    const sessionId = sessionMap.get(l.session_id);
    if (!sessionId) continue;
    await db.run(
      `INSERT OR IGNORE INTO study_log_entries (session_id, user_id, goal_and_measure, observation, change,
         clay_material_id, weight_grams, series_number, into_damp_box, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, targetUserId, l.goal_and_measure, l.observation, l.change, material(l.clay_material_id),
        l.weight_grams, l.series_number, l.into_damp_box, l.created_at, l.updated_at]
    );
    counts.logEntries++;
  }

  for (const img of data.study_session_images || []) {
    const sessionId = sessionMap.get(img.session_id);
    if (!sessionId) continue;
    const filename = maps.copyFile ? maps.copyFile(img.filename) : img.filename;
    if (!filename) continue;
    await db.run(
      `INSERT INTO study_session_images (session_id, user_id, piece_id, piece_image_id, filename, original_filename, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, targetUserId, piece(img.piece_id), pieceImage(img.piece_image_id), filename, img.original_filename, img.created_at]
    );
    counts.images++;
  }

  const existingReviews = new Set(
    (await db.all('SELECT plan_block_id FROM study_block_reviews WHERE user_id = ?', [targetUserId])).map((r) => r.plan_block_id)
  );
  for (const r of data.study_block_reviews || []) {
    if (existingReviews.has(r.plan_block_id)) continue;
    await db.run(
      `INSERT INTO study_block_reviews (user_id, plan_id, plan_block_id, created_at, answers_json, next_goals, new_card_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [targetUserId, planMap.get(r.plan_id) ?? existingPlan?.id ?? null, r.plan_block_id, r.created_at, r.answers_json, r.next_goals, r.new_card_id]
    );
    counts.reviews++;
  }

  for (const m of data.study_metrics || []) {
    await db.run(
      `INSERT INTO study_metrics (user_id, plan_block_id, metric_id, value, measured_at, session_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [targetUserId, m.plan_block_id, m.metric_id, m.value, m.measured_at, sessionMap.get(m.session_id) ?? null, m.note, m.created_at]
    );
    counts.metrics++;
  }

  return counts;
}
