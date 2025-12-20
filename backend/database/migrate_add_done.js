import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'database.db');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database.');
});

// Check if done column already exists
db.all("PRAGMA table_info(ceramic_pieces)", (err, rows) => {
  if (err) {
    console.error('Error checking table info:', err.message);
    db.close();
    process.exit(1);
  }

  // Check for done column
  const hasDoneColumn = rows.some(col => col.name === 'done');

  if (hasDoneColumn) {
    console.log('Column "done" already exists. Migration not needed.');
    db.close();
    process.exit(0);
  }

  // Add done column
  db.run('ALTER TABLE ceramic_pieces ADD COLUMN done INTEGER DEFAULT 0', (err) => {
    if (err) {
      console.error('Error adding done column:', err.message);
      db.close();
      process.exit(1);
    }
    console.log('Successfully added "done" column to ceramic_pieces table.');

    // Update existing pieces: set done=1 if they are in the final phase
    db.get('SELECT MAX(display_order) as max_order FROM phases', (err, maxResult) => {
      if (err) {
        console.error('Error getting max display_order:', err.message);
        db.close();
        process.exit(1);
      }

      const maxOrder = maxResult?.max_order;
      if (maxOrder !== null && maxOrder !== undefined) {
        // Update pieces that are in the final phase
        db.run(`
          UPDATE ceramic_pieces 
          SET done = 1 
          WHERE current_phase_id IN (
            SELECT id FROM phases WHERE display_order = ?
          )
        `, [maxOrder], (err) => {
          if (err) {
            console.error('Error updating existing pieces:', err.message);
            db.close();
            process.exit(1);
          }
          console.log('Updated existing pieces: set done=1 for pieces in final phase.');
          db.close((err) => {
            if (err) {
              console.error('Error closing database:', err.message);
              process.exit(1);
            }
            console.log('Migration complete.');
            process.exit(0);
          });
        });
      } else {
        console.log('No phases found. Migration complete (no pieces to update).');
        db.close((err) => {
          if (err) {
            console.error('Error closing database:', err.message);
            process.exit(1);
          }
          process.exit(0);
        });
      }
    });
  });
});

