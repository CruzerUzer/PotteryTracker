import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock database
const mockDb = {
  all: jest.fn(),
  get: jest.fn(),
  run: jest.fn(),
};

// Mock requireAuth
const mockRequireAuth = jest.fn((req, res, next) => {
  req.userId = 1;
  next();
});

jest.unstable_mockModule('../../middleware/auth.js', () => ({
  requireAuth: mockRequireAuth,
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

// Dynamic import after mocking
const { default: phasesRouter } = await import('../../routes/phases.js');

describe('Phases API', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/phases', phasesRouter);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/phases', () => {
    it('should return all phases for the user', async () => {
      const mockPhases = [
        { id: 1, name: 'Drying', display_order: 1, user_id: 1 },
        { id: 2, name: 'Bisque Fired', display_order: 2, user_id: 1 },
      ];

      mockDb.all.mockResolvedValue(mockPhases);

      const response = await request(app)
        .get('/api/phases')
        .expect(200);

      expect(response.body).toEqual(mockPhases);
      expect(mockDb.all).toHaveBeenCalledWith(
        'SELECT * FROM phases WHERE user_id = ? ORDER BY display_order, name',
        [1]
      );
    });
  });

  describe('POST /api/phases', () => {
    it('should create a new phase', async () => {
      mockDb.run.mockResolvedValue({ lastID: 3 });

      const response = await request(app)
        .post('/api/phases')
        .send({ name: 'Glazed', display_order: 3 })
        .expect(201);

      expect(response.body).toHaveProperty('id', 3);
      expect(response.body).toHaveProperty('name', 'Glazed');
      expect(response.body).toHaveProperty('display_order', 3);
    });

    it('should reject phase without name', async () => {
      const response = await request(app)
        .post('/api/phases')
        .send({ display_order: 1 })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Phase name is required');
    });

    it('should reject empty phase name', async () => {
      const response = await request(app)
        .post('/api/phases')
        .send({ name: '   ', display_order: 1 })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Phase name is required');
    });

    it('should handle duplicate phase name', async () => {
      mockDb.run.mockRejectedValue(new Error('UNIQUE constraint failed'));

      const response = await request(app)
        .post('/api/phases')
        .send({ name: 'Existing Phase', display_order: 1 })
        .expect(409);

      expect(response.body).toHaveProperty('error', 'Phase with this name already exists');
    });
  });

  describe('PUT /api/phases/:id', () => {
    it('should update a phase', async () => {
      mockDb.get.mockResolvedValue({ id: 1 }); // Phase exists
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app)
        .put('/api/phases/1')
        .send({ name: 'Updated Phase', display_order: 5 })
        .expect(200);

      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('name', 'Updated Phase');
      expect(response.body).toHaveProperty('display_order', 5);
    });

    it('should return 404 for non-existent phase', async () => {
      mockDb.get.mockResolvedValue(null); // Phase not found

      const response = await request(app)
        .put('/api/phases/999')
        .send({ name: 'Test', display_order: 1 })
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Phase not found');
    });

    it('should reject update without name', async () => {
      const response = await request(app)
        .put('/api/phases/1')
        .send({ display_order: 1 })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Phase name is required');
    });
  });

  describe('DELETE /api/phases/:id', () => {
    it('should delete a phase', async () => {
      mockDb.get
        .mockResolvedValueOnce({ id: 1 }) // Phase exists
        .mockResolvedValueOnce({ count: 0 }); // No pieces using it
      mockDb.run.mockResolvedValue({ changes: 1 });

      const response = await request(app)
        .delete('/api/phases/1')
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Phase deleted successfully');
    });

    it('should return 404 for non-existent phase', async () => {
      mockDb.get.mockResolvedValue(null); // Phase not found

      const response = await request(app)
        .delete('/api/phases/999')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Phase not found');
    });

    it('should prevent deletion of phase in use', async () => {
      mockDb.get
        .mockResolvedValueOnce({ id: 1 }) // Phase exists
        .mockResolvedValueOnce({ count: 5 }); // 5 pieces using it

      const response = await request(app)
        .delete('/api/phases/1')
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Cannot delete phase that is in use by ceramic pieces');
    });
  });
});
