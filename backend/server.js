import express from 'express';
import cors from 'cors';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

import phasesRouter from './routes/phases.js';
import materialsRouter from './routes/materials.js';
import piecesRouter from './routes/pieces.js';
import pieceImagesRouter from './routes/pieceImages.js';
import imagesRouter from './routes/images.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Check if database exists
const dbPath = join(__dirname, 'database', 'database.db');
if (!existsSync(dbPath)) {
  console.warn('Warning: Database not found. Run "npm run init-db" first.');
}

// Routes
app.use('/api/phases', phasesRouter);
app.use('/api/materials', materialsRouter);
app.use('/api/pieces', piecesRouter);
app.use('/api/pieces', pieceImagesRouter); // Handles /api/pieces/:id/images routes
app.use('/api/images', imagesRouter); // Handles /api/images/:id/file and /api/images/:id DELETE

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal server error' 
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

