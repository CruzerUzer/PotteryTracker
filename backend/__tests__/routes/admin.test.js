import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock database
const mockDb = {
  all: jest.fn(),
  get: jest.fn(),
  run: jest.fn(),
};

// Mock requireAdmin
const mockRequireAdmin = jest.fn((req, res, next) => {
  req.userId = 1;
  req.session = { userId: 1, isAdmin: true };
  next();
});

jest.unstable_mockModule('../../middleware/adminAuth.js', () => ({
  requireAdmin: mockRequireAdmin,
}));

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

jest.unstable_mockModule('../../utils/paths.js', () => ({
  uploadsDir: '/tmp/uploads',
  archivesDir: '/tmp/archives',
  getArchivePath: jest.fn((filename) => `/tmp/archives/${filename}`),
}));

jest.unstable_mockModule('../../utils/archive.js', () => ({
  createUserArchive: jest.fn(),
  importUserArchive: jest.fn(),
}));

// Dynamic import after mocking
const { default: adminRouter } = await import('../../routes/admin.js');

describe('Admin API', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/users', () => {
    it('should return all users with stats', async () => {
      const mockUsers = [
        { id: 1, username: 'admin', is_admin: 1, pieces_count: 10, materials_count: 5 },
        { id: 2, username: 'user1', is_admin: 0, pieces_count: 3, materials_count: 2 },
      ];

      mockDb.all.mockResolvedValue(mockUsers);

      const response = await request(app)
        .get('/api/admin/users')
        .expect(200);

      expect(response.body).toEqual(mockUsers);
      expect(mockDb.all).toHaveBeenCalled();
    });
  });

  describe('GET /api/admin/users/:id', () => {
    it('should return user details', async () => {
      const mockUser = { id: 2, username: 'testuser', is_admin: 0, last_login: '2024-01-01', created_at: '2023-01-01' };
      mockDb.get.mockResolvedValue(mockUser);

      const response = await request(app)
        .get('/api/admin/users/2')
        .expect(200);

      expect(response.body).toEqual(mockUser);
    });

    it('should return 404 for non-existent user', async () => {
      mockDb.get.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/admin/users/999')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'User not found');
    });
  });

  describe('POST /api/admin/users/:id/reset-password', () => {
    it('should generate temporary password', async () => {
      mockDb.get.mockResolvedValue({ id: 2, username: 'testuser' });
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app)
        .post('/api/admin/users/2/reset-password')
        .send({ method: 'temporary' })
        .expect(200);

      expect(response.body).toHaveProperty('method', 'temporary');
      expect(response.body).toHaveProperty('temporaryPassword');
      expect(response.body).toHaveProperty('mustChangePassword', true);
    });

    it('should generate reset link', async () => {
      mockDb.get.mockResolvedValue({ id: 2, username: 'testuser' });
      mockDb.run.mockResolvedValue({ lastID: 1 });

      const response = await request(app)
        .post('/api/admin/users/2/reset-password')
        .send({ method: 'link' })
        .expect(200);

      expect(response.body).toHaveProperty('method', 'link');
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('link');
    });

    it('should return 404 for non-existent user', async () => {
      mockDb.get.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin/users/999/reset-password')
        .send({ method: 'temporary' })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'User not found');
    });

    it('should reject invalid method', async () => {
      mockDb.get.mockResolvedValue({ id: 2, username: 'testuser' });

      const response = await request(app)
        .post('/api/admin/users/2/reset-password')
        .send({ method: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/admin/users/:id/toggle-admin', () => {
    it('should toggle admin status from false to true', async () => {
      mockDb.get.mockResolvedValue({ id: 2, username: 'testuser', is_admin: 0 });
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app)
        .post('/api/admin/users/2/toggle-admin')
        .expect(200);

      expect(response.body).toHaveProperty('id', '2');
      expect(response.body).toHaveProperty('is_admin', 1);
    });

    it('should toggle admin status from true to false', async () => {
      mockDb.get.mockResolvedValue({ id: 2, username: 'testuser', is_admin: 1 });
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app)
        .post('/api/admin/users/2/toggle-admin')
        .expect(200);

      expect(response.body).toHaveProperty('id', '2');
      expect(response.body).toHaveProperty('is_admin', 0);
    });

    it('should return 404 for non-existent user', async () => {
      mockDb.get.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin/users/999/toggle-admin')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'User not found');
    });
  });

  describe('GET /api/admin/registration-status', () => {
    it('should return registration status', async () => {
      mockDb.get
        .mockResolvedValueOnce({ value: '1' }) // enabled
        .mockResolvedValueOnce({ value: 'Registration open!' }); // message

      const response = await request(app)
        .get('/api/admin/registration-status')
        .expect(200);

      expect(response.body).toHaveProperty('enabled', true);
      expect(response.body).toHaveProperty('message', 'Registration open!');
    });

    it('should return disabled status', async () => {
      mockDb.get
        .mockResolvedValueOnce({ value: '0' }) // disabled
        .mockResolvedValueOnce(null); // no message

      const response = await request(app)
        .get('/api/admin/registration-status')
        .expect(200);

      expect(response.body).toHaveProperty('enabled', false);
      expect(response.body).toHaveProperty('message', null);
    });
  });

  describe('POST /api/admin/registration-status', () => {
    it('should update registration status', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app)
        .post('/api/admin/registration-status')
        .send({ enabled: true, message: 'Welcome!' })
        .expect(200);

      expect(response.body).toHaveProperty('enabled', true);
      expect(response.body).toHaveProperty('message', 'Welcome!');
    });

    it('should disable registration', async () => {
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app)
        .post('/api/admin/registration-status')
        .send({ enabled: false })
        .expect(200);

      expect(response.body).toHaveProperty('enabled', false);
    });
  });
});
