import rateLimit from 'express-rate-limit';

/**
 * Rate Limiting Middleware
 *
 * Protects API endpoints from abuse by limiting the number of requests
 * from a single IP address within a time window.
 *
 * Different rate limits are applied to different types of endpoints:
 * - Strict limits for authentication endpoints (prevent brute force)
 * - Moderate limits for general API endpoints
 * - More lenient limits for read-only operations
 */

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force attacks on login/register endpoints
 *
 * Limits: 5 requests per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts',
    message: 'You have exceeded the maximum number of login attempts. Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip successful requests (only failed attempts count)
  skipSuccessfulRequests: true,
  // Handler for when rate limit is exceeded
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000), // Seconds until reset
    });
  },
});

/**
 * General API rate limiter
 * Applied to all API routes to prevent abuse
 *
 * Limits: 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'You have exceeded the API rate limit. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the API rate limit. Please slow down and try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

/**
 * Strict rate limiter for password reset endpoints
 * Prevents abuse of password reset functionality
 *
 * Limits: 3 requests per hour per IP
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 requests per hour
  message: {
    error: 'Too many password reset requests',
    message: 'You have exceeded the maximum number of password reset requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Too many password reset requests from this IP. Please try again after 1 hour.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

/**
 * Moderate rate limiter for file upload endpoints
 * Prevents abuse of file upload functionality
 *
 * Limits: 20 uploads per 15 minutes per IP
 */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 uploads per windowMs
  message: {
    error: 'Too many upload requests',
    message: 'You have exceeded the maximum number of file uploads. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Too many upload requests from this IP. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

/**
 * Lenient rate limiter for read-only operations
 * More generous limits for GET requests
 *
 * Limits: 200 requests per 15 minutes per IP
 */
export const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the read rate limit. Please try again later.',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

export default {
  authLimiter,
  apiLimiter,
  passwordResetLimiter,
  uploadLimiter,
  readLimiter,
};
