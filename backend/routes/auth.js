import express from 'express';
import bcrypt from 'bcrypt';
import { getDb } from '../utils/db.js';
import logger from '../utils/logger.js';

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
    const user = await db.get('SELECT id, username, password_hash FROM users WHERE username = ?', [username.trim()]);
    
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

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;
    
    logger.info('Login successful', { userId: user.id, username: user.username, sessionId: req.sessionID });

    res.json({
      id: user.id,
      username: user.username,
      message: 'Login successful'
    });
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
router.get('/me', (req, res) => {
  if (req.session && req.session.userId) {
    res.json({
      id: req.session.userId,
      username: req.session.username
    });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

export default router;

