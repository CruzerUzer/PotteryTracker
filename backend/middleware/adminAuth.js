import { getDb } from '../utils/db.js';

// Admin authentication middleware
// Checks session first (isAdmin cached at login) to avoid N+1 queries
// Falls back to database query for backwards compatibility with existing sessions
export const requireAdmin = async (req, res, next) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Check cached admin status in session first
  if (req.session.isAdmin === true) {
    req.userId = req.session.userId;
    return next();
  }

  // Fallback to database query if isAdmin not in session (backwards compatibility)
  if (req.session.isAdmin === undefined) {
    try {
      const db = await getDb();
      const user = await db.get('SELECT is_admin FROM users WHERE id = ?', [req.session.userId]);

      if (user && user.is_admin === 1) {
        // Cache in session for future requests
        req.session.isAdmin = true;
        req.userId = req.session.userId;
        return next();
      } else {
        // Cache non-admin status too
        req.session.isAdmin = false;
      }
    } catch (error) {
      return res.status(500).json({ error: 'Failed to verify admin status' });
    }
  }

  res.status(403).json({ error: 'Admin access required' });
};
