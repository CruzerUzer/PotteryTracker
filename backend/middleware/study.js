import { getDb } from '../utils/db.js';
import logger from '../utils/logger.js';

/**
 * Släpper bara igenom användare med users.study_enabled = 1.
 * Läggs efter requireAuth. Flaggan läses från databasen varje gång så att
 * en ändring i Admin slår igenom direkt, utan ny inloggning.
 */
export const requireStudy = async (req, res, next) => {
  try {
    const db = await getDb();
    const user = await db.get('SELECT study_enabled FROM users WHERE id = ?', [req.userId]);
    if (user && user.study_enabled === 1) return next();
    return res.status(403).json({ error: 'Studie är inte aktiverat för ditt konto' });
  } catch (error) {
    logger.error('Error checking study flag', { error: error.message, userId: req.userId });
    return res.status(500).json({ error: 'Kunde inte kontrollera behörigheten' });
  }
};
