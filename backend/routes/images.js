import express from 'express';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { unlinkSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const dbPath = join(__dirname, '..', 'database', 'database.db');
const uploadsDir = resolve(__dirname, '..', 'uploads');

async function getDb() {
  return open({
    filename: dbPath,
    driver: sqlite3.Database
  });
}

// GET /api/images/:id/file - Serve image file
router.get('/:id/file', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    const image = await db.get('SELECT filename FROM piece_images WHERE id = ?', [id]);
    await db.close();

    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const filePath = resolve(uploadsDir, image.filename);
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'Image file not found' });
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ error: 'Failed to serve image' });
  }
});

// DELETE /api/images/:id - Delete an image
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    const image = await db.get('SELECT filename FROM piece_images WHERE id = ?', [id]);
    
    if (!image) {
      await db.close();
      return res.status(404).json({ error: 'Image not found' });
    }

    // Delete from database
    await db.run('DELETE FROM piece_images WHERE id = ?', [id]);
    await db.close();

    // Delete file
    const filePath = resolve(uploadsDir, image.filename);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

export default router;
