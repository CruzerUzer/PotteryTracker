import express from 'express';
import { getDb } from '../utils/db.js';
import { requireAuth } from '../middleware/auth.js';
import logger from '../utils/logger.js';

const router = express.Router();

// All piece routes require authentication
router.use(requireAuth);

// Helper function to check if a phase is the final phase (has the highest display_order) for a user
async function isFinalPhase(db, phaseId, userId) {
  if (!phaseId) {
    return false;
  }
  
  // Get the maximum display_order for this user
  const maxOrderResult = await db.get('SELECT MAX(display_order) as max_order FROM phases WHERE user_id = ?', [userId]);
  const maxOrder = maxOrderResult?.max_order ?? null;
  
  if (maxOrder === null) {
    return false;
  }
  
  // Get the display_order of the given phase (must belong to user)
  const phaseResult = await db.get('SELECT display_order FROM phases WHERE id = ? AND user_id = ?', [phaseId, userId]);
  
  if (!phaseResult) {
    return false;
  }
  
  // Check if this phase has the maximum display_order
  // Convert both to numbers for comparison (SQLite might return as strings)
  return Number(phaseResult.display_order) === Number(maxOrder);
}

// GET /api/pieces - Get all pieces (optional query params: phase_id, search, material_id, date_from, date_to, done)
router.get('/', async (req, res) => {
  try {
    const { phase_id, search, material_id, date_from, date_to, done } = req.query;
    const db = await getDb();

    let query = `
      SELECT
        p.*,
        ph.name as phase_name,
        loc.name as location_name,
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
      LEFT JOIN phases ph ON p.current_phase_id = ph.id AND ph.user_id = p.user_id
      LEFT JOIN locations loc ON p.current_location_id = loc.id AND loc.user_id = p.user_id
      LEFT JOIN piece_materials pm ON p.id = pm.piece_id
      LEFT JOIN piece_images pi ON p.id = pi.piece_id
      WHERE p.user_id = ?
    `;

    const params = [req.userId];
    
    // Filter by phase
    if (phase_id) {
      if (phase_id === 'no-phase') {
        // Filter for pieces with no phase (null current_phase_id)
        query += ' AND p.current_phase_id IS NULL';
      } else {
        query += ' AND p.current_phase_id = ?';
        params.push(phase_id);
      }
    }
    
    // Filter by material
    if (material_id) {
      query += ` AND p.id IN (
        SELECT piece_id FROM piece_materials 
        WHERE material_id = ? AND piece_id IN (
          SELECT id FROM ceramic_pieces WHERE user_id = ?
        )
      )`;
      params.push(material_id, req.userId);
    }
    
    // Search by name or description
    if (search && search.trim()) {
      query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      const searchPattern = `%${search.trim()}%`;
      params.push(searchPattern, searchPattern);
    }
    
    // Filter by done status
    if (done !== undefined) {
      const doneValue = done === 'true' || done === '1' ? 1 : 0;
      query += ' AND p.done = ?';
      params.push(doneValue);
    }
    
    // Filter by date range
    if (date_from) {
      query += ' AND DATE(p.created_at) >= DATE(?)';
      params.push(date_from);
    }
    if (date_to) {
      query += ' AND DATE(p.created_at) <= DATE(?)';
      params.push(date_to);
    }

    query += ' GROUP BY p.id ORDER BY p.created_at DESC';

    const pieces = await db.all(query, params);
    res.json(pieces);
  } catch (error) {
    logger.error('Error fetching pieces', {
      error: error.message,
      stack: error.stack,
      userId: req.userId,
      phaseId: req.query.phase_id
    });
    res.status(500).json({ error: 'Failed to fetch pieces' });
  }
});

// GET /api/pieces/:id - Get a specific piece with materials and images
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    // Get piece with phase and location (must belong to user)
    const piece = await db.get(`
      SELECT p.*, ph.name as phase_name, loc.name as location_name
      FROM ceramic_pieces p
      LEFT JOIN phases ph ON p.current_phase_id = ph.id AND ph.user_id = p.user_id
      LEFT JOIN locations loc ON p.current_location_id = loc.id AND loc.user_id = p.user_id
      WHERE p.id = ? AND p.user_id = ?
    `, [id, req.userId]);

    if (!piece) {
      return res.status(404).json({ error: 'Piece not found' });
    }

    // Get materials (only materials that belong to the user)
    const materials = await db.all(`
      SELECT m.* FROM materials m
      INNER JOIN piece_materials pm ON m.id = pm.material_id
      WHERE pm.piece_id = ? AND m.user_id = ?
    `, [id, req.userId]);

    // Get images (only phases that belong to the user)
    const images = await db.all(`
      SELECT pi.*, ph.name as phase_name
      FROM piece_images pi
      LEFT JOIN phases ph ON pi.phase_id = ph.id AND ph.user_id = ?
      WHERE pi.piece_id = ?
      ORDER BY pi.created_at DESC
    `, [req.userId, id]);

    res.json({
      ...piece,
      materials,
      images
    });
  } catch (error) {
    logger.error('Error fetching piece', {
      error: error.message,
      stack: error.stack,
      pieceId: id,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to fetch piece' });
  }
});

// POST /api/pieces - Create a new piece
router.post('/', async (req, res) => {
  try {
    const { name, description, current_phase_id, current_location_id, material_ids } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Piece name is required' });
    }

    const db = await getDb();

    // Validate phase if provided (must belong to user)
    if (current_phase_id) {
      const phase = await db.get('SELECT id FROM phases WHERE id = ? AND user_id = ?', [current_phase_id, req.userId]);
      if (!phase) {
        return res.status(400).json({ error: 'Invalid phase_id' });
      }
    }

    // Validate location if provided (must belong to user)
    if (current_location_id) {
      const location = await db.get('SELECT id FROM locations WHERE id = ? AND user_id = ?', [current_location_id, req.userId]);
      if (!location) {
        return res.status(400).json({ error: 'Invalid location_id' });
      }
    }

    // Check if the phase is the final phase
    const done = current_phase_id ? await isFinalPhase(db, current_phase_id, req.userId) : false;

    // Insert piece
    const result = await db.run(
      'INSERT INTO ceramic_pieces (user_id, name, description, current_phase_id, current_location_id, done) VALUES (?, ?, ?, ?, ?, ?)',
      [req.userId, name.trim(), description || null, current_phase_id || null, current_location_id || null, done ? 1 : 0]
    );

    const pieceId = result.lastID;

    // Add materials if provided
    if (material_ids && Array.isArray(material_ids) && material_ids.length > 0) {
      // Validate material IDs exist and belong to user
      for (const materialId of material_ids) {
        const material = await db.get('SELECT id FROM materials WHERE id = ? AND user_id = ?', [materialId, req.userId]);
        if (!material) {
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

    logger.info('Piece created', {
      pieceId,
      name,
      phaseId: current_phase_id,
      locationId: current_location_id,
      done,
      userId: req.userId
    });

    res.status(201).json({ id: pieceId, name, description, current_phase_id, current_location_id, done });
  } catch (error) {
    logger.error('Error creating piece', {
      error: error.message,
      stack: error.stack,
      name,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to create piece' });
  }
});

// PUT /api/pieces/:id - Update a piece
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, current_phase_id, current_location_id, material_ids } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Piece name is required' });
    }

    const db = await getDb();

    // Verify piece belongs to user
    const existingPiece = await db.get('SELECT id FROM ceramic_pieces WHERE id = ? AND user_id = ?', [id, req.userId]);
    if (!existingPiece) {
      return res.status(404).json({ error: 'Piece not found' });
    }

    // Validate phase if provided (must belong to user)
    if (current_phase_id) {
      const phase = await db.get('SELECT id FROM phases WHERE id = ? AND user_id = ?', [current_phase_id, req.userId]);
      if (!phase) {
        return res.status(400).json({ error: 'Invalid phase_id' });
      }
    }

    // Validate location if provided (must belong to user)
    if (current_location_id) {
      const location = await db.get('SELECT id FROM locations WHERE id = ? AND user_id = ?', [current_location_id, req.userId]);
      if (!location) {
        return res.status(400).json({ error: 'Invalid location_id' });
      }
    }

    // Check if the phase is the final phase
    const done = current_phase_id ? await isFinalPhase(db, current_phase_id, req.userId) : false;

    // Update piece
    const result = await db.run(
      'UPDATE ceramic_pieces SET name = ?, description = ?, current_phase_id = ?, current_location_id = ?, done = ?, updated_at = datetime("now") WHERE id = ? AND user_id = ?',
      [name.trim(), description || null, current_phase_id || null, current_location_id || null, done ? 1 : 0, id, req.userId]
    );

    // Update materials if provided
    if (material_ids && Array.isArray(material_ids)) {
      // Delete existing materials
      await db.run('DELETE FROM piece_materials WHERE piece_id = ?', [id]);
      
      // Add new materials
      if (material_ids.length > 0) {
        // Validate material IDs exist and belong to user
        for (const materialId of material_ids) {
          const material = await db.get('SELECT id FROM materials WHERE id = ? AND user_id = ?', [materialId, req.userId]);
          if (!material) {
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

    logger.info('Piece updated', {
      pieceId: id,
      name,
      phaseId: current_phase_id,
      locationId: current_location_id,
      done,
      userId: req.userId
    });

    res.json({ id: parseInt(id), name, description, current_phase_id, current_location_id, done });
  } catch (error) {
    logger.error('Error updating piece', {
      error: error.message,
      stack: error.stack,
      pieceId: id,
      userId: req.userId
    });
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

    // Verify piece belongs to user
    const piece = await db.get('SELECT id FROM ceramic_pieces WHERE id = ? AND user_id = ?', [id, req.userId]);
    if (!piece) {
      return res.status(404).json({ error: 'Piece not found' });
    }

    // Validate phase (must belong to user)
    const phase = await db.get('SELECT id FROM phases WHERE id = ? AND user_id = ?', [phase_id, req.userId]);
    if (!phase) {
      return res.status(400).json({ error: 'Invalid phase_id' });
    }

    // Check if the phase is the final phase
    const done = await isFinalPhase(db, phase_id, req.userId);

    const result = await db.run(
      'UPDATE ceramic_pieces SET current_phase_id = ?, done = ?, updated_at = datetime("now") WHERE id = ? AND user_id = ?',
      [phase_id, done ? 1 : 0, id, req.userId]
    );

    logger.info('Piece phase updated', {
      pieceId: id,
      phaseId: phase_id,
      done,
      userId: req.userId
    });

    res.json({ id: parseInt(id), phase_id, done });
  } catch (error) {
    logger.error('Error updating piece phase', {
      error: error.message,
      stack: error.stack,
      pieceId: id,
      phaseId: phase_id,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to update piece phase' });
  }
});

// PATCH /api/pieces/:id/location - Move piece to a different location
router.patch('/:id/location', async (req, res) => {
  try {
    const { id } = req.params;
    const { location_id } = req.body;

    const db = await getDb();

    // Verify piece belongs to user
    const piece = await db.get('SELECT id FROM ceramic_pieces WHERE id = ? AND user_id = ?', [id, req.userId]);
    if (!piece) {
      return res.status(404).json({ error: 'Piece not found' });
    }

    // Validate location if provided (must belong to user)
    if (location_id) {
      const location = await db.get('SELECT id FROM locations WHERE id = ? AND user_id = ?', [location_id, req.userId]);
      if (!location) {
        return res.status(400).json({ error: 'Invalid location_id' });
      }
    }

    const result = await db.run(
      'UPDATE ceramic_pieces SET current_location_id = ?, updated_at = datetime("now") WHERE id = ? AND user_id = ?',
      [location_id || null, id, req.userId]
    );

    logger.info('Piece location updated', {
      pieceId: id,
      locationId: location_id,
      userId: req.userId
    });

    res.json({ id: parseInt(id), location_id: location_id || null });
  } catch (error) {
    logger.error('Error updating piece location', {
      error: error.message,
      stack: error.stack,
      pieceId: id,
      locationId: req.body.location_id,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to update piece location' });
  }
});

// DELETE /api/pieces/:id - Delete a piece
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const db = await getDb();

    // Verify piece belongs to user
    const piece = await db.get('SELECT id FROM ceramic_pieces WHERE id = ? AND user_id = ?', [id, req.userId]);
    if (!piece) {
      return res.status(404).json({ error: 'Piece not found' });
    }

    // Get images to delete files later
    const images = await db.all('SELECT filename FROM piece_images WHERE piece_id = ?', [id]);

    // Delete piece (cascade will handle related records)
    const result = await db.run('DELETE FROM ceramic_pieces WHERE id = ? AND user_id = ?', [id, req.userId]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Piece not found' });
    }

    // Delete image files (optional - could be done in background)
    // Note: We'll handle this in the images route for now

    logger.info('Piece deleted', {
      pieceId: id,
      userId: req.userId,
      imagesDeleted: images.length
    });

    res.json({ message: 'Piece deleted successfully' });
  } catch (error) {
    logger.error('Error deleting piece', {
      error: error.message,
      stack: error.stack,
      pieceId: id,
      userId: req.userId
    });
    res.status(500).json({ error: 'Failed to delete piece' });
  }
});

export default router;


