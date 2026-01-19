import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';

// Mock getDb before importing the module that uses it
const mockDb = {
  get: jest.fn(),
  run: jest.fn(),
};

jest.unstable_mockModule('../../utils/db.js', () => ({
  getDb: jest.fn(() => Promise.resolve(mockDb)),
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Dynamic import after mocking
const { default: authRouter } = await import('../../routes/auth.js');

describe('Auth API', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
    }));
    app.use('/api/auth', authRouter);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      // Mock registration enabled
      mockDb.get.mockImplementation((query) => {
        if (query.includes('system_settings') && query.includes('registration_enabled')) {
          return Promise.resolve({ value: '1' });
        }
        if (query.includes('SELECT id FROM users')) {
          return Promise.resolve(null); // No existing user
        }
        return Promise.resolve(null);
      });
      mockDb.run.mockResolvedValue({ lastID: 1 });

      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'password123' })
        .expect(201);

      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('username', 'testuser');
    });

    it('should reject registration with existing username', async () => {
      // Mock registration enabled and existing user
      mockDb.get.mockImplementation((query) => {
        if (query.includes('system_settings') && query.includes('registration_enabled')) {
          return Promise.resolve({ value: '1' });
        }
        if (query.includes('SELECT id FROM users')) {
          return Promise.resolve({ id: 1 }); // Existing user
        }
        return Promise.resolve(null);
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'existing', password: 'password123' })
        .expect(409);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration without username or password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'test' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      mockDb.get.mockImplementation((query) => {
        if (query.includes('SELECT') && query.includes('users') && query.includes('username')) {
          return Promise.resolve({
            id: 1,
            username: 'testuser',
            password_hash: hashedPassword,
            is_admin: 0,
            must_change_password: 0,
          });
        }
        return Promise.resolve(null);
      });
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'password123' })
        .expect(200);

      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('username', 'testuser');
    });

    it('should reject login with invalid credentials', async () => {
      mockDb.get.mockResolvedValue(null); // User not found

      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'wrongpassword' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });
});
