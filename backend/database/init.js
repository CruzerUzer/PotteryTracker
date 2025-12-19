import sqlite3 from 'sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'database.db');
const schemaPath = join(__dirname, 'schema.sql');

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database.');
});

// Read and execute schema
const schema = readFileSync(schemaPath, 'utf8');

db.exec(schema, (err) => {
  if (err) {
    console.error('Error executing schema:', err.message);
    db.close();
    process.exit(1);
  }
  console.log('Database schema initialized successfully.');

  // Insert default phases
  const defaultPhases = [
    { name: 'På tork', display_order: 1 },
    { name: 'Skröjbränd', display_order: 2 },
    { name: 'Glaserad', display_order: 3 },
    { name: 'Glasyrbränd', display_order: 4 }
  ];

  const stmt = db.prepare('INSERT OR IGNORE INTO phases (name, display_order) VALUES (?, ?)');
  
  defaultPhases.forEach(phase => {
    stmt.run(phase.name, phase.display_order);
  });

  stmt.finalize((err) => {
    if (err) {
      console.error('Error inserting default phases:', err.message);
    } else {
      console.log('Default phases inserted.');
    }
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database initialization complete.');
      }
      process.exit(0);
    });
  });
});



