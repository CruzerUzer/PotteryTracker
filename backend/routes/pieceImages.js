import express from 'express';
import { unlinkSync, existsSync } from 'fs';
import { getDb } from '../utils/db.js';
import upload, { optimizeImage } from '../middleware/upload.js';
import { requireAuth } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// All image routes require authentication
router.use(requireAuth);

// POST /api/pieces/:id/images - Upload image for a piece
router.post('/:id/images', upload.single('image'), optimizeImage, async (req, res) => {
  try {
    const { id } = req.params;
    const { phase_id } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    if (!phase_id) {
      // Delete uploaded file since we're rejecting
      unlinkSync(req.file.path);
      return res.status(400).json({ error: 'phase_id is required' });
    }

    const db = await getDb();

    // Validate piece exists and belongs to user
    const piece = await db.get('SELECT id FROM ceramic_pieces WHERE id = ? AND user_id = ?', [id, req.userId]);
    if (!piece) {
      unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Piece not found' });
    }

    // Validate phase exists and belongs to user
    const phase = await db.get('SELECT id FROM phases WHERE id = ? AND user_id = ?', [phase_id, req.userId]);
    if (!phase) {
      unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Invalid phase_id' });
    }

    // Insert image record
    const result = await db.run(
      'INSERT INTO piece_images (piece_id, phase_id, filename, original_filename) VALUES (?, ?, ?, ?)',
      [id, phase_id, req.file.filename, req.file.originalname]
    );


    logger.info('Image uploaded successfully', {
      imageId: result.lastID,
      pieceId: id,
      phaseId: phase_id,
      filename: req.file.filename,
      userId: req.userId
    });

    res.status(201).json({
      id: result.lastID,
      piece_id: parseInt(id),
      phase_id: parseInt(phase_id),
      filename: req.file.filename,
      original_filename: req.file.originalname
    });
  } catch (error) {
    // Clean up file if database operation failed
    if (req.file && existsSync(req.file.path)) {
      unlinkSync(req.file.path);
    }
    // Clean up thumbnail if it exists
    if (req.file?.thumbnailPath && existsSync(req.file.thumbnailPath)) {
      unlinkSync(req.file.thumbnailPath);
    }
    logger.error('Error uploading image', {
      error: error.message,
      stack: error.stack,
      pieceId: req.params?.id,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// GET /api/pieces/:id/images - Get all images for a piece
router.get('/:id/images', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    // Verify piece belongs to user first
    const piece = await db.get('SELECT id FROM ceramic_pieces WHERE id = ? AND user_id = ?', [id, req.userId]);
    if (!piece) {
      return res.status(404).json({ error: 'Piece not found' });
    }

    const images = await db.all(`
      SELECT pi.*, ph.name as phase_name
      FROM piece_images pi
      LEFT JOIN phases ph ON pi.phase_id = ph.id AND ph.user_id = ?
      WHERE pi.piece_id = ?
      ORDER BY pi.created_at DESC
    `, [req.userId, id]);

    res.json(images);
  } catch (error) {
    logger.error('Error fetching images', {
      error: error.message,
      stack: error.stack,
      pieceId: id,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

export default router;

