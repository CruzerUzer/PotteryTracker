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

// GET /api/pieces - Get all pieces (optional query: ?phase_id=X)
router.get('/', async (req, res) => {
  try {
    const { phase_id } = req.query;
    const db = await getDb();

    let query = `
      SELECT 
        p.*,
        ph.name as phase_name,
        COUNT(DISTINCT pm.material_id) as material_count,
        COUNT(DISTINCT pi.id) as image_count,
        (
          SELECT pi2.id 
          FROM piece_images pi2 
          WHERE pi2.piece_id = p.id 
          ORDER BY pi2.created_at DESC 
          LIMIT 1
        ) as latest_image_id
      FROM ceramic_pieces p
      LEFT JOIN phases ph ON p.current_phase_id = ph.id
      LEFT JOIN piece_materials pm ON p.id = pm.piece_id
      LEFT JOIN piece_images pi ON p.id = pi.piece_id
    `;

    const params = [];
    if (phase_id) {
      query += ' WHERE p.current_phase_id = ?';
      params.push(phase_id);
    }

    query += ' GROUP BY p.id ORDER BY p.created_at DESC';

    const pieces = await db.all(query, params);
    await db.close();
    res.json(pieces);
  } catch (error) {
    console.error('Error fetching pieces:', error);
    res.status(500).json({ error: 'Failed to fetch pieces' });
  }
});

// GET /api/pieces/:id - Get a specific piece with materials and images
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    // Get piece with phase
    const piece = await db.get(`
      SELECT p.*, ph.name as phase_name
      FROM ceramic_pieces p
      LEFT JOIN phases ph ON p.current_phase_id = ph.id
      WHERE p.id = ?
    `, [id]);

    if (!piece) {
      await db.close();
      return res.status(404).json({ error: 'Piece not found' });
    }

    // Get materials
    const materials = await db.all(`
      SELECT m.* FROM materials m
      INNER JOIN piece_materials pm ON m.id = pm.material_id
      WHERE pm.piece_id = ?
    `, [id]);

    // Get images
    const images = await db.all(`
      SELECT pi.*, ph.name as phase_name
      FROM piece_images pi
      LEFT JOIN phases ph ON pi.phase_id = ph.id
      WHERE pi.piece_id = ?
      ORDER BY pi.created_at DESC
    `, [id]);

    await db.close();

    res.json({
      ...piece,
      materials,
      images
    });
  } catch (error) {
    console.error('Error fetching piece:', error);
    res.status(500).json({ error: 'Failed to fetch piece' });
  }
});

// POST /api/pieces - Create a new piece
router.post('/', async (req, res) => {
  try {
    const { name, description, current_phase_id, material_ids } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Piece name is required' });
    }

    const db = await getDb();

    // Validate phase if provided
    if (current_phase_id) {
      const phase = await db.get('SELECT id FROM phases WHERE id = ?', [current_phase_id]);
      if (!phase) {
        await db.close();
        return res.status(400).json({ error: 'Invalid phase_id' });
      }
    }

    // Insert piece
    const result = await db.run(
      'INSERT INTO ceramic_pieces (name, description, current_phase_id) VALUES (?, ?, ?)',
      [name.trim(), description || null, current_phase_id || null]
    );

    const pieceId = result.lastID;

    // Add materials if provided
    if (material_ids && Array.isArray(material_ids) && material_ids.length > 0) {
      // Validate material IDs exist
      for (const materialId of material_ids) {
        const material = await db.get('SELECT id FROM materials WHERE id = ?', [materialId]);
        if (!material) {
          await db.close();
          return res.status(400).json({ error: `Invalid material_id: ${materialId}` });
        }
      }
      
      // Insert materials
      for (const materialId of material_ids) {
        await db.run('INSERT INTO piece_materials (piece_id, material_id) VALUES (?, ?)', [
          pieceId,
          parseInt(materialId)
        ]);
      }
    }

    await db.close();

    res.status(201).json({ id: pieceId, name, description, current_phase_id });
  } catch (error) {
    console.error('Error creating piece:', error);
    res.status(500).json({ error: 'Failed to create piece' });
  }
});

// PUT /api/pieces/:id - Update a piece
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, current_phase_id, material_ids } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Piece name is required' });
    }

    const db = await getDb();

    // Validate phase if provided
    if (current_phase_id) {
      const phase = await db.get('SELECT id FROM phases WHERE id = ?', [current_phase_id]);
      if (!phase) {
        await db.close();
        return res.status(400).json({ error: 'Invalid phase_id' });
      }
    }

    // Update piece
    const result = await db.run(
      'UPDATE ceramic_pieces SET name = ?, description = ?, current_phase_id = ?, updated_at = datetime("now") WHERE id = ?',
      [name.trim(), description || null, current_phase_id || null, id]
    );

    if (result.changes === 0) {
      await db.close();
      return res.status(404).json({ error: 'Piece not found' });
    }

    // Update materials if provided
    if (material_ids && Array.isArray(material_ids)) {
      // Delete existing materials
      await db.run('DELETE FROM piece_materials WHERE piece_id = ?', [id]);
      
      // Add new materials
      if (material_ids.length > 0) {
        // Validate material IDs exist
        for (const materialId of material_ids) {
          const material = await db.get('SELECT id FROM materials WHERE id = ?', [materialId]);
          if (!material) {
            await db.close();
            return res.status(400).json({ error: `Invalid material_id: ${materialId}` });
          }
        }
        
        // Insert materials
        for (const materialId of material_ids) {
          await db.run('INSERT INTO piece_materials (piece_id, material_id) VALUES (?, ?)', [
            parseInt(id),
            parseInt(materialId)
          ]);
        }
      }
    }

    await db.close();

    res.json({ id: parseInt(id), name, description, current_phase_id });
  } catch (error) {
    console.error('Error updating piece:', error);
    res.status(500).json({ error: 'Failed to update piece' });
  }
});

// PATCH /api/pieces/:id/phase - Move piece to a different phase
router.patch('/:id/phase', async (req, res) => {
  try {
    const { id } = req.params;
    const { phase_id } = req.body;

    if (!phase_id) {
      return res.status(400).json({ error: 'phase_id is required' });
    }

    const db = await getDb();

    // Validate phase
    const phase = await db.get('SELECT id FROM phases WHERE id = ?', [phase_id]);
    if (!phase) {
      await db.close();
      return res.status(400).json({ error: 'Invalid phase_id' });
    }

    const result = await db.run(
      'UPDATE ceramic_pieces SET current_phase_id = ?, updated_at = datetime("now") WHERE id = ?',
      [phase_id, id]
    );

    await db.close();

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Piece not found' });
    }

    res.json({ id: parseInt(id), phase_id });
  } catch (error) {
    console.error('Error updating piece phase:', error);
    res.status(500).json({ error: 'Failed to update piece phase' });
  }
});

// DELETE /api/pieces/:id - Delete a piece
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const db = await getDb();

    // Get images to delete files later
    const images = await db.all('SELECT filename FROM piece_images WHERE piece_id = ?', [id]);

    // Delete piece (cascade will handle related records)
    const result = await db.run('DELETE FROM ceramic_pieces WHERE id = ?', [id]);
    await db.close();

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Piece not found' });
    }

    // Delete image files (optional - could be done in background)
    // Note: We'll handle this in the images route for now

    res.json({ message: 'Piece deleted successfully' });
  } catch (error) {
    console.error('Error deleting piece:', error);
    res.status(500).json({ error: 'Failed to delete piece' });
  }
});

export default router;


