-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    last_login TEXT,
    must_change_password INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Phases table
CREATE TABLE IF NOT EXISTS phases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, name)
);

-- Locations table
CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, name)
);

-- Materials table
CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('clay', 'glaze', 'other')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Ceramic pieces table
CREATE TABLE IF NOT EXISTS ceramic_pieces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    current_phase_id INTEGER,
    current_location_id INTEGER,
    done INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (current_phase_id) REFERENCES phases(id),
    FOREIGN KEY (current_location_id) REFERENCES locations(id)
);

-- Junction table for piece-materials relationship
CREATE TABLE IF NOT EXISTS piece_materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    piece_id INTEGER NOT NULL,
    material_id INTEGER NOT NULL,
    FOREIGN KEY (piece_id) REFERENCES ceramic_pieces(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
    UNIQUE(piece_id, material_id)
);

-- Images table
CREATE TABLE IF NOT EXISTS piece_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    piece_id INTEGER NOT NULL,
    phase_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    original_filename TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (piece_id) REFERENCES ceramic_pieces(id) ON DELETE CASCADE,
    FOREIGN KEY (phase_id) REFERENCES phases(id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_phases_user ON phases(user_id);
CREATE INDEX IF NOT EXISTS idx_materials_user ON materials(user_id);
CREATE INDEX IF NOT EXISTS idx_pieces_user ON ceramic_pieces(user_id);
CREATE INDEX IF NOT EXISTS idx_pieces_phase ON ceramic_pieces(current_phase_id);
CREATE INDEX IF NOT EXISTS idx_pieces_location ON ceramic_pieces(current_location_id);
CREATE INDEX IF NOT EXISTS idx_locations_user ON locations(user_id);
CREATE INDEX IF NOT EXISTS idx_piece_materials_piece ON piece_materials(piece_id);
CREATE INDEX IF NOT EXISTS idx_piece_materials_material ON piece_materials(material_id);
CREATE INDEX IF NOT EXISTS idx_piece_images_piece ON piece_images(piece_id);

-- System settings table
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User archives table
CREATE TABLE IF NOT EXISTS user_archives (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT NOT NULL,
    archive_filename TEXT NOT NULL UNIQUE,
    is_encrypted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    file_size INTEGER
);

-- Initialize system settings
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('registration_enabled', '1');


