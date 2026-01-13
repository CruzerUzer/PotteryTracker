import { verifyToken, extractTokenFromHeader } from '../utils/jwt.js';
import { getDb } from '../utils/db.js';

/**
 * Authentication middleware using JWT tokens
 *
 * Checks for a valid JWT token in the Authorization header (Bearer token)
 * If valid, attaches user information to req.user and req.userId
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const requireAuth = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided. Please include Authorization header with Bearer token.'
      });
    }

    // Verify and decode the token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return res.status(401).json({
        error: 'Invalid or expired token',
        message: error.message
      });
    }

    // Verify user still exists in database
    const db = await getDb();
    const user = await db.get(
      'SELECT id, username, is_admin FROM users WHERE id = ?',
      [decoded.id]
    );

    if (!user) {
      return res.status(401).json({
        error: 'User not found',
        message: 'The user associated with this token no longer exists.'
      });
    }

    // Attach user information to request object for use in route handlers
    req.userId = user.id;
    req.user = {
      id: user.id,
      username: user.username,
      isAdmin: user.is_admin,
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: 'An error occurred during authentication.'
    });
  }
};

/**
 * Optional authentication middleware
 * Similar to requireAuth but doesn't fail if no token is provided
 * Useful for endpoints that have different behavior for authenticated vs anonymous users
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      // No token provided, continue without authentication
      return next();
    }

    // Try to verify token
    try {
      const decoded = verifyToken(token);

      // Verify user exists
      const db = await getDb();
      const user = await db.get(
        'SELECT id, username, is_admin FROM users WHERE id = ?',
        [decoded.id]
      );

      if (user) {
        req.userId = user.id;
        req.user = {
          id: user.id,
          username: user.username,
          isAdmin: user.is_admin,
        };
      }
    } catch (error) {
      // Invalid token, but we don't fail - just continue without auth
      console.log('Invalid token in optional auth, continuing without authentication');
    }

    next();
  } catch (error) {
    console.error('Optional authentication error:', error);
    next(); // Don't fail on errors in optional auth
  }
};
