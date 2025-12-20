import express from 'express';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { requireAuth } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const dbPath = join(__dirname, '..', 'database', 'database.db');

// All phase routes require authentication
router.use(requireAuth);

// Helper to get database connection
async function getDb() {
  return open({
    filename: dbPath,
    driver: sqlite3.Database
  });
}

// GET /api/phases - Get all phases for the authenticated user
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const phases = await db.all('SELECT * FROM phases WHERE user_id = ? ORDER BY display_order, name', [req.userId]);
    await db.close();
    res.json(phases);
  } catch (error) {
    console.error('Error fetching phases:', error);
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
    await db.close();

    res.status(201).json({ id: result.lastID, name, display_order: display_order || 0 });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Phase with this name already exists' });
    }
    console.error('Error creating phase:', error);
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
      await db.close();
      return res.status(404).json({ error: 'Phase not found' });
    }
    
    const result = await db.run(
      'UPDATE phases SET name = ?, display_order = ? WHERE id = ? AND user_id = ?',
      [name.trim(), display_order || 0, id, req.userId]
    );
    await db.close();

    res.json({ id: parseInt(id), name, display_order: display_order || 0 });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Phase with this name already exists' });
    }
    console.error('Error updating phase:', error);
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
      await db.close();
      return res.status(404).json({ error: 'Phase not found' });
    }
    
    // Check if any pieces are using this phase (only for this user's pieces)
    const pieces = await db.get('SELECT COUNT(*) as count FROM ceramic_pieces WHERE current_phase_id = ? AND user_id = ?', [id, req.userId]);
    if (pieces.count > 0) {
      await db.close();
      return res.status(400).json({ error: 'Cannot delete phase that is in use by ceramic pieces' });
    }

    const result = await db.run('DELETE FROM phases WHERE id = ? AND user_id = ?', [id, req.userId]);
    await db.close();

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Phase not found' });
    }

    res.json({ message: 'Phase deleted successfully' });
  } catch (error) {
    console.error('Error deleting phase:', error);
    res.status(500).json({ error: 'Failed to delete phase' });
  }
});

export default router;



