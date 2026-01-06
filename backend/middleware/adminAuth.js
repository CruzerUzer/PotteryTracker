import { getDb } from '../utils/db.js';

// Admin authentication middleware
export const requireAdmin = async (req, res, next) => {
  if (req.session && req.session.userId) {
    try {
      const db = await getDb();
      const user = await db.get('SELECT is_admin FROM users WHERE id = ?', [req.session.userId]);
      
      if (user && user.is_admin === 1) {
        req.userId = req.session.userId;
        next();
      } else {
        res.status(403).json({ error: 'Admin access required' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Failed to verify admin status' });
    }
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};
