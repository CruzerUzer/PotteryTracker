import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database.');
});

// Add a free-text "description" column to materials (idempotent).
db.all("PRAGMA table_info(materials)", (err, rows) => {
  if (err) {
    console.error('Error checking table info:', err.message);
    db.close();
    process.exit(1);
  }

  const hasDescription = rows.some(col => col.name === 'description');
  if (hasDescription) {
    console.log('Column "description" already exists. Migration not needed.');
    db.close();
    process.exit(0);
  }

  db.run('ALTER TABLE materials ADD COLUMN description TEXT', (err) => {
    if (err) {
      console.error('Error adding description column:', err.message);
      db.close();
      process.exit(1);
    }
    console.log('Successfully added "description" column to materials table.');
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
        process.exit(1);
      }
      console.log('Migration complete.');
      process.exit(0);
    });
  });
});
