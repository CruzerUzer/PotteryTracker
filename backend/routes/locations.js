import express from 'express';
import { getDb } from '../utils/db.js';
import { requireAuth } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// All location routes require authentication
router.use(requireAuth);

// GET /api/locations - Get all locations for the authenticated user
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const locations = await db.all('SELECT * FROM locations WHERE user_id = ? ORDER BY display_order, name', [req.userId]);
    res.json(locations);
  } catch (error) {
    logger.error('Error fetching locations', {
      error: error.message,
      stack: error.stack,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// POST /api/locations - Create a new location
router.post('/', async (req, res) => {
  try {
    const { name, display_order } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Location name is required' });
    }

    const db = await getDb();
    const result = await db.run(
      'INSERT INTO locations (user_id, name, display_order) VALUES (?, ?, ?)',
      [req.userId, name.trim(), display_order || 0]
    );

    logger.info('Location created', { locationId: result.lastID, name, userId: req.userId });
    res.status(201).json({ id: result.lastID, name, display_order: display_order || 0 });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      logger.warn('Location creation failed: duplicate name', { name, userId: req.userId });
      return res.status(409).json({ error: 'Location with this name already exists' });
    }
    logger.error('Error creating location', {
      error: error.message,
      stack: error.stack,
      name,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to create location' });
  }
});

// PUT /api/locations/:id - Update a location
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, display_order } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Location name is required' });
    }

    const db = await getDb();
    // Verify location belongs to user before updating
    const location = await db.get('SELECT id FROM locations WHERE id = ? AND user_id = ?', [id, req.userId]);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const result = await db.run(
      'UPDATE locations SET name = ?, display_order = ? WHERE id = ? AND user_id = ?',
      [name.trim(), display_order || 0, id, req.userId]
    );

    logger.info('Location updated', { locationId: id, name, userId: req.userId });
    res.json({ id: parseInt(id), name, display_order: display_order || 0 });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      logger.warn('Location update failed: duplicate name', { locationId: id, name, userId: req.userId });
      return res.status(409).json({ error: 'Location with this name already exists' });
    }
    logger.error('Error updating location', {
      error: error.message,
      stack: error.stack,
      locationId: id,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// DELETE /api/locations/:id - Delete a location
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const db = await getDb();

    // Verify location belongs to user
    const location = await db.get('SELECT id FROM locations WHERE id = ? AND user_id = ?', [id, req.userId]);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Check if any pieces are using this location (only for this user's pieces)
    const pieces = await db.get('SELECT COUNT(*) as count FROM ceramic_pieces WHERE current_location_id = ? AND user_id = ?', [id, req.userId]);
    if (pieces.count > 0) {
      return res.status(400).json({ error: 'Cannot delete location that is in use by ceramic pieces' });
    }

    const result = await db.run('DELETE FROM locations WHERE id = ? AND user_id = ?', [id, req.userId]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }

    logger.info('Location deleted', { locationId: id, userId: req.userId });
    res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    logger.error('Error deleting location', {
      error: error.message,
      stack: error.stack,
      locationId: id,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

export default router;
