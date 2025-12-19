-- Phases table
CREATE TABLE IF NOT EXISTS phases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    display_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Materials table
CREATE TABLE IF NOT EXISTS materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('clay', 'glaze', 'other')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ceramic pieces table
CREATE TABLE IF NOT EXISTS ceramic_pieces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    current_phase_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (current_phase_id) REFERENCES phases(id)
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
CREATE INDEX IF NOT EXISTS idx_pieces_phase ON ceramic_pieces(current_phase_id);
CREATE INDEX IF NOT EXISTS idx_piece_materials_piece ON piece_materials(piece_id);
CREATE INDEX IF NOT EXISTS idx_piece_materials_material ON piece_materials(material_id);
CREATE INDEX IF NOT EXISTS idx_piece_images_piece ON piece_images(piece_id);


