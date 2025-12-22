import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DB_PATH || join(__dirname, '..', 'database', 'database.db');

let dbInstance = null;
let dbPromise = null;

/**
 * Get database connection (singleton pattern)
 * Returns a promise that resolves to the database instance
 */
export async function getDb() {
  // If we already have a connection, return it
  if (dbInstance) {
    return dbInstance;
  }

  // If we're already in the process of opening a connection, return that promise
  if (dbPromise) {
    return dbPromise;
  }

  // Create a new connection
  dbPromise = open({
    filename: dbPath,
    driver: sqlite3.Database
  }).then(db => {
    // Configure database
    db.on('trace', (sql) => {
      // Only log SQL in debug mode
      if (process.env.LOG_LEVEL === 'debug') {
        logger.debug('SQL Query', { sql });
      }
    });

    dbInstance = db;
    logger.info('Database connection established', { dbPath });
    return db;
  }).catch(error => {
    logger.error('Failed to open database', {
      error: error.message,
      stack: error.stack,
      dbPath
    });
    dbPromise = null;
    throw error;
  });

  return dbPromise;
}

/**
 * Close database connection
 * Should be called on application shutdown
 */
export async function closeDb() {
  if (dbInstance) {
    try {
      await dbInstance.close();
      logger.info('Database connection closed');
      dbInstance = null;
      dbPromise = null;
    } catch (error) {
      logger.error('Error closing database', {
        error: error.message,
        stack: error.stack
      });
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await closeDb();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDb();
  process.exit(0);
});

