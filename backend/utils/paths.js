import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Base directories
export const uploadsDir = process.env.UPLOADS_DIR || resolve(__dirname, '..', 'uploads');
export const archivesDir = process.env.ARCHIVES_DIR || resolve(__dirname, '..', 'archives');
export const thumbnailDir = resolve(uploadsDir, 'thumbnails');

// Ensure directories exist
export function ensureDirectoriesExist() {
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }
  if (!existsSync(thumbnailDir)) {
    mkdirSync(thumbnailDir, { recursive: true });
  }
  if (!existsSync(archivesDir)) {
    mkdirSync(archivesDir, { recursive: true });
  }
}

// Path helpers
export function getImagePath(filename) {
  return resolve(uploadsDir, filename);
}

export function getThumbnailPath(filename) {
  return resolve(thumbnailDir, filename);
}

export function getArchivePath(filename) {
  return resolve(archivesDir, filename);
}
