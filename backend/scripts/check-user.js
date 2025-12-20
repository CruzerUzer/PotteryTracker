import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '..', 'database', 'database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to database.');
});

// Check if users table exists
db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='users'", (err, rows) => {
  if (err) {
    console.error('Error checking tables:', err);
    db.close();
    process.exit(1);
  }

  if (rows.length === 0) {
    console.log('❌ Users table does NOT exist. You need to run the migration or initialize the database.');
    console.log('Run: npm run migrate-multi-user (for existing database)');
    console.log('Or: npm run init-db (for fresh database)');
    db.close();
    process.exit(1);
  }

  console.log('✅ Users table exists.');

  // Check for Test user
  db.get('SELECT id, username FROM users WHERE username = ?', ['Test'], (err, user) => {
    if (err) {
      console.error('Error checking for Test user:', err);
      db.close();
      process.exit(1);
    }

    if (!user) {
      console.log('❌ Test user does NOT exist. You need to run the migration or initialize the database.');
      console.log('Run: npm run migrate-multi-user (for existing database)');
      console.log('Or: npm run init-db (for fresh database)');
    } else {
      console.log(`✅ Test user exists with ID: ${user.id}`);
    }

    // List all users
    db.all('SELECT id, username FROM users', (err, users) => {
      if (err) {
        console.error('Error fetching users:', err);
        db.close();
        process.exit(1);
      }

      console.log('\nAll users in database:');
      if (users.length === 0) {
        console.log('  (no users found)');
      } else {
        users.forEach(u => {
          console.log(`  - ID: ${u.id}, Username: ${u.username}`);
        });
      }

      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
          process.exit(1);
        }
        process.exit(0);
      });
    });
  });
});

