import express from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// GET /api/version - Get backend version information
router.get('/', (req, res) => {
  try {
    const packagePath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    
    res.json({
      backend: {
        version: packageJson.version || 'unknown',
        name: packageJson.name || 'pottery-tracker-backend'
      }
    });
  } catch (error) {
    res.json({
      backend: {
        version: 'unknown',
        name: 'pottery-tracker-backend'
      }
    });
  }
});

export default router;

