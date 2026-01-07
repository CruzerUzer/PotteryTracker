import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { getDb } from '../utils/db.js';
import logger from '../utils/logger.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/register - Register a new user
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (username.trim().length === 0 || password.length === 0) {
      return res.status(400).json({ error: 'Username and password cannot be empty' });
    }

    const db = await getDb();

    // Check if registration is enabled
    const registrationSetting = await db.get("SELECT value FROM system_settings WHERE key = 'registration_enabled'");
    if (!registrationSetting || registrationSetting.value !== '1') {
      const messageSetting = await db.get("SELECT value FROM system_settings WHERE key = 'registration_message'");
      const errorMessage = messageSetting?.value || 'Registration is currently closed by administrator';
      return res.status(403).json({ error: errorMessage });
    }

    // Check if username already exists
    const existingUser = await db.get('SELECT id FROM users WHERE username = ?', [username.trim()]);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await db.run(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username.trim(), passwordHash]
    );

    const userId = result.lastID;

    // Create default phases for the new user
    const defaultPhases = [
      { name: 'På tork', display_order: 1 },
      { name: 'Skröjbränd', display_order: 2 },
      { name: 'Glaserad', display_order: 3 },
      { name: 'Glasyrbränd', display_order: 4 }
    ];

    for (const phase of defaultPhases) {
      await db.run(
        'INSERT INTO phases (user_id, name, display_order) VALUES (?, ?, ?)',
        [userId, phase.name, phase.display_order]
      );
    }

    // Set session
    req.session.userId = userId;
    req.session.username = username.trim();

    logger.info('User registered successfully with default phases', { 
      userId: userId, 
      username: username.trim(),
      phasesCreated: defaultPhases.length 
    });
    
    res.status(201).json({
      id: userId,
      username: username.trim(),
      message: 'User created successfully'
    });
  } catch (error) {
    logger.error('Error registering user', {
      error: error.message,
      stack: error.stack,
      username: req.body?.username
    });
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// POST /api/auth/login - Login user
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    logger.debug('Login attempt', { username: username });

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const db = await getDb();

    // Find user
    const user = await db.get('SELECT id, username, password_hash, is_admin FROM users WHERE username = ?', [username.trim()]);
    
    if (!user) {
      logger.warn('Login attempt failed: User not found', { username: username.trim() });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      logger.warn('Login attempt failed: Invalid password', { username: username.trim() });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Update last_login (non-blocking - column may not exist if migration not run)
    try {
      await db.run('UPDATE users SET last_login = datetime("now") WHERE id = ?', [user.id]);
    } catch (error) {
      // Column may not exist if migration hasn't been run - log but don't fail login
      logger.debug('Could not update last_login', { error: error.message, userId: user.id });
    }

    // Set session data
    req.session.userId = user.id;
    req.session.username = user.username;
    
    logger.info('Login successful', { userId: user.id, username: user.username, sessionId: req.sessionID });

    // Send response - express-session will automatically save the session
    res.json({
      id: user.id,
      username: user.username,
      is_admin: user.is_admin === 1,
      message: 'Login successful'
    });
    
    // Explicitly save session after response (non-blocking)
    // This ensures the session is persisted even if response is sent quickly
    req.session.save();
  } catch (error) {
    logger.error('Error logging in', {
      error: error.message,
      stack: error.stack,
      username: req.body?.username
    });
    res.status(500).json({ error: 'Failed to login' });
  }
});

// POST /api/auth/logout - Logout user
router.post('/logout', (req, res) => {
  const userId = req.session?.userId;
  req.session.destroy((err) => {
    if (err) {
      logger.error('Error destroying session', {
        error: err.message,
        stack: err.stack,
        userId: userId
      });
      return res.status(500).json({ error: 'Failed to logout' });
    }
    logger.info('User logged out', { userId: userId });
    res.json({ message: 'Logout successful' });
  });
});

// GET /api/auth/me - Get current user
router.get('/me', async (req, res) => {
  if (req.session && req.session.userId) {
    try {
      const db = await getDb();
      const user = await db.get('SELECT id, username, is_admin FROM users WHERE id = ?', [req.session.userId]);
      if (user) {
        res.json({
          id: user.id,
          username: user.username,
          is_admin: user.is_admin === 1
        });
      } else {
        res.status(401).json({ error: 'User not found' });
      }
    } catch (error) {
      logger.error('Error fetching user', { error: error.message });
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

// GET /api/auth/registration-status - Get registration status (public)
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

// POST /api/auth/reset-password/:token - Reset password using token
router.post('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length === 0) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const db = await getDb();
    
    // Find token
    const tokenRecord = await db.get('SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0', [token]);
    if (!tokenRecord) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }

    // Check if token is expired
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Token has expired' });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 10);

    // Update user password
    await db.run('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [passwordHash, tokenRecord.user_id]);

    // Mark token as used
    await db.run('UPDATE password_reset_tokens SET used = 1 WHERE id = ?', [tokenRecord.id]);

    logger.info('Password reset successful', { userId: tokenRecord.user_id });

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    logger.error('Error resetting password', { error: error.message });
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// POST /api/auth/change-password - Change password (requires auth)
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length === 0) {
      return res.status(400).json({ error: 'New password is required' });
    }

    const db = await getDb();
    const user = await db.get('SELECT password_hash, must_change_password FROM users WHERE id = ?', [req.userId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If user must change password, don't require current password
    if (user.must_change_password !== 1) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required' });
      }

      const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.run('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?', [passwordHash, req.userId]);

    logger.info('Password changed', { userId: req.userId });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Error changing password', { error: error.message });
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;

