import express from 'express';
import { getDb } from '../utils/db.js';
import { requireAuth } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// All phase routes require authentication
router.use(requireAuth);

// GET /api/phases - Get all phases for the authenticated user
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const phases = await db.all('SELECT * FROM phases WHERE user_id = ? ORDER BY display_order, name', [req.userId]);
    res.json(phases);
  } catch (error) {
    logger.error('Error fetching phases', {
      error: error.message,
      stack: error.stack,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to fetch phases' });
  }
});

// POST /api/phases - Create a new phase
router.post('/', async (req, res) => {
  try {
    const { name, display_order } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Phase name is required' });
    }

    const db = await getDb();
    const result = await db.run(
      'INSERT INTO phases (user_id, name, display_order) VALUES (?, ?, ?)',
      [req.userId, name.trim(), display_order || 0]
    );

    logger.info('Phase created', { phaseId: result.lastID, name, userId: req.userId });
    res.status(201).json({ id: result.lastID, name, display_order: display_order || 0 });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      logger.warn('Phase creation failed: duplicate name', { name: req.body?.name, userId: req.userId });
      return res.status(409).json({ error: 'Phase with this name already exists' });
    }
    logger.error('Error creating phase', {
      error: error.message,
      stack: error.stack,
      name: req.body?.name,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to create phase' });
  }
});

// PUT /api/phases/:id - Update a phase
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, display_order } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Phase name is required' });
    }

    const db = await getDb();
    // Verify phase belongs to user before updating
    const phase = await db.get('SELECT id FROM phases WHERE id = ? AND user_id = ?', [id, req.userId]);
    if (!phase) {
      return res.status(404).json({ error: 'Phase not found' });
    }
    
    const result = await db.run(
      'UPDATE phases SET name = ?, display_order = ? WHERE id = ? AND user_id = ?',
      [name.trim(), display_order || 0, id, req.userId]
    );

    logger.info('Phase updated', { phaseId: id, name, userId: req.userId });
    res.json({ id: parseInt(id), name, display_order: display_order || 0 });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      logger.warn('Phase update failed: duplicate name', { phaseId: req.params?.id, name: req.body?.name, userId: req.userId });
      return res.status(409).json({ error: 'Phase with this name already exists' });
    }
    logger.error('Error updating phase', {
      error: error.message,
      stack: error.stack,
      phaseId: req.params?.id,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to update phase' });
  }
});

// DELETE /api/phases/:id - Delete a phase
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const db = await getDb();
    
    // Verify phase belongs to user
    const phase = await db.get('SELECT id FROM phases WHERE id = ? AND user_id = ?', [id, req.userId]);
    if (!phase) {
      return res.status(404).json({ error: 'Phase not found' });
    }
    
    // Check if any pieces are using this phase (only for this user's pieces)
    const pieces = await db.get('SELECT COUNT(*) as count FROM ceramic_pieces WHERE current_phase_id = ? AND user_id = ?', [id, req.userId]);
    if (pieces.count > 0) {
      return res.status(400).json({ error: 'Cannot delete phase that is in use by ceramic pieces' });
    }

    const result = await db.run('DELETE FROM phases WHERE id = ? AND user_id = ?', [id, req.userId]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Phase not found' });
    }

    logger.info('Phase deleted', { phaseId: id, userId: req.userId });
    res.json({ message: 'Phase deleted successfully' });
  } catch (error) {
    logger.error('Error deleting phase', {
      error: error.message,
      stack: error.stack,
      phaseId: req.params?.id,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to delete phase' });
  }
});

export default router;



