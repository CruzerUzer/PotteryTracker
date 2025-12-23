import express from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router({ mergeParams: true });

// GET /api/version - Get backend version information
router.get('/', (req, res) => {
  // #region agent log
  console.log('[VERSION] Route handler called');
  console.log('[VERSION] Request path:', req.path);
  console.log('[VERSION] Request originalUrl:', req.originalUrl);
  // #endregion
  // #region agent log
  console.log('[VERSION] Endpoint called');
  // #endregion
  try {
    const packagePath = join(__dirname, '..', 'package.json');
    // #region agent log
    console.log('[VERSION] Package path:', packagePath);
    console.log('[VERSION] __dirname:', __dirname);
    // #endregion
    
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
    // #region agent log
    console.log('[VERSION] Package JSON loaded:', { version: packageJson.version, name: packageJson.name });
    // #endregion
    
    const version = packageJson.version || 'unknown';
    // #region agent log
    console.log('[VERSION] Returning version:', version);
    // #endregion
    
    res.json({
      backend: {
        version: version,
        name: packageJson.name || 'pottery-tracker-backend'
      }
    });
  } catch (error) {
    // #region agent log
    console.error('[VERSION] Error reading backend version:', error.message);
    console.error('[VERSION] Error stack:', error.stack);
    console.error('[VERSION] Package path attempted:', join(__dirname, '..', 'package.json'));
    console.error('[VERSION] __dirname:', __dirname);
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

export default router;

