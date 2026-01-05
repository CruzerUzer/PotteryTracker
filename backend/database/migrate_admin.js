import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DB_PATH || join(__dirname, 'database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database.');
});

// Run migration
db.serialize(() => {
  // Add columns to users table if they don't exist
  db.run('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0', (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding is_admin column:', err.message);
    } else if (!err) {
      console.log('Added is_admin column to users table.');
    }
  });

  db.run('ALTER TABLE users ADD COLUMN last_login TEXT', (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding last_login column:', err.message);
    } else if (!err) {
      console.log('Added last_login column to users table.');
    }
  });

  db.run('ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0', (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding must_change_password column:', err.message);
    } else if (!err) {
      console.log('Added must_change_password column to users table.');
    }
  });

  // Create system_settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `, (err) => {
    if (err) {
      console.error('Error creating system_settings table:', err.message);
    } else {
      console.log('Created system_settings table.');
    }
  });

  // Initialize system settings
  db.run(`INSERT OR IGNORE INTO system_settings (key, value) VALUES ('registration_enabled', '1')`, (err) => {
    if (err) {
      console.error('Error initializing system settings:', err.message);
    } else {
      console.log('Initialized system settings.');
    }
  });

  // Create password_reset_tokens table
  db.run(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) {
      console.error('Error creating password_reset_tokens table:', err.message);
    } else {
      console.log('Created password_reset_tokens table.');
    }
  });

  // Create user_archives table
  db.run(`
    CREATE TABLE IF NOT EXISTS user_archives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT NOT NULL,
      archive_filename TEXT NOT NULL UNIQUE,
      is_encrypted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      file_size INTEGER
    )
  `, (err) => {
    if (err) {
      console.error('Error creating user_archives table:', err.message);
    } else {
      console.log('Created user_archives table.');
    }
  });

  // Create or update Admin user
  db.get('SELECT id, is_admin FROM users WHERE username = ?', ['Admin'], (err, user) => {
    if (err) {
      console.error('Error checking for Admin user:', err.message);
      db.close();
      process.exit(1);
    }

    if (!user) {
      // Create Admin user
      console.log('Creating Admin user...');
      bcrypt.hash('Admin', 10, (hashErr, passwordHash) => {
        if (hashErr) {
          console.error('Error hashing password:', hashErr.message);
          db.close();
          process.exit(1);
        }

        db.run('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, ?)',
          ['Admin', passwordHash, 1], function(insertErr) {
          if (insertErr) {
            console.error('Error creating Admin user:', insertErr.message);
            db.close();
            process.exit(1);
          }
          console.log(`Admin user created with ID ${this.lastID}`);
          db.close((closeErr) => {
            if (closeErr) {
              console.error('Error closing database:', closeErr.message);
              process.exit(1);
            }
            console.log('Migration complete.');
            process.exit(0);
          });
        });
      });
    } else {
      // Update existing Admin user to have admin privileges
      db.run('UPDATE users SET is_admin = 1 WHERE id = ?', [user.id], (updateErr) => {
        if (updateErr) {
          console.error('Error updating Admin user:', updateErr.message);
          db.close();
          process.exit(1);
        }
        console.log(`Admin user updated (ID: ${user.id})`);
        db.close((closeErr) => {
          if (closeErr) {
            console.error('Error closing database:', closeErr.message);
            process.exit(1);
          }
          console.log('Migration complete.');
          process.exit(0);
        });
      });
    }
  });
});

