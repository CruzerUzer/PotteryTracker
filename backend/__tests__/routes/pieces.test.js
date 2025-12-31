import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import piecesRouter from '../../routes/pieces.js';
import { requireAuth } from '../../middleware/auth.js';
import { getDb } from '../../utils/db.js';

// Mock dependencies
jest.mock('../../middleware/auth.js');
jest.mock('../../utils/db.js');
jest.mock('../../utils/logger.js', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('Pieces API', () => {
  let app;
  let mockDb;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock requireAuth to always pass
    requireAuth.mockImplementation((req, res, next) => {
      req.userId = 1;
      next();
    });

    // Mock database
    mockDb = {
      all: jest.fn(),
      get: jest.fn(),
      run: jest.fn(),
    };
    getDb.mockResolvedValue(mockDb);

    app.use('/api/pieces', piecesRouter);
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
        expect.arrayContaining([1, 5])
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




