import express from 'express';
import multer from 'multer';
import { getDb } from '../utils/db.js';
import { requireAuth } from '../middleware/auth.js';
import { createUserArchive, importUserArchive } from '../utils/archive.js';
import { existsSync, unlinkSync } from 'fs';
import logger from '../utils/logger.js';
import { uploadsDir, archivesDir, getArchivePath } from '../utils/paths.js';

const router = express.Router();

// Configure multer for file upload
const upload = multer({
  dest: archivesDir,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// All export routes require authentication
router.use(requireAuth);

// POST /api/export/archive - User export to archive
router.post('/archive', async (req, res) => {
  try {
    const { password } = req.body; // Optional password for encryption
    const db = await getDb();

    const archiveResult = await createUserArchive(req.userId, password || null, db, uploadsDir);

    logger.info('User archive created', { userId: req.userId, filename: archiveResult.filename });

    res.json({
      message: 'Archive created successfully',
      filename: archiveResult.filename,
      size: archiveResult.size,
      is_encrypted: archiveResult.is_encrypted
    });
  } catch (error) {
    logger.error('Error creating archive', { error: error.message, userId: req.userId });
    res.status(500).json({ error: 'Failed to create archive' });
  }
});

// GET /api/export/archive/download/:filename - Download user's archive file
router.get('/archive/download/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const db = await getDb();

    // Archives are named `<sanitizedUsername>_<timestamp>[.encrypted].zip`
    // (see createUserArchive). Verify the file belongs to the requesting user
    // by matching that exact, anchored pattern — this both enforces ownership
    // and blocks path traversal (only <username>_<digits>.zip is accepted).
    const user = await db.get('SELECT username FROM users WHERE id = ?', [req.userId]);
    if (!user) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const sanitizedUsername = user.username.replace(/[^a-zA-Z0-9_-]/g, '_');
    const escaped = sanitizedUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const validPattern = new RegExp(`^${escaped}_\\d+(\\.encrypted)?\\.zip$`);
    if (!validPattern.test(filename)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const archivePath = getArchivePath(filename);

    if (!existsSync(archivePath)) {
      return res.status(404).json({ error: 'Archive file not found' });
    }

    res.download(archivePath, filename);
  } catch (error) {
    logger.error('Error downloading archive', { error: error.message, userId: req.userId });
    res.status(500).json({ error: 'Failed to download archive' });
  }
});

// POST /api/export/import - User import archive
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { password } = req.body; // Optional password (required if archive is encrypted)
    const db = await getDb();

    // Determine if encrypted by filename
    const isEncrypted = req.file.originalname.endsWith('.encrypted.zip');
    const archivePassword = isEncrypted ? password : null;

    if (isEncrypted && !archivePassword) {
      // Cleanup uploaded file
      unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Password required for encrypted archive' });
    }

    const importResult = await importUserArchive(req.file.path, archivePassword, req.userId, db, uploadsDir);

    // Cleanup uploaded file
    unlinkSync(req.file.path);

    logger.info('User archive imported', { userId: req.userId, result: importResult });

    res.json({
      message: 'Archive imported successfully',
      result: importResult
    });
  } catch (error) {
    // Cleanup uploaded file on error
    if (req.file) {
      try {
        unlinkSync(req.file.path);
      } catch (cleanupError) {
        logger.error('Error cleaning up uploaded file', { error: cleanupError.message });
      }
    }
    logger.error('Error importing archive', { error: error.message, userId: req.userId });
    res.status(500).json({ error: error.message || 'Failed to import archive' });
  }
});

export default router;

