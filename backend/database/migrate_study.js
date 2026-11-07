/**
 * Migration: Studie-modulen.
 * Lägger till users.study_enabled (av som standard) och studietabellerna.
 * Idempotent – säker att köra flera gånger. Körs av update-potterytracker.sh.
 *
 *   node database/migrate_study.js
 */
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ensureStudySchema } from './studySchema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || join(__dirname, 'database.db');

async function main() {
  const db = await open({ filename: dbPath, driver: sqlite3.Database });
  try {
    const { addedColumn } = await ensureStudySchema(db);
    console.log(addedColumn
      ? 'La till kolumnen users.study_enabled.'
      : 'Kolumnen users.study_enabled finns redan.');
    console.log('Studietabellerna är på plats.');
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error('Migrationen misslyckades:', err.message);
  process.exit(1);
});
