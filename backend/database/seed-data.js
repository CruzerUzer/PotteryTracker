import sqlite3 from 'sqlite3';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync, copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'database.db');
const seedDir = join(__dirname, 'seed');
const seedDataPath = join(seedDir, 'seed-data.sql');
const seedUploadsDir = join(seedDir, 'uploads');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database.');
});

// Check if seed data exists
if (!existsSync(seedDataPath)) {
  console.log('No seed data found. Skipping seed data import.');
  db.close();
  process.exit(0);
}

console.log('Importing seed data...');

// Get Test user ID
db.get('SELECT id FROM users WHERE username = ?', ['Test'], (err, user) => {
  if (err || !user) {
    console.error('Error: Test user not found. Cannot import seed data.');
    db.close();
    process.exit(1);
  }

  const userId = user.id;
  console.log(`Found Test user with ID: ${userId}`);

  // Read and execute seed SQL
  const seedSQL = readFileSync(seedDataPath, 'utf8');
  
  db.exec(seedSQL, (err) => {
    if (err) {
      console.error('Error importing seed data:', err.message);
      db.close();
      process.exit(1);
    }

    console.log('Seed data imported successfully.');

    // Copy image files to uploads directory
    const uploadsDir = resolve(__dirname, '..', 'uploads');
    const thumbnailsDir = resolve(uploadsDir, 'thumbnails');

    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true });
    }
    if (!existsSync(thumbnailsDir)) {
      mkdirSync(thumbnailsDir, { recursive: true });
    }

    if (existsSync(seedUploadsDir)) {
      // Copy all files from seed uploads
      const files = readdirSync(seedUploadsDir);
      files.forEach(file => {
        const sourcePath = resolve(seedUploadsDir, file);
        const destPath = resolve(uploadsDir, file);
        
        // Check if it's a file (not directory)
        const stats = statSync(sourcePath);
        if (stats.isFile()) {
          copyFileSync(sourcePath, destPath);
          console.log(`Copied image: ${file}`);
        }
      });

      // Copy thumbnails if they exist
      const seedThumbnailsDir = resolve(seedUploadsDir, 'thumbnails');
      if (existsSync(seedThumbnailsDir)) {
        const thumbnailFiles = readdirSync(seedThumbnailsDir);
        thumbnailFiles.forEach(file => {
          const sourcePath = resolve(seedThumbnailsDir, file);
          const destPath = resolve(thumbnailsDir, file);
          copyFileSync(sourcePath, destPath);
          console.log(`Copied thumbnail: ${file}`);
        });
      }
    }

    console.log('Seed data import complete!');
    db.close();
    process.exit(0);
  });
});

