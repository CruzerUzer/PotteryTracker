import express from 'express';
import multer from 'multer';
import { getDb } from '../utils/db.js';
import { requireAuth } from '../middleware/auth.js';
import { createUserArchive, importUserArchive } from '../utils/archive.js';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, unlinkSync } from 'fs';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const uploadsDir = process.env.UPLOADS_DIR || resolve(__dirname, '..', 'uploads');
const archivesDir = process.env.ARCHIVES_DIR || resolve(__dirname, '..', 'archives');

// Configure multer for file upload
const upload = multer({
  dest: archivesDir,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// All export routes require authentication
router.use(requireAuth);

// Helper function to convert array to CSV
function arrayToCSV(data) {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(',')];
  
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (value == null) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}

// GET /api/export/pieces - Export pieces as CSV or JSON
router.get('/pieces', async (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const db = await getDb();

    // Get all pieces with related data
    const pieces = await db.all(`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.done,
        ph.name as phase_name,
        p.created_at,
        p.updated_at,
        GROUP_CONCAT(DISTINCT m.name || ' (' || m.type || ')') as materials,
        COUNT(DISTINCT pi.id) as image_count
      FROM ceramic_pieces p
      LEFT JOIN phases ph ON p.current_phase_id = ph.id AND ph.user_id = p.user_id
      LEFT JOIN piece_materials pm ON p.id = pm.piece_id
      LEFT JOIN materials m ON pm.material_id = m.id AND m.user_id = p.user_id
      LEFT JOIN piece_images pi ON p.id = pi.piece_id
      WHERE p.user_id = ?
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `, [req.userId]);


    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="pottery-pieces-${new Date().toISOString().split('T')[0]}.csv"`);
      res.send(arrayToCSV(pieces));
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="pottery-pieces-${new Date().toISOString().split('T')[0]}.json"`);
      res.json({
        exportDate: new Date().toISOString(),
        totalPieces: pieces.length,
        pieces: pieces
      });
    }

    logger.info('Pieces exported', {
      format,
      count: pieces.length,
      userId: req.userId
    });
  } catch (error) {
    logger.error('Error exporting pieces', {
      error: error.message,
      stack: error.stack,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to export pieces' });
  }
});

// GET /api/export/stats - Get statistics/reports
router.get('/stats', async (req, res) => {
  try {
    const db = await getDb();

    // Get statistics
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_pieces,
        SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) as done_pieces,
        SUM(CASE WHEN done = 0 THEN 1 ELSE 0 END) as in_progress_pieces,
        COUNT(DISTINCT current_phase_id) as phases_in_use,
        COUNT(DISTINCT pm.material_id) as materials_in_use,
        COUNT(DISTINCT pi.id) as total_images
      FROM ceramic_pieces p
      LEFT JOIN piece_materials pm ON p.id = pm.piece_id
      LEFT JOIN piece_images pi ON p.id = pi.piece_id
      WHERE p.user_id = ?
    `, [req.userId]);

    // Get pieces by phase
    const piecesByPhase = await db.all(`
      SELECT 
        ph.name as phase_name,
        COUNT(*) as count
      FROM ceramic_pieces p
      LEFT JOIN phases ph ON p.current_phase_id = ph.id AND ph.user_id = p.user_id
      WHERE p.user_id = ?
      GROUP BY ph.id, ph.name
      ORDER BY count DESC
    `, [req.userId]);

    // Get pieces by material type
    const piecesByMaterialType = await db.all(`
      SELECT 
        m.type,
        COUNT(DISTINCT p.id) as count
      FROM ceramic_pieces p
      INNER JOIN piece_materials pm ON p.id = pm.piece_id
      INNER JOIN materials m ON pm.material_id = m.id AND m.user_id = p.user_id
      WHERE p.user_id = ?
      GROUP BY m.type
      ORDER BY count DESC
    `, [req.userId]);


    res.json({
      summary: stats,
      piecesByPhase: piecesByPhase,
      piecesByMaterialType: piecesByMaterialType,
      generatedAt: new Date().toISOString()
    });

    logger.info('Statistics exported', { userId: req.userId });
  } catch (error) {
    logger.error('Error exporting statistics', {
      error: error.message,
      stack: error.stack,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to export statistics' });
  }
});

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
    
    // Verify filename belongs to this user (filename starts with user_{userId}_)
    if (!filename.startsWith(`user_${req.userId}_`)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const archivePath = resolve(archivesDir, filename);
    
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

