import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import multer from 'multer';
import { getDb } from '../utils/db.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { createUserArchive, importUserArchive } from '../utils/archive.js';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, unlinkSync, readFileSync } from 'fs';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();
const uploadsDir = process.env.UPLOADS_DIR || resolve(__dirname, '..', 'uploads');
const archivesDir = process.env.ARCHIVES_DIR || resolve(__dirname, '..', 'archives');

// Configure multer for file upload
const upload = multer({
  dest: archivesDir,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB limit
});

// All admin routes require admin authentication
router.use(requireAdmin);

// GET /api/admin/users - List all users with stats
router.get('/users', async (req, res) => {
  try {
    const db = await getDb();
    
    const users = await db.all(`
      SELECT 
        u.id,
        u.username,
        u.is_admin,
        u.last_login,
        u.created_at,
        COUNT(DISTINCT p.id) as pieces_count,
        COUNT(DISTINCT m.id) as materials_count
      FROM users u
      LEFT JOIN ceramic_pieces p ON u.id = p.user_id
      LEFT JOIN materials m ON u.id = m.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);

    res.json(users);
  } catch (error) {
    logger.error('Error fetching users', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/admin/users/:id - Get user details
router.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    const user = await db.get('SELECT id, username, is_admin, last_login, created_at FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    logger.error('Error fetching user', { error: error.message, userId: req.params.id });
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// POST /api/admin/users/:id/reset-password - Generate password reset
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { method } = req.body; // 'temporary' or 'link'
    const db = await getDb();

    const user = await db.get('SELECT id, username FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (method === 'temporary') {
      // Generate temporary password
      const tempPassword = crypto.randomBytes(16).toString('base64');
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      
      await db.run('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?', [passwordHash, id]);
      
      logger.info('Temporary password generated', { userId: id, username: user.username });
      
      res.json({
        method: 'temporary',
        password: tempPassword,
        message: 'Temporary password generated'
      });
    } else if (method === 'link') {
      // Generate reset token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
      
      await db.run(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [id, token, expiresAt]
      );
      
      const resetLink = `${req.protocol}://${req.get('host')}/reset-password/${token}`;
      
      logger.info('Password reset link generated', { userId: id, username: user.username });
      
      res.json({
        method: 'link',
        token: token,
        link: resetLink,
        expiresAt: expiresAt,
        message: 'Reset link generated'
      });
    } else {
      res.status(400).json({ error: 'Invalid method. Use "temporary" or "link"' });
    }
  } catch (error) {
    logger.error('Error resetting password', { error: error.message, userId: req.params.id });
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// POST /api/admin/users/:id/delete - Delete or archive user
router.post('/users/:id/delete', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, archivePassword, deleteServerCopy } = req.body;
    const db = await getDb();

    const user = await db.get('SELECT id, username FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (action === 'archive') {
      // Create archive
      const archiveResult = await createUserArchive(id, archivePassword || null, db, uploadsDir);
      
      // Store archive record
      await db.run(
        'INSERT INTO user_archives (user_id, username, archive_filename, is_encrypted, file_size) VALUES (?, ?, ?, ?, ?)',
        [id, user.username, archiveResult.filename, archiveResult.is_encrypted, archiveResult.size]
      );

      // Delete user if requested (cascade will delete all data)
      if (deleteServerCopy) {
        await db.run('DELETE FROM users WHERE id = ?', [id]);
        logger.info('User archived and deleted', { userId: id, username: user.username, archiveFilename: archiveResult.filename });
      } else {
        logger.info('User archived', { userId: id, username: user.username, archiveFilename: archiveResult.filename });
      }

      res.json({
        message: deleteServerCopy ? 'User archived and deleted' : 'User archived',
        archive: archiveResult
      });
    } else if (action === 'delete') {
      // Delete user (cascade will delete all data)
      await db.run('DELETE FROM users WHERE id = ?', [id]);
      logger.info('User deleted', { userId: id, username: user.username });
      res.json({ message: 'User deleted' });
    } else {
      res.status(400).json({ error: 'Invalid action. Use "delete" or "archive"' });
    }
  } catch (error) {
    logger.error('Error deleting/archiving user', { error: error.message, userId: req.params.id });
    res.status(500).json({ error: 'Failed to delete/archive user' });
  }
});

// POST /api/admin/users/:id/toggle-admin - Toggle admin privileges
router.post('/users/:id/toggle-admin', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();

    const user = await db.get('SELECT id, username, is_admin FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newAdminStatus = user.is_admin === 1 ? 0 : 1;
    await db.run('UPDATE users SET is_admin = ? WHERE id = ?', [newAdminStatus, id]);

    logger.info('Admin status toggled', { userId: id, username: user.username, is_admin: newAdminStatus });

    res.json({
      id: id,
      is_admin: newAdminStatus,
      message: `Admin privileges ${newAdminStatus === 1 ? 'granted' : 'revoked'}`
    });
  } catch (error) {
    logger.error('Error toggling admin status', { error: error.message, userId: req.params.id });
    res.status(500).json({ error: 'Failed to toggle admin status' });
  }
});

// POST /api/admin/users/:id/archive - Create archive for user
router.post('/users/:id/archive', async (req, res) => {
  try {
    const { id } = req.params;
    const { password, storageOption = 'server' } = req.body; // storageOption: 'server', 'download', or 'both'
    const db = await getDb();

    const user = await db.get('SELECT id, username FROM users WHERE id = ?', [id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create archive
    const archiveResult = await createUserArchive(id, password || null, db, uploadsDir);
    
    logger.info('User archive created by admin', { userId: id, username: user.username, filename: archiveResult.filename, storageOption });

    // If download or both, send the file
    if (storageOption === 'download' || storageOption === 'both') {
      const archivePath = resolve(archivesDir, archiveResult.filename);
      
      // Store archive record if storing on server (both or server only)
      if (storageOption === 'both') {
        await db.run(
          'INSERT INTO user_archives (user_id, username, archive_filename, is_encrypted, file_size) VALUES (?, ?, ?, ?, ?)',
          [id, user.username, archiveResult.filename, archiveResult.is_encrypted, archiveResult.size]
        );
      }
      
      res.download(archivePath, archiveResult.filename, (err) => {
        if (err) {
          logger.error('Error sending archive file for download', { error: err.message, userId: id, filename: archiveResult.filename });
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download archive' });
          }
        }
        // If download only, delete the file after sending
        if (storageOption === 'download' && existsSync(archivePath)) {
          try {
            unlinkSync(archivePath);
            logger.info('Archive file deleted after download-only', { userId: id, filename: archiveResult.filename });
          } catch (deleteErr) {
            logger.error('Failed to delete archive file after download', { error: deleteErr.message, userId: id, filename: archiveResult.filename });
          }
        }
      });
    } else {
      // Server only - store record and return JSON response
      await db.run(
        'INSERT INTO user_archives (user_id, username, archive_filename, is_encrypted, file_size) VALUES (?, ?, ?, ?, ?)',
        [id, user.username, archiveResult.filename, archiveResult.is_encrypted, archiveResult.size]
      );
      
      res.json({
        message: 'Archive created and stored on server',
        filename: archiveResult.filename,
        size: archiveResult.size,
        is_encrypted: archiveResult.is_encrypted
      });
    }
  } catch (error) {
    logger.error('Error creating archive for user', { error: error.message, userId: req.params.id });
    res.status(500).json({ error: 'Failed to create archive' });
  }
});

// GET /api/admin/archives - List all archives
router.get('/archives', async (req, res) => {
  try {
    const db = await getDb();
    
    const archives = await db.all('SELECT * FROM user_archives ORDER BY created_at DESC');
    
    res.json(archives);
  } catch (error) {
    logger.error('Error fetching archives', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch archives' });
  }
});

// GET /api/admin/archives/:id/download - Download archive file
router.get('/archives/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    const archive = await db.get('SELECT * FROM user_archives WHERE id = ?', [id]);
    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }

    const archivePath = resolve(archivesDir, archive.archive_filename);
    if (!existsSync(archivePath)) {
      return res.status(404).json({ error: 'Archive file not found' });
    }

    res.download(archivePath, archive.archive_filename);
  } catch (error) {
    logger.error('Error downloading archive', { error: error.message, archiveId: id });
    res.status(500).json({ error: 'Failed to download archive' });
  }
});

// POST /api/admin/archives/:id/delete - Delete archive from server
router.post('/archives/:id/delete', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await getDb();
    
    const archive = await db.get('SELECT * FROM user_archives WHERE id = ?', [id]);
    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }

    const archivePath = resolve(archivesDir, archive.archive_filename);
    if (existsSync(archivePath)) {
      unlinkSync(archivePath);
    }

    await db.run('DELETE FROM user_archives WHERE id = ?', [id]);

    logger.info('Archive deleted', { archiveId: id, filename: archive.archive_filename });

    res.json({ message: 'Archive deleted' });
  } catch (error) {
    logger.error('Error deleting archive', { error: error.message, archiveId: id });
    res.status(500).json({ error: 'Failed to delete archive' });
  }
});

// POST /api/admin/import - Import archive to user
router.post('/import', async (req, res) => {
  try {
    const { archiveId, userId, password } = req.body;
    const db = await getDb();

    const archive = await db.get('SELECT * FROM user_archives WHERE id = ?', [archiveId]);
    if (!archive) {
      return res.status(404).json({ error: 'Archive not found' });
    }

    const user = await db.get('SELECT id FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const archivePath = resolve(archivesDir, archive.archive_filename);
    if (!existsSync(archivePath)) {
      return res.status(404).json({ error: 'Archive file not found' });
    }

    const importResult = await importUserArchive(
      archivePath,
      archive.is_encrypted === 1 ? password : null,
      userId,
      db,
      uploadsDir
    );

    logger.info('Archive imported', { archiveId, userId, result: importResult });

    res.json({
      message: 'Archive imported successfully',
      result: importResult
    });
  } catch (error) {
    logger.error('Error importing archive', { error: error.message, stack: error.stack });
    res.status(500).json({ error: error.message || 'Failed to import archive' });
  }
});

// GET /api/admin/registration-status - Get registration status
router.get('/registration-status', async (req, res) => {
  try {
    const db = await getDb();
    
    const enabled = await db.get("SELECT value FROM system_settings WHERE key = 'registration_enabled'");
    const message = await db.get("SELECT value FROM system_settings WHERE key = 'registration_message'");
    
    res.json({
      enabled: enabled?.value === '1',
      message: message?.value || null
    });
  } catch (error) {
    logger.error('Error fetching registration status', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch registration status' });
  }
});

// POST /api/admin/registration-status - Set registration status
router.post('/registration-status', async (req, res) => {
  try {
    const { enabled, message } = req.body;
    const db = await getDb();
    
    await db.run(
      "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('registration_enabled', ?, datetime('now'))",
      [enabled ? '1' : '0']
    );
    
    if (message !== undefined) {
      if (message && message.trim()) {
        await db.run(
          "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('registration_message', ?, datetime('now'))",
          [message.trim()]
        );
      } else {
        await db.run("DELETE FROM system_settings WHERE key = 'registration_message'");
      }
    }

    logger.info('Registration status updated', { enabled, hasMessage: !!message });

    res.json({
      enabled: enabled,
      message: message || null
    });
  } catch (error) {
    logger.error('Error updating registration status', { error: error.message });
    res.status(500).json({ error: 'Failed to update registration status' });
  }
});

export default router;

