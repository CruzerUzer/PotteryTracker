import express from 'express';
import { getDb } from '../utils/db.js';
import { requireAuth } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// All material routes require authentication
router.use(requireAuth);

// GET /api/materials - Get all materials for the authenticated user
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const materials = await db.all('SELECT * FROM materials WHERE user_id = ? ORDER BY type, name', [req.userId]);
    res.json(materials);
  } catch (error) {
    logger.error('Error fetching materials', {
      error: error.message,
      stack: error.stack,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

// POST /api/materials - Create a new material
router.post('/', async (req, res) => {
  try {
    const { name, type } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Material name is required' });
    }

    const validTypes = ['clay', 'glaze', 'other'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({ error: 'Material type must be one of: clay, glaze, other' });
    }

    const db = await getDb();
    const result = await db.run(
      'INSERT INTO materials (user_id, name, type) VALUES (?, ?, ?)',
      [req.userId, name.trim(), type]
    );

    logger.info('Material created', { materialId: result.lastID, name, type, userId: req.userId });
    res.status(201).json({ id: result.lastID, name: name.trim(), type });
  } catch (error) {
    logger.error('Error creating material', {
      error: error.message,
      stack: error.stack,
      name,
      type,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to create material' });
  }
});

// PUT /api/materials/:id - Update a material
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Material name is required' });
    }

    const validTypes = ['clay', 'glaze', 'other'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({ error: 'Material type must be one of: clay, glaze, other' });
    }

    const db = await getDb();
    // Verify material belongs to user
    const material = await db.get('SELECT id FROM materials WHERE id = ? AND user_id = ?', [id, req.userId]);
    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }
    
    const result = await db.run(
      'UPDATE materials SET name = ?, type = ? WHERE id = ? AND user_id = ?',
      [name.trim(), type, id, req.userId]
    );

    logger.info('Material updated', { materialId: id, name, type, userId: req.userId });
    res.json({ id: parseInt(id), name: name.trim(), type });
  } catch (error) {
    logger.error('Error updating material', {
      error: error.message,
      stack: error.stack,
      materialId: id,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to update material' });
  }
});

// DELETE /api/materials/:id - Delete a material
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const db = await getDb();
    // Verify material belongs to user
    const material = await db.get('SELECT id FROM materials WHERE id = ? AND user_id = ?', [id, req.userId]);
    if (!material) {
      return res.status(404).json({ error: 'Material not found' });
    }
    
    const result = await db.run('DELETE FROM materials WHERE id = ? AND user_id = ?', [id, req.userId]);

    logger.info('Material deleted', { materialId: id, userId: req.userId });
    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    logger.error('Error deleting material', {
      error: error.message,
      stack: error.stack,
      materialId: id,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to delete material' });
  }
});

export default router;



