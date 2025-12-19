import express from 'express';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const dbPath = join(__dirname, '..', 'database', 'database.db');

async function getDb() {
  return open({
    filename: dbPath,
    driver: sqlite3.Database
  });
}

// GET /api/materials - Get all materials
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const materials = await db.all('SELECT * FROM materials ORDER BY type, name');
    await db.close();
    res.json(materials);
  } catch (error) {
    console.error('Error fetching materials:', error);
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
      'INSERT INTO materials (name, type) VALUES (?, ?)',
      [name.trim(), type]
    );
    await db.close();

    res.status(201).json({ id: result.lastID, name: name.trim(), type });
  } catch (error) {
    console.error('Error creating material:', error);
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
    const result = await db.run(
      'UPDATE materials SET name = ?, type = ? WHERE id = ?',
      [name.trim(), type, id]
    );
    await db.close();

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Material not found' });
    }

    res.json({ id: parseInt(id), name: name.trim(), type });
  } catch (error) {
    console.error('Error updating material:', error);
    res.status(500).json({ error: 'Failed to update material' });
  }
});

// DELETE /api/materials/:id - Delete a material
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const db = await getDb();
    const result = await db.run('DELETE FROM materials WHERE id = ?', [id]);
    await db.close();

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Material not found' });
    }

    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    console.error('Error deleting material:', error);
    res.status(500).json({ error: 'Failed to delete material' });
  }
});

export default router;



