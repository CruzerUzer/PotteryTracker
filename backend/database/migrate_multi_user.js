import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
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

// Check if users table exists
db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, rows) => {
  if (err) {
    console.error('Error checking tables:', err.message);
    db.close();
    process.exit(1);
  }

  const hasUsersTable = rows.length > 0;

  if (hasUsersTable) {
    console.log('Users table already exists. Checking if migration is needed...');
    checkAndMigrate();
  } else {
    console.log('Users table does not exist. Creating users table and running migration...');
    createUsersTable();
  }
});

function createUsersTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `, (err) => {
    if (err) {
      console.error('Error creating users table:', err.message);
      db.close();
      process.exit(1);
    }
    console.log('Users table created.');
    checkAndMigrate();
  });
}

function checkAndMigrate() {
  // Check if user_id columns exist
  db.all("PRAGMA table_info(phases)", (err, phaseColumns) => {
    if (err) {
      console.error('Error checking phases table:', err.message);
      db.close();
      process.exit(1);
    }

    const hasUserIdInPhases = phaseColumns.some(col => col.name === 'user_id');
    
    if (hasUserIdInPhases) {
      console.log('Migration already completed. user_id columns exist.');
      // Still check/create default user
      ensureDefaultUser();
    } else {
      console.log('Adding user_id columns to existing tables...');
      addUserIdColumns();
    }
  });
}

function addUserIdColumns() {
  // Create default user first
  bcrypt.hash('Test', 10, (err, passwordHash) => {
    if (err) {
      console.error('Error hashing password:', err.message);
      db.close();
      process.exit(1);
    }

    // Create default user
    db.run('INSERT OR IGNORE INTO users (username, password_hash) VALUES (?, ?)', 
      ['Test', passwordHash], function(createErr) {
      if (createErr) {
        // User might already exist, check if we got the ID
        db.get('SELECT id FROM users WHERE username = ?', ['Test'], (selectErr, user) => {
          if (selectErr) {
            console.error('Error checking for default user:', selectErr.message);
            db.close();
            process.exit(1);
          }

          if (user) {
            migrateTables(user.id);
          } else {
            console.error('Failed to create or find default user');
            db.close();
            process.exit(1);
          }
        });
      } else {
        const userId = this.lastID;
        console.log(`Default user "Test" created with ID ${userId}`);
        migrateTables(userId);
      }
    });
  });
}

function migrateTables(defaultUserId) {
  console.log(`Migrating existing data to user_id: ${defaultUserId}`);

  // Add user_id column to phases (if it doesn't exist)
  db.run('ALTER TABLE phases ADD COLUMN user_id INTEGER', (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding user_id to phases:', err.message);
      db.close();
      process.exit(1);
    }
    console.log('Added user_id column to phases (if not exists).');
    
    // Update existing phases to belong to default user
    db.run('UPDATE phases SET user_id = ? WHERE user_id IS NULL', [defaultUserId], (updateErr) => {
      if (updateErr) {
        console.error('Error updating phases:', updateErr.message);
        db.close();
        process.exit(1);
      }
      console.log('Updated existing phases to belong to default user.');
      
      // Update phases to have unique constraint on (user_id, name)
      // SQLite doesn't support altering constraints directly, so we'll skip this
      // The schema will enforce it for new inserts
      
      migrateMaterials(defaultUserId);
    });
  });
}

function migrateMaterials(defaultUserId) {
  // Add user_id column to materials
  db.run('ALTER TABLE materials ADD COLUMN user_id INTEGER', (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding user_id to materials:', err.message);
      db.close();
      process.exit(1);
    }
    console.log('Added user_id column to materials (if not exists).');
    
    // Update existing materials
    db.run('UPDATE materials SET user_id = ? WHERE user_id IS NULL', [defaultUserId], (updateErr) => {
      if (updateErr) {
        console.error('Error updating materials:', updateErr.message);
        db.close();
        process.exit(1);
      }
      console.log('Updated existing materials to belong to default user.');
      migratePieces(defaultUserId);
    });
  });
}

function migratePieces(defaultUserId) {
  // Add user_id column to ceramic_pieces
  db.run('ALTER TABLE ceramic_pieces ADD COLUMN user_id INTEGER', (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Error adding user_id to ceramic_pieces:', err.message);
      db.close();
      process.exit(1);
    }
    console.log('Added user_id column to ceramic_pieces (if not exists).');
    
    // Update existing pieces
    db.run('UPDATE ceramic_pieces SET user_id = ? WHERE user_id IS NULL', [defaultUserId], (updateErr) => {
      if (updateErr) {
        console.error('Error updating ceramic_pieces:', updateErr.message);
        db.close();
        process.exit(1);
      }
      console.log('Updated existing ceramic_pieces to belong to default user.');
      
      // Create indexes
      db.run('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)', (idxErr) => {
        if (idxErr) console.error('Error creating index:', idxErr.message);
      });
      db.run('CREATE INDEX IF NOT EXISTS idx_phases_user ON phases(user_id)', (idxErr) => {
        if (idxErr) console.error('Error creating index:', idxErr.message);
      });
      db.run('CREATE INDEX IF NOT EXISTS idx_materials_user ON materials(user_id)', (idxErr) => {
        if (idxErr) console.error('Error creating index:', idxErr.message);
      });
      db.run('CREATE INDEX IF NOT EXISTS idx_pieces_user ON ceramic_pieces(user_id)', (idxErr) => {
        if (idxErr) console.error('Error creating index:', idxErr.message);
      });
      
      console.log('Migration complete!');
      ensureDefaultUser();
    });
  });
}

function ensureDefaultUser() {
  // Ensure default user exists
  db.get('SELECT id FROM users WHERE username = ?', ['Test'], (err, user) => {
    if (err) {
      console.error('Error checking for default user:', err.message);
      db.close();
      process.exit(1);
    }

    if (!user) {
      console.log('Creating default user "Test"...');
      bcrypt.hash('Test', 10, (hashErr, passwordHash) => {
        if (hashErr) {
          console.error('Error hashing password:', hashErr.message);
          db.close();
          process.exit(1);
        }

        db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', 
          ['Test', passwordHash], function(insertErr) {
          if (insertErr) {
            console.error('Error creating default user:', insertErr.message);
            db.close();
            process.exit(1);
          }
          console.log(`Default user "Test" created with ID ${this.lastID}`);
          db.close((closeErr) => {
            if (closeErr) {
              console.error('Error closing database:', closeErr.message);
              process.exit(1);
            }
            console.log('Migration script complete.');
            process.exit(0);
          });
        });
      });
    } else {
      console.log(`Default user "Test" already exists with ID ${user.id}`);
      db.close((closeErr) => {
        if (closeErr) {
          console.error('Error closing database:', closeErr.message);
          process.exit(1);
        }
        console.log('Migration script complete.');
        process.exit(0);
      });
    }
  });
}

