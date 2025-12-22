import express from 'express';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { unlinkSync, existsSync } from 'fs';
import { requireAuth } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const dbPath = join(__dirname, '..', 'database', 'database.db');
const uploadsDir = process.env.UPLOADS_DIR || resolve(__dirname, '..', 'uploads');
const thumbnailDir = resolve(uploadsDir, 'thumbnails');

// All image routes require authentication
router.use(requireAuth);

async function getDb() {
  return open({
    filename: dbPath,
    driver: sqlite3.Database
  });
}

// GET /api/images/:id/file - Serve image file (full size or thumbnail)
router.get('/:id/file', async (req, res) => {
  try {
    const { id } = req.params;
    const { thumbnail } = req.query; // ?thumbnail=true to get thumbnail
    const db = await getDb();

    // Verify image belongs to a piece owned by the user
    const image = await db.get(`
      SELECT pi.filename 
      FROM piece_images pi
      INNER JOIN ceramic_pieces p ON pi.piece_id = p.id
      WHERE pi.id = ? AND p.user_id = ?
    `, [id, req.userId]);
    await db.close();

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Serve thumbnail if requested and available
    if (thumbnail === 'true') {
      const thumbnailFilename = image.filename.replace(/\.[^/.]+$/, '.jpg');
      const thumbnailPath = resolve(thumbnailDir, thumbnailFilename);
      if (existsSync(thumbnailPath)) {
        return res.sendFile(thumbnailPath);
      }
      // Fall through to serve full image if thumbnail doesn't exist
    }

    // Serve full-size image
    const filePath = resolve(uploadsDir, image.filename);
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'Image file not found' });
    }

    res.sendFile(filePath);
  } catch (error) {
    logger.error('Error serving image', {
      error: error.message,
      stack: error.stack,
      imageId: id,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

// DELETE /api/images/:id - Delete an image
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    // Verify image belongs to a piece owned by the user
    const image = await db.get(`
      SELECT pi.filename 
      FROM piece_images pi
      INNER JOIN ceramic_pieces p ON pi.piece_id = p.id
      WHERE pi.id = ? AND p.user_id = ?
    `, [id, req.userId]);
    
    if (!image) {
      await db.close();
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete from database (the JOIN ensures we can only delete images from user's pieces)
    await db.run(`
      DELETE FROM piece_images 
      WHERE id = ? AND piece_id IN (
        SELECT id FROM ceramic_pieces WHERE user_id = ?
      )
    `, [id, req.userId]);
    await db.close();

    // Delete file
    const filePath = resolve(uploadsDir, image.filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    // Delete file and thumbnail
    const filePath = resolve(uploadsDir, image.filename);
    const thumbnailFilename = image.filename.replace(/\.[^/.]+$/, '.jpg');
    const thumbnailPath = resolve(thumbnailDir, thumbnailFilename);
    
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
    if (existsSync(thumbnailPath)) {
      unlinkSync(thumbnailPath);
    }

    logger.info('Image deleted', {
      imageId: id,
      filename: image.filename,
      userId: req.userId
    });

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    logger.error('Error deleting image', {
      error: error.message,
      stack: error.stack,
      imageId: id,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

export default router;
