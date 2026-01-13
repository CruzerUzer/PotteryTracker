# Security Guide - PotteryTracker

This document outlines the security features and best practices implemented in PotteryTracker.

## Table of Contents

1. [Authentication System](#authentication-system)
2. [Rate Limiting](#rate-limiting)
3. [Security Headers](#security-headers)
4. [Input Validation](#input-validation)
5. [Environment Configuration](#environment-configuration)
6. [Best Practices](#best-practices)

## Authentication System

### JWT-Based Authentication

PotteryTracker uses **JSON Web Tokens (JWT)** for secure, stateless authentication.

#### How It Works

1. **User Registration/Login**
   - User provides username and password
   - Password is hashed using **bcrypt** (10 rounds)
   - Server generates two tokens:
     - **Access Token**: Valid for 24 hours (configurable)
     - **Refresh Token**: Valid for 7 days (configurable)
   - Tokens are sent to client and stored in localStorage

2. **Making Authenticated Requests**
   - Client includes access token in `Authorization` header: `Bearer <token>`
   - Server validates token on each request
   - If valid, request proceeds; if invalid/expired, returns 401 error

3. **Token Refresh**
   - When access token expires, client uses refresh token to get new tokens
   - Automatic refresh happens transparently in the API layer
   - If refresh fails, user is redirected to login

#### Token Structure

JWT tokens contain:
- User ID
- Username
- Admin status
- Expiration time
- Issuer and audience claims

#### Security Features

- **Secure Token Storage**: Tokens stored in localStorage (client-side)
- **Token Expiration**: Automatic expiration prevents long-lived sessions
- **Token Verification**: Every request validates token signature and expiration
- **User Validation**: Token is checked against database to ensure user still exists

### Password Security

- **Bcrypt Hashing**: Passwords are hashed using bcrypt with 10 salt rounds
- **No Plain Text**: Passwords are never stored in plain text
- **Password Strength**: Minimum validation (can be enhanced further)

### Configuration

Set these environment variables in `.env`:

```bash
# Generate a strong secret (64+ characters recommended):
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your-very-long-and-random-secret-key

# Token expiration times (examples: 15m, 1h, 24h, 7d)
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
```

**⚠️ IMPORTANT**: Never commit your `.env` file. Always use a strong, random JWT_SECRET in production!

## Rate Limiting

Rate limiting protects against brute force attacks and API abuse.

### Implemented Limiters

1. **Authentication Limiter** (`/api/auth/*`)
   - **Limit**: 5 requests per 15 minutes
   - **Purpose**: Prevents brute force login attempts
   - **Applies to**: Login, register, password reset

2. **General API Limiter** (all API routes)
   - **Limit**: 100 requests per 15 minutes
   - **Purpose**: Prevents API abuse
   - **Applies to**: Pieces, phases, materials, admin routes

3. **Upload Limiter** (`/api/pieces/*/images`)
   - **Limit**: 20 uploads per 15 minutes
   - **Purpose**: Prevents storage abuse
   - **Applies to**: Image uploads

4. **Password Reset Limiter**
   - **Limit**: 3 requests per hour
   - **Purpose**: Prevents password reset abuse
   - **Applies to**: Password reset initiation

### Rate Limit Response

When rate limit is exceeded, the API returns:

```json
{
  "error": "Too many requests",
  "message": "You have exceeded the API rate limit. Please try again later.",
  "retryAfter": 900
}
```

HTTP Status: **429 Too Many Requests**

## Security Headers

PotteryTracker uses **Helmet.js** to set secure HTTP headers:

### Headers Set

- **X-Content-Type-Options**: `nosniff` - Prevents MIME type sniffing
- **X-Frame-Options**: `DENY` - Prevents clickjacking
- **X-XSS-Protection**: `1; mode=block` - XSS protection
- **Strict-Transport-Security**: Forces HTTPS (in production)
- **Content-Security-Policy**: Restricts resource loading
- **Cross-Origin-Resource-Policy**: Controls cross-origin requests

### CORS Configuration

Cross-Origin Resource Sharing is configured to:
- Accept requests from specified origins (configurable via `CORS_ORIGIN`)
- Allow required headers: `Content-Type`, `Authorization`
- Support methods: `GET`, `POST`, `PUT`, `DELETE`, `PATCH`

## Input Validation

### Current Validation

Basic validation is implemented for:
- **Username/Password**: Required, non-empty
- **File Uploads**: Type and size validation
  - Max size: 10MB (configurable)
  - Allowed types: JPEG, PNG, GIF, WebP, HEIC

### Recommended Enhancements

For production use, implement:
1. **Schema Validation** with Joi or Zod (see point 2 in project improvements)
2. **SQL Injection Prevention**: Already using parameterized queries
3. **XSS Prevention**: Sanitize user input on display
4. **CSRF Protection**: Consider adding for forms

## Environment Configuration

### Required Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# Copy from .env.example
cp backend/.env.example backend/.env

# Edit with your values
nano backend/.env
```

### Essential Variables

```bash
# Server
NODE_ENV=production  # or 'development'
PORT=3001

# JWT (REQUIRED)
JWT_SECRET=<generate-strong-random-string>
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Database
DB_PATH=database/database.db

# CORS (comma-separated origins or 'true')
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

# Logging
LOG_LEVEL=info  # debug, info, warn, error
```

## Best Practices

### For Developers

1. **Never Commit Secrets**
   - Add `.env` to `.gitignore`
   - Use `.env.example` for documentation only
   - Use environment variables for all secrets

2. **Rotate Secrets Regularly**
   - Change JWT_SECRET periodically
   - Update secrets after security incidents

3. **Use HTTPS in Production**
   - Always use HTTPS for production deployments
   - Set `HTTPS_ENABLED=true` in production

4. **Keep Dependencies Updated**
   - Regularly run `npm audit`
   - Update packages to patch vulnerabilities

5. **Monitor Logs**
   - Review authentication logs regularly
   - Watch for suspicious rate limit triggers
   - Monitor failed login attempts

### For Administrators

1. **User Management**
   - Review user accounts regularly
   - Disable unused accounts
   - Use strong passwords
   - Enable admin status only when necessary

2. **Database Backups**
   - Regular backups of SQLite database
   - Test restore procedures
   - Store backups securely

3. **Server Security**
   - Keep server OS updated
   - Use firewall rules
   - Limit SSH access
   - Use non-root user for application

4. **Monitoring**
   - Set up logging and monitoring
   - Watch for unusual activity
   - Monitor resource usage

### For Users

1. **Strong Passwords**
   - Use unique, strong passwords
   - Minimum 12 characters recommended
   - Mix of letters, numbers, symbols

2. **Logout When Done**
   - Always logout on shared computers
   - Clear browser data if needed

3. **Report Issues**
   - Report suspicious activity immediately
   - Contact admin for security concerns

## Security Checklist

### Pre-Production

- [ ] Generate strong JWT_SECRET
- [ ] Set NODE_ENV=production
- [ ] Enable HTTPS
- [ ] Configure CORS with specific origins
- [ ] Review and test all authentication flows
- [ ] Run security audit: `npm audit`
- [ ] Test rate limiting
- [ ] Review user permissions
- [ ] Set up database backups
- [ ] Configure logging

### Ongoing

- [ ] Monthly dependency updates
- [ ] Regular log reviews
- [ ] User account audits
- [ ] Database backups verification
- [ ] Security incident response plan
- [ ] Documentation updates

## Reporting Security Issues

If you discover a security vulnerability, please:

1. **Do NOT** open a public GitHub issue
2. Email the maintainer directly
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT.io](https://jwt.io/) - JWT documentation
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [bcrypt Documentation](https://github.com/kelektiv/node.bcrypt.js)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

## Version History

- **v1.4.0+**: JWT authentication, rate limiting, helmet security headers
- **v1.4.0**: Session-based authentication with bcrypt
- **Earlier**: Basic authentication

---

**Last Updated**: January 2026
**Maintainer**: PotteryTracker Development Team
