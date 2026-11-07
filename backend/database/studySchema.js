/**
 * Tabeller för Studie-modulen (design/STUDIE_PLAN.md).
 *
 * Idempotent: körs både av migrationsskriptet (migrate_study.js, som
 * update-potterytracker.sh kör) och vid serverstart (utils/db.js), så att
 * en server som missat migrationen ändå får rätt schema.
 *
 * Planens "faser" heter block i kod och databas (plan_block_id) för att inte
 * blandas ihop med appens faser (processsteg).
 */

export const STUDY_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS study_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    version INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_plan_revisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    author TEXT NOT NULL CHECK(author IN ('seed', 'user', 'file', 'ai')),
    summary TEXT,
    snapshot TEXT NOT NULL,
    ai_prompt TEXT,
    FOREIGN KEY (plan_id) REFERENCES study_plans(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_stage_phase_map (
    user_id INTEGER NOT NULL,
    stage_id TEXT NOT NULL CHECK(stage_id IN ('thrown', 'trimmed', 'bisque', 'glazed', 'done')),
    phase_id INTEGER,
    PRIMARY KEY (user_id, stage_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (phase_id) REFERENCES phases(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS study_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_id INTEGER,
    plan_block_id TEXT,
    week_number INTEGER,
    date TEXT NOT NULL,
    is_free INTEGER NOT NULL DEFAULT 0,
    goal TEXT,
    planned_start TEXT,
    started_at TEXT,
    ended_at TEXT,
    segments_json TEXT,
    challenge_card_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES study_plans(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS study_session_pieces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    piece_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('thrown', 'trimmed', 'handled', 'decorated', 'glazed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(session_id, piece_id, action),
    FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (piece_id) REFERENCES ceramic_pieces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_gate_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_block_id TEXT NOT NULL,
    gate_index INTEGER NOT NULL,
    checked_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, plan_block_id, gate_index),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    number INTEGER NOT NULL,
    session_id INTEGER,
    name TEXT NOT NULL,
    weight_grams INTEGER,
    clay_material_id INTEGER,
    count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, number),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE SET NULL
);

-- Modul 3: loggbok, foton, blockutvärdering, mått
CREATE TABLE IF NOT EXISTS study_log_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    goal_and_measure TEXT,
    observation TEXT,
    change TEXT,
    clay_material_id INTEGER,
    weight_grams INTEGER,
    series_number TEXT,
    into_damp_box TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_session_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    piece_id INTEGER,
    piece_image_id INTEGER,
    filename TEXT NOT NULL,
    original_filename TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_block_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_id INTEGER,
    plan_block_id TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    answers_json TEXT NOT NULL,
    next_goals TEXT,
    new_card_id TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS study_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plan_block_id TEXT,
    metric_id TEXT NOT NULL,
    value REAL NOT NULL,
    measured_at TEXT NOT NULL,
    session_id INTEGER,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Modul 4: glasyrtester (minsta version)
CREATE TABLE IF NOT EXISTS glaze_recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    cone TEXT,
    ingredients_json TEXT NOT NULL DEFAULT '[]',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS glaze_tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_id INTEGER,
    tile_code TEXT NOT NULL,
    clay_material_id INTEGER,
    glaze_material_id INTEGER,
    recipe_id INTEGER,
    method TEXT CHECK(method IN ('dip', 'brush', 'pour', 'spray', 'other')),
    dip_seconds REAL,
    coats INTEGER,
    layering TEXT,
    firing TEXT,
    result TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipe_id) REFERENCES glaze_recipes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS glaze_test_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    glaze_test_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_filename TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (glaze_test_id) REFERENCES glaze_tests(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Egna anteckningar och länkar inför ett pass (knutna till veckan, inte planen,
-- så att de överlever när planen uppdateras)
CREATE TABLE IF NOT EXISTS study_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'note' CHECK(type IN ('note', 'video', 'read', 'book', 'visit')),
    title TEXT NOT NULL,
    url TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_study_notes_user ON study_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_glaze_recipes_user ON glaze_recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_glaze_tests_user ON glaze_tests(user_id);
CREATE INDEX IF NOT EXISTS idx_glaze_tests_session ON glaze_tests(session_id);
CREATE INDEX IF NOT EXISTS idx_glaze_test_images_test ON glaze_test_images(glaze_test_id);
CREATE INDEX IF NOT EXISTS idx_study_log_entries_user ON study_log_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_study_session_images_session ON study_session_images(session_id);
CREATE INDEX IF NOT EXISTS idx_study_block_reviews_user ON study_block_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_study_metrics_user ON study_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_study_plans_user ON study_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_study_plan_revisions_plan ON study_plan_revisions(plan_id);
CREATE INDEX IF NOT EXISTS idx_study_plan_revisions_user ON study_plan_revisions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_session_pieces_session ON study_session_pieces(session_id);
CREATE INDEX IF NOT EXISTS idx_study_session_pieces_piece ON study_session_pieces(piece_id);
CREATE INDEX IF NOT EXISTS idx_study_gate_checks_user ON study_gate_checks(user_id);
CREATE INDEX IF NOT EXISTS idx_study_series_user ON study_series(user_id);
`;

/**
 * Lägger till users.study_enabled och skapar studietabellerna om de saknas.
 * @param {import('sqlite').Database} db  öppnad med paketet 'sqlite'
 * @returns {Promise<{addedColumn: boolean}>}
 */
export async function ensureStudySchema(db) {
  const cols = await db.all('PRAGMA table_info(users)');
  let addedColumn = false;
  if (cols.length > 0 && !cols.some((c) => c.name === 'study_enabled')) {
    await db.run('ALTER TABLE users ADD COLUMN study_enabled INTEGER DEFAULT 0');
    addedColumn = true;
  }
  await db.exec(STUDY_TABLES_SQL);

  // Modul 2: hur timern startades ('now' | 'clock' | 'countdown')
  const sessionCols = await db.all('PRAGMA table_info(study_sessions)');
  if (!sessionCols.some((c) => c.name === 'timer_mode')) {
    await db.run('ALTER TABLE study_sessions ADD COLUMN timer_mode TEXT');
  }
  return { addedColumn };
}
