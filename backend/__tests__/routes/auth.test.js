import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcrypt';
import authRouter from '../../routes/auth.js';
import { getDb } from '../../utils/db.js';

// Mock dependencies
jest.mock('../../utils/db.js');
jest.mock('../../utils/logger.js', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('Auth API', () => {
  let app;
  let mockDb;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock database
    mockDb = {
      get: jest.fn(),
      run: jest.fn(),
    };
    getDb.mockResolvedValue(mockDb);

    app.use('/api/auth', authRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      mockDb.get.mockResolvedValue(null); // No existing user
      mockDb.run.mockResolvedValue({ lastID: 1 });

      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser', password: 'password123' })
        .expect(201);

      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('username', 'testuser');
      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should reject registration with existing username', async () => {
      mockDb.get.mockResolvedValue({ id: 1 }); // Existing user

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
      mockDb.get.mockResolvedValue({
        id: 1,
        username: 'testuser',
        password_hash: hashedPassword,
      });

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


