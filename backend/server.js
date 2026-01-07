import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

import logger from './utils/logger.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import phasesRouter from './routes/phases.js';
import materialsRouter from './routes/materials.js';
import piecesRouter from './routes/pieces.js';
import pieceImagesRouter from './routes/pieceImages.js';
import imagesRouter from './routes/images.js';
import exportRouter from './routes/export.js';
import versionRouter from './routes/version.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust proxy - necessary to correctly detect HTTPS when behind Nginx reverse proxy
// This allows Express to trust the X-Forwarded-Proto header from Nginx
app.set('trust proxy', 1);

// Configure CORS with credentials
const corsOrigin = process.env.CORS_ORIGIN === 'true' 
  ? true 
  : process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || true;

app.use(cors({
  origin: corsOrigin,
  credentials: true
}));

// Session configuration
// When behind Nginx with HTTPS, X-Forwarded-Proto header will be 'https'
// With trust proxy set, req.secure will be true for HTTPS requests
// For production with HTTPS, set HTTPS_ENABLED=true in .env file
const useSecureCookies = process.env.HTTPS_ENABLED === 'true' || 
                         (NODE_ENV === 'production' && process.env.HTTPS_ENABLED !== 'false');

app.use(session({
  secret: process.env.SESSION_SECRET || (NODE_ENV === 'production' 
    ? (() => { throw new Error('SESSION_SECRET must be set in production'); })()
    : 'pottery-tracker-secret-key-change-in-production'),
  resave: false,
  saveUninitialized: false,
  name: 'connect.sid', // Explicit session cookie name
  cookie: {
    secure: useSecureCookies, // true = cookies only sent over HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: useSecureCookies ? 'lax' : false, // 'lax' for same-site requests, 'none' for cross-site
    // Don't set domain - let it default to current domain
    // path defaults to '/'
  }
}));

// Debug middleware to log session issues (remove in production)
if (NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    if (req.path === '/api/auth/me') {
      logger.debug('Session check', {
        hasSession: !!req.session,
        sessionId: req.sessionID,
        userId: req.session?.userId || 'NOT SET',
        username: req.session?.username || 'NOT SET',
        sessionKeys: req.session ? Object.keys(req.session) : [],
        cookies: req.headers.cookie ? 'present' : 'missing',
        'x-forwarded-proto': req.headers['x-forwarded-proto']
      });
    }
    next();
  });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (BEFORE routes to catch all requests)
app.use((req, res, next) => {
  // #region agent log
  console.log('[SERVER] Incoming request:', req.method, req.path, req.originalUrl);
  // #endregion
  next();
});

// Check if database exists
const dbPath = process.env.DB_PATH || join(__dirname, 'database', 'database.db');
if (!existsSync(dbPath)) {
  logger.warn('Database not found. Run "npm run init-db" first.', { dbPath });
}

// Routes - Register version route FIRST (before other routes to ensure it's not intercepted)
app.get('/api/version', (req, res) => {
  // #region agent log
  console.log('[SERVER] Direct version route called - MATCHED!');
  console.log('[SERVER] Request details:', { method: req.method, path: req.path, originalUrl: req.originalUrl });
  // #endregion
  try {
    const packagePath = join(__dirname, 'package.json');
    // #region agent log
    console.log('[SERVER] Reading package.json from:', packagePath);
    // #endregion
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    // #region agent log
    console.log('[SERVER] Package version:', packageJson.version);
    // #endregion
    const response = {
      backend: {
        version: packageJson.version || 'unknown',
        name: packageJson.name || 'pottery-tracker-backend'
      }
    };
    // #region agent log
    console.log('[SERVER] Sending response:', JSON.stringify(response));
    // #endregion
    res.json(response);
  } catch (error) {
    // #region agent log
    console.error('[SERVER] Error in direct version route:', error.message);
    console.error('[SERVER] Error stack:', error.stack);
    // #endregion
    res.json({
      backend: {
        version: 'unknown',
        name: 'pottery-tracker-backend',
        error: error.message
      }
    });
  }
});

// Request logging middleware (after routes are defined, but will log all requests)
app.use((req, res, next) => {
  // #region agent log
  console.log('[SERVER] Incoming request:', req.method, req.path, req.originalUrl);
  // #endregion
  next();
});

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/phases', phasesRouter);
app.use('/api/materials', materialsRouter);
app.use('/api/pieces', piecesRouter);
app.use('/api/pieces', pieceImagesRouter); // Handles /api/pieces/:id/images routes
app.use('/api/images', imagesRouter); // Handles /api/images/:id/file and /api/images/:id DELETE
app.use('/api/export', exportRouter);

// #region agent log
console.log('[SERVER] Direct version route registered at /api/version');
// #endregion

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler (after all routes, before error handler)
app.use((req, res) => {
  // #region agent log
  console.log('[SERVER] 404 - Route not found:', req.method, req.path);
  // #endregion
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    status: err.status || 500
  });
  
  // Don't leak error details in production
  const message = NODE_ENV === 'production' && err.status >= 500
    ? 'Internal server error'
    : err.message || 'Internal server error';
    
  res.status(err.status || 500).json({ 
    error: message 
  });
});

app.listen(PORT, '0.0.0.0', () => {
  logger.info('Server started', {
    port: PORT,
    environment: NODE_ENV,
    localUrl: `http://localhost:${PORT}`,
    networkUrl: `http://0.0.0.0:${PORT}`
  });
});

