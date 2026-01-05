import { getDb } from '../utils/db.js';
import logger from '../utils/logger.js';

// Admin authentication middleware
export const requireAdmin = async (req, res, next) => {
  logger.debug('requireAdmin middleware', { 
    hasSession: !!req.session, 
    userId: req.session?.userId,
    sessionId: req.sessionID 
  });
  
  if (req.session && req.session.userId) {
    try {
      const db = await getDb();
      const user = await db.get('SELECT is_admin FROM users WHERE id = ?', [req.session.userId]);
      
      logger.debug('Admin check', { userId: req.session.userId, isAdmin: user?.is_admin });
      
      if (user && user.is_admin === 1) {
        req.userId = req.session.userId;
        next();
      } else {
        logger.warn('Admin access denied', { userId: req.session.userId, isAdmin: user?.is_admin });
        res.status(403).json({ error: 'Admin access required' });
      }
    } catch (error) {
      logger.error('Error in requireAdmin', { error: error.message });
      res.status(500).json({ error: 'Failed to verify admin status' });
    }
  } else {
    logger.warn('Authentication required - no session or userId', { 
      hasSession: !!req.session,
      sessionId: req.sessionID 
    });
    res.status(401).json({ error: 'Authentication required' });
  }
};
