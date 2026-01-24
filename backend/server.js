import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync } from 'fs';

import logger from './utils/logger.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import phasesRouter from './routes/phases.js';
import locationsRouter from './routes/locations.js';
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

// Security headers with Helmet
app.use(helmet({
  // Disable contentSecurityPolicy as it may interfere with frontend
  contentSecurityPolicy: false,
  // Allow cross-origin resource sharing
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Rate limiting configuration
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs for auth endpoints
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' // Skip in test environment
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per minute
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' // Skip in test environment
});

// Apply general API rate limiter to all /api routes
app.use('/api', apiLimiter);

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
    path: '/', // Explicitly set path
    // Don't set domain - let it default to current domain (potterytracker.faris.se)
  }
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Check if database exists
const dbPath = process.env.DB_PATH || join(__dirname, 'database', 'database.db');
if (!existsSync(dbPath)) {
  logger.warn('Database not found. Run "npm run init-db" first.', { dbPath });
}

// Routes - Register version route FIRST (before other routes to ensure it's not intercepted)
app.get('/api/version', (req, res) => {
  try {
    const packagePath = join(__dirname, 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    res.json({
      backend: {
        version: packageJson.version || 'unknown',
        name: packageJson.name || 'pottery-tracker-backend'
      }
    });
  } catch (error) {
    logger.error('Error reading backend version', { error: error.message });
    res.json({
      backend: {
        version: 'unknown',
        name: 'pottery-tracker-backend',
        error: error.message
      }
    });
  }
});

// Apply stricter rate limiting to auth endpoints (login, register)
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/phases', phasesRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/materials', materialsRouter);
app.use('/api/pieces', piecesRouter);
app.use('/api/pieces', pieceImagesRouter); // Handles /api/pieces/:id/images routes
app.use('/api/images', imagesRouter); // Handles /api/images/:id/file and /api/images/:id DELETE
app.use('/api/export', exportRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler (after all routes, before error handler)
app.use((req, res) => {
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

