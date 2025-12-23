import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

import logger from './utils/logger.js';
import authRouter from './routes/auth.js';
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

// Configure CORS with credentials
const corsOrigin = process.env.CORS_ORIGIN === 'true' 
  ? true 
  : process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || true;

app.use(cors({
  origin: corsOrigin,
  credentials: true
}));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || (NODE_ENV === 'production' 
    ? (() => { throw new Error('SESSION_SECRET must be set in production'); })() 
    : 'pottery-tracker-secret-key-change-in-production'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to false for HTTP in development/WSL, true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // Allow cross-site requests for remote access
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

// Routes
app.use('/api/auth', authRouter);
app.use('/api/phases', phasesRouter);
app.use('/api/materials', materialsRouter);
app.use('/api/pieces', piecesRouter);
app.use('/api/pieces', pieceImagesRouter); // Handles /api/pieces/:id/images routes
app.use('/api/images', imagesRouter); // Handles /api/images/:id/file and /api/images/:id DELETE
app.use('/api/export', exportRouter);
app.use('/api/version', versionRouter);

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

