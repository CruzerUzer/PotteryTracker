import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
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

  // Create default user "Test" with password "Test"
  bcrypt.hash('Test', 10, (hashErr, passwordHash) => {
    if (hashErr) {
      console.error('Error hashing password:', hashErr.message);
      db.close();
      process.exit(1);
    }
  
    db.run('INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)', 
      ['Test', passwordHash], function(err) {
      if (err) {
        console.error('Error creating default user:', err.message);
        db.close();
        process.exit(1);
      }

      // Get the actual user ID (this.lastID might be 0 if INSERT OR IGNORE didn't insert)
      db.get('SELECT id FROM users WHERE username = ?', ['Test'], (userErr, user) => {
        if (userErr || !user) {
          console.error('Error finding default user:', userErr?.message);
          db.close();
          process.exit(1);
        }

        const defaultUserId = user.id;

        // Insert default phases for the default user
        const defaultPhases = [
          { name: 'På tork', display_order: 1 },
          { name: 'Skröjbränd', display_order: 2 },
          { name: 'Glaserad', display_order: 3 },
          { name: 'Glasyrbränd', display_order: 4 }
        ];

        const stmt = db.prepare('INSERT OR IGNORE INTO phases (user_id, name, display_order) VALUES (?, ?, ?)');
        
        defaultPhases.forEach(phase => {
          stmt.run(defaultUserId, phase.name, phase.display_order);
        });

        stmt.finalize((finalizeErr) => {
          if (finalizeErr) {
            console.error('Error inserting default phases:', finalizeErr.message);
          } else {
            console.log('Default user and phases created.');
          }
          db.close((closeErr) => {
            if (closeErr) {
              console.error('Error closing database:', closeErr.message);
            } else {
              console.log('Database initialization complete.');
            }
            process.exit(0);
          });
        });
      });
    });
  });
});



