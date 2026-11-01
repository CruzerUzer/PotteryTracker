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
  };
}

/** Raderar en användares studiedata (för copy-user --wipe). */
export async function deleteStudyData(db, userId) {
  await db.run(
    'DELETE FROM study_session_pieces WHERE session_id IN (SELECT id FROM study_sessions WHERE user_id = ?)',
    [userId]
  );
  for (const table of ['study_series', 'study_gate_checks', 'study_sessions', 'study_stage_phase_map', 'study_plan_revisions', 'study_plans']) {
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
 * @param {object} maps   { pieces, phases, materials } som Map eller objekt (gammalt id → nytt)
 */
export async function importStudyData(db, data, targetUserId, maps = {}) {
  const piece = lookup(maps.pieces);
  const phase = lookup(maps.phases);
  const material = lookup(maps.materials);
  const counts = { plans: 0, sessions: 0, sessionPieces: 0, series: 0, gateChecks: 0 };

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
          started_at, ended_at, segments_json, challenge_card_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        targetUserId, planMap.get(s.plan_id) ?? existingPlan?.id ?? null, s.plan_block_id, s.week_number,
        s.date, s.is_free, s.goal, s.planned_start, s.started_at, s.ended_at, s.segments_json,
        s.challenge_card_id, s.created_at,
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

  return counts;
}
