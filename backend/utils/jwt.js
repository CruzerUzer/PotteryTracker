import jwt from 'jsonwebtoken';
import { config } from 'dotenv';

config();

/**
 * JWT utility functions for token generation and verification
 *
 * Security features:
 * - Tokens expire after 24 hours (configurable via JWT_EXPIRES_IN)
 * - Refresh tokens for extended sessions (7 days)
 * - Secret key should be set in .env file
 */

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'; // Default 24 hours
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d'; // Default 7 days

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  WARNING: JWT_SECRET not set in .env file. Using default secret (not secure for production)');
}

/**
 * Generate an access token for a user
 * @param {Object} user - User object with id, username, is_admin
 * @returns {string} JWT access token
 */
export const generateAccessToken = (user) => {
  const payload = {
    id: user.id,
    username: user.username,
    isAdmin: user.is_admin || false,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'pottery-tracker',
    audience: 'pottery-tracker-client',
  });
};

/**
 * Generate a refresh token for extended sessions
 * @param {Object} user - User object with id
 * @returns {string} JWT refresh token
 */
export const generateRefreshToken = (user) => {
  const payload = {
    id: user.id,
    type: 'refresh',
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
    issuer: 'pottery-tracker',
    audience: 'pottery-tracker-client',
  });
};

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'pottery-tracker',
      audience: 'pottery-tracker-client',
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token has expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    } else {
      throw new Error('Token verification failed');
    }
  }
};

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Token or null if not found
 */
export const extractTokenFromHeader = (authHeader) => {
  if (!authHeader) {
    return null;
  }

  // Expected format: "Bearer <token>"
  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

/**
 * Generate both access and refresh tokens
 * @param {Object} user - User object
 * @returns {Object} Object with accessToken and refreshToken
 */
export const generateTokenPair = (user) => {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
  };
};

export default {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  extractTokenFromHeader,
  generateTokenPair,
};
