import express from 'express';
import bcrypt from 'bcrypt';
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
      await db.close();
      return res.status(409).json({ error: 'Username already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await db.run(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username.trim(), passwordHash]
    );

    await db.close();

    // Set session
    req.session.userId = result.lastID;
    req.session.username = username.trim();

    res.status(201).json({
      id: result.lastID,
      username: username.trim(),
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// POST /api/auth/login - Login user
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    console.log(`Login attempt for username: "${username}"`);

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const db = await getDb();

    // Find user
    const user = await db.get('SELECT id, username, password_hash FROM users WHERE username = ?', [username.trim()]);
    
    if (!user) {
      await db.close();
      console.log(`Login attempt failed: User "${username.trim()}" not found`);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      await db.close();
      console.log(`Login attempt failed: Invalid password for user "${username.trim()}"`);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    await db.close();

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;
    
    console.log(`✅ Login successful for user "${user.username}" (ID: ${user.id})`);
    console.log('Session ID:', req.sessionID);

    res.json({
      id: user.id,
      username: user.username,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// POST /api/auth/logout - Logout user
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
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

