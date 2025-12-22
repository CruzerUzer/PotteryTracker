import express from 'express';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const dbPath = join(__dirname, '..', 'database', 'database.db');

// All export routes require authentication
router.use(requireAuth);

async function getDb() {
  return open({
    filename: dbPath,
    driver: sqlite3.Database
  });
}

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

    await db.close();

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

    await db.close();

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

export default router;

