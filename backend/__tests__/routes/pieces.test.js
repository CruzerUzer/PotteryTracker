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
const { default: piecesRouter } = await import('../../routes/pieces.js');

describe('Pieces API', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/pieces', piecesRouter);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/pieces', () => {
    it('should return all pieces for the user', async () => {
      const mockPieces = [
        { id: 1, name: 'Test Piece', user_id: 1 },
        { id: 2, name: 'Another Piece', user_id: 1 },
      ];

      mockDb.all.mockResolvedValue(mockPieces);

      const response = await request(app)
        .get('/api/pieces')
        .expect(200);

      expect(response.body).toEqual(mockPieces);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('WHERE p.user_id = ?'),
        [1]
      );
    });

    it('should filter by phase_id when provided', async () => {
      mockDb.all.mockResolvedValue([]);

      await request(app)
        .get('/api/pieces?phase_id=5')
        .expect(200);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND p.current_phase_id = ?'),
        expect.arrayContaining([1, '5'])
      );
    });

    it('should search by name or description', async () => {
      mockDb.all.mockResolvedValue([]);

      await request(app)
        .get('/api/pieces?search=test')
        .expect(200);

      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('AND (p.name LIKE ? OR p.description LIKE ?)'),
        expect.arrayContaining([1, '%test%', '%test%'])
      );
    });
  });

  describe('POST /api/pieces', () => {
    it('should create a new piece', async () => {
      const newPiece = {
        name: 'New Piece',
        description: 'Test description',
      };

      mockDb.get.mockResolvedValueOnce(null); // No phase validation needed
      mockDb.get.mockResolvedValueOnce({ max_order: 10 }); // isFinalPhase check
      mockDb.run.mockResolvedValue({ lastID: 1 });

      const response = await request(app)
        .post('/api/pieces')
        .send(newPiece)
        .expect(201);

      expect(response.body).toHaveProperty('id', 1);
      expect(response.body).toHaveProperty('name', 'New Piece');
      expect(mockDb.run).toHaveBeenCalled();
    });

    it('should reject piece without name', async () => {
      const response = await request(app)
        .post('/api/pieces')
        .send({ description: 'No name' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
