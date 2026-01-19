import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DB_PATH || join(__dirname, 'database.db');

async function migrate() {
  console.log('Starting migration: Add locations support...');

  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  try {
    // Check if locations table exists
    const locationsTable = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='locations'"
    );

    if (!locationsTable) {
      console.log('Creating locations table...');
      await db.exec(`
        CREATE TABLE IF NOT EXISTS locations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          display_order INTEGER DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, name)
        )
      `);
      console.log('Locations table created.');
    } else {
      console.log('Locations table already exists.');
    }

    // Check if current_location_id column exists in ceramic_pieces
    const columns = await db.all("PRAGMA table_info(ceramic_pieces)");
    const hasLocationColumn = columns.some(col => col.name === 'current_location_id');

    if (!hasLocationColumn) {
      console.log('Adding current_location_id column to ceramic_pieces...');
      await db.exec(`
        ALTER TABLE ceramic_pieces ADD COLUMN current_location_id INTEGER REFERENCES locations(id)
      `);
      console.log('Column added.');
    } else {
      console.log('current_location_id column already exists.');
    }

    // Create indexes if they don't exist
    console.log('Creating indexes...');
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_pieces_location ON ceramic_pieces(current_location_id);
      CREATE INDEX IF NOT EXISTS idx_locations_user ON locations(user_id);
    `);
    console.log('Indexes created.');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

migrate();
