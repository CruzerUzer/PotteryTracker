import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DB_PATH || join(__dirname, '..', 'database', 'database.db');

const username = process.argv[2];

if (!username) {
  console.error('Usage: node add-admin.js <username>');
  process.exit(1);
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
});

db.get('SELECT id, username, is_admin FROM users WHERE username = ?', [username], (err, user) => {
  if (err) {
    console.error('Error checking user:', err.message);
    db.close();
    process.exit(1);
  }

  if (!user) {
    console.error(`User "${username}" not found.`);
    db.close();
    process.exit(1);
  }

  if (user.is_admin === 1) {
    console.log(`User "${username}" already has admin privileges.`);
    db.close();
    process.exit(0);
  }

  db.run('UPDATE users SET is_admin = 1 WHERE id = ?', [user.id], (updateErr) => {
    if (updateErr) {
      console.error('Error updating user:', updateErr.message);
      db.close();
      process.exit(1);
    }

    console.log(`Admin privileges granted to user "${username}".`);
    db.close();
    process.exit(0);
  });
});




