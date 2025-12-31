import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'database.db');
const seedDir = join(__dirname, 'seed');
const seedDataPath = join(seedDir, 'seed-data.sql');
const seedUploadsDir = join(seedDir, 'uploads');

// Ensure seed directory exists
if (!existsSync(seedDir)) {
  mkdirSync(seedDir, { recursive: true });
}
if (!existsSync(seedUploadsDir)) {
  mkdirSync(seedUploadsDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database.');
});

// Get Test user ID
db.get('SELECT id FROM users WHERE username = ?', ['Test'], (err, user) => {
  if (err || !user) {
    console.error('Error: Test user not found. Please create the Test user and add data first.');
    db.close();
    process.exit(1);
  }

  const userId = user.id;
  console.log(`Found Test user with ID: ${userId}`);
  console.log('Exporting seed data...');

  // Export all data for the Test user
  db.serialize(() => {
    let sqlOutput = '-- Seed data for Test user\n';
    sqlOutput += '-- This file is generated automatically. Do not edit manually.\n\n';

    // Export phases
    db.all('SELECT * FROM phases WHERE user_id = ?', [userId], (err, phases) => {
      if (err) {
        console.error('Error exporting phases:', err.message);
        return;
      }

      if (phases.length > 0) {
        sqlOutput += '-- Phases\n';
        phases.forEach(phase => {
          sqlOutput += `INSERT OR REPLACE INTO phases (id, user_id, name, display_order, created_at) VALUES (${phase.id}, ${phase.user_id}, '${phase.name.replace(/'/g, "''")}', ${phase.display_order}, '${phase.created_at}');\n`;
        });
        sqlOutput += '\n';
      }
    });

    // Export materials
    db.all('SELECT * FROM materials WHERE user_id = ?', [userId], (err, materials) => {
      if (err) {
        console.error('Error exporting materials:', err.message);
        return;
      }

      if (materials.length > 0) {
        sqlOutput += '-- Materials\n';
        materials.forEach(material => {
          sqlOutput += `INSERT OR REPLACE INTO materials (id, user_id, name, type, created_at) VALUES (${material.id}, ${material.user_id}, '${material.name.replace(/'/g, "''")}', '${material.type}', '${material.created_at}');\n`;
        });
        sqlOutput += '\n';
      }
    });

    // Export pieces
    db.all('SELECT * FROM ceramic_pieces WHERE user_id = ?', [userId], (err, pieces) => {
      if (err) {
        console.error('Error exporting pieces:', err.message);
        return;
      }

      if (pieces.length > 0) {
        sqlOutput += '-- Ceramic Pieces\n';
        pieces.forEach(piece => {
          const desc = piece.description ? piece.description.replace(/'/g, "''") : '';
          const phaseId = piece.current_phase_id || 'NULL';
          sqlOutput += `INSERT OR REPLACE INTO ceramic_pieces (id, user_id, name, description, current_phase_id, done, created_at, updated_at) VALUES (${piece.id}, ${piece.user_id}, '${piece.name.replace(/'/g, "''")}', ${desc ? `'${desc}'` : 'NULL'}, ${phaseId}, ${piece.done || 0}, '${piece.created_at}', '${piece.updated_at}');\n`;
        });
        sqlOutput += '\n';
      }
    });

    // Export piece_materials
    db.all(`
      SELECT pm.* FROM piece_materials pm
      INNER JOIN ceramic_pieces p ON pm.piece_id = p.id
      WHERE p.user_id = ?
    `, [userId], (err, pieceMaterials) => {
      if (err) {
        console.error('Error exporting piece_materials:', err.message);
        return;
      }

      if (pieceMaterials.length > 0) {
        sqlOutput += '-- Piece Materials\n';
        pieceMaterials.forEach(pm => {
          sqlOutput += `INSERT OR REPLACE INTO piece_materials (id, piece_id, material_id) VALUES (${pm.id}, ${pm.piece_id}, ${pm.material_id});\n`;
        });
        sqlOutput += '\n';
      }
    });

    // Export piece_images and copy image files
    db.all(`
      SELECT pi.* FROM piece_images pi
      INNER JOIN ceramic_pieces p ON pi.piece_id = p.id
      WHERE p.user_id = ?
    `, [userId], (err, images) => {
      if (err) {
        console.error('Error exporting images:', err.message);
        return;
      }

      if (images.length > 0) {
        sqlOutput += '-- Piece Images\n';
        const uploadsDir = resolve(__dirname, '..', 'uploads');
        const thumbnailsDir = resolve(uploadsDir, 'thumbnails');

        images.forEach(image => {
          sqlOutput += `INSERT OR REPLACE INTO piece_images (id, piece_id, phase_id, filename, original_filename, created_at) VALUES (${image.id}, ${image.piece_id}, ${image.phase_id}, '${image.filename}', ${image.original_filename ? `'${image.original_filename.replace(/'/g, "''")}'` : 'NULL'}, '${image.created_at}');\n`;
          
          // Copy image file
          const sourcePath = resolve(uploadsDir, image.filename);
          if (existsSync(sourcePath)) {
            const destPath = resolve(seedUploadsDir, image.filename);
            copyFileSync(sourcePath, destPath);
            console.log(`Copied image: ${image.filename}`);
          }

          // Copy thumbnail if exists
          const thumbnailFilename = image.filename.replace(/\.[^/.]+$/, '.jpg');
          const thumbnailSource = resolve(thumbnailsDir, thumbnailFilename);
          if (existsSync(thumbnailSource)) {
            const thumbnailDest = resolve(seedUploadsDir, 'thumbnails');
            if (!existsSync(thumbnailDest)) {
              mkdirSync(thumbnailDest, { recursive: true });
            }
            copyFileSync(thumbnailSource, resolve(thumbnailDest, thumbnailFilename));
            console.log(`Copied thumbnail: ${thumbnailFilename}`);
          }
        });
        sqlOutput += '\n';
      }

      // Write SQL file
      writeFileSync(seedDataPath, sqlOutput, 'utf8');
      console.log(`\nSeed data exported to: ${seedDataPath}`);
      console.log(`Images copied to: ${seedUploadsDir}`);
      console.log('\nExport complete!');
      
      db.close();
      process.exit(0);
    });
  });
});




