-- Seed data for Test user
-- This file is generated automatically. Do not edit manually.

-- Phases
INSERT OR REPLACE INTO phases (id, user_id, name, display_order, created_at) VALUES (1, 1, 'På tork', 1, '2025-12-22 23:41:24');
INSERT OR REPLACE INTO phases (id, user_id, name, display_order, created_at) VALUES (2, 1, 'Skröjbränd', 2, '2025-12-22 23:41:24');
INSERT OR REPLACE INTO phases (id, user_id, name, display_order, created_at) VALUES (3, 1, 'Glaserad', 3, '2025-12-22 23:41:24');
INSERT OR REPLACE INTO phases (id, user_id, name, display_order, created_at) VALUES (4, 1, 'Glasyrbränd', 4, '2025-12-22 23:41:24');

-- Materials
INSERT OR REPLACE INTO materials (id, user_id, name, type, created_at) VALUES (1, 1, 'Gråmelerad 3221', 'clay', '2025-12-22 23:42:36');
INSERT OR REPLACE INTO materials (id, user_id, name, type, created_at) VALUES (2, 1, 'Engobe Lila', 'other', '2025-12-22 23:42:45');
INSERT OR REPLACE INTO materials (id, user_id, name, type, created_at) VALUES (3, 1, 'Lera 1321', 'clay', '2025-12-22 23:42:52');
INSERT OR REPLACE INTO materials (id, user_id, name, type, created_at) VALUES (4, 1, 'Lera 1443', 'clay', '2025-12-22 23:42:59');
INSERT OR REPLACE INTO materials (id, user_id, name, type, created_at) VALUES (5, 1, 'Ljusblå 3399', 'glaze', '2025-12-22 23:43:11');
INSERT OR REPLACE INTO materials (id, user_id, name, type, created_at) VALUES (6, 1, 'Toppenglasyr - Gul', 'glaze', '2025-12-22 23:43:23');

-- Ceramic Pieces
INSERT OR REPLACE INTO ceramic_pieces (id, user_id, name, description, current_phase_id, done, created_at, updated_at) VALUES (1, 1, 'Skål', NULL, 1, 0, '2025-12-22 23:42:27', '2025-12-22 23:42:27');
INSERT OR REPLACE INTO ceramic_pieces (id, user_id, name, description, current_phase_id, done, created_at, updated_at) VALUES (2, 1, 'Kruka', 'En toppenkruka', 2, 0, '2025-12-22 23:44:14', '2025-12-22 23:44:14');
INSERT OR REPLACE INTO ceramic_pieces (id, user_id, name, description, current_phase_id, done, created_at, updated_at) VALUES (3, 1, 'En gammal vas', 'Färdig vas sedan gammalt', 4, 1, '2025-12-22 23:44:37', '2025-12-22 23:44:37');
INSERT OR REPLACE INTO ceramic_pieces (id, user_id, name, description, current_phase_id, done, created_at, updated_at) VALUES (4, 1, 'Tallrik med mönster', NULL, 3, 0, '2025-12-22 23:45:00', '2025-12-22 23:45:00');
INSERT OR REPLACE INTO ceramic_pieces (id, user_id, name, description, current_phase_id, done, created_at, updated_at) VALUES (5, 1, 'Staty', NULL, NULL, 0, '2025-12-22 23:45:22', '2025-12-22 23:45:22');

-- Piece Materials
INSERT OR REPLACE INTO piece_materials (id, piece_id, material_id) VALUES (1, 2, 1);
INSERT OR REPLACE INTO piece_materials (id, piece_id, material_id) VALUES (2, 2, 2);
INSERT OR REPLACE INTO piece_materials (id, piece_id, material_id) VALUES (4, 3, 4);
INSERT OR REPLACE INTO piece_materials (id, piece_id, material_id) VALUES (3, 3, 5);
INSERT OR REPLACE INTO piece_materials (id, piece_id, material_id) VALUES (7, 4, 2);
INSERT OR REPLACE INTO piece_materials (id, piece_id, material_id) VALUES (5, 4, 3);
INSERT OR REPLACE INTO piece_materials (id, piece_id, material_id) VALUES (6, 4, 6);
INSERT OR REPLACE INTO piece_materials (id, piece_id, material_id) VALUES (8, 5, 4);

-- Piece Images
INSERT OR REPLACE INTO piece_images (id, piece_id, phase_id, filename, original_filename, created_at) VALUES (1, 2, 4, '1766447240742-919453851.jpg', 'pexels-fotios-photos-834657.jpg', '2025-12-22 23:47:22');
INSERT OR REPLACE INTO piece_images (id, piece_id, phase_id, filename, original_filename, created_at) VALUES (4, 3, 2, '1766447788027-700235695.png', 'Screenshot 2025-12-23 005559.png', '2025-12-22 23:56:28');
INSERT OR REPLACE INTO piece_images (id, piece_id, phase_id, filename, original_filename, created_at) VALUES (5, 3, 3, '1766447836076-570437015.png', 'Screenshot 2025-12-23 005659.png', '2025-12-22 23:57:16');
INSERT OR REPLACE INTO piece_images (id, piece_id, phase_id, filename, original_filename, created_at) VALUES (3, 4, 3, '1766447636741-639504262.png', 'Screenshot 2025-12-23 005316.png', '2025-12-22 23:53:57');

