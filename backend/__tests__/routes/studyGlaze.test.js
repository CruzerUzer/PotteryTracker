import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';

const mockDb = { all: jest.fn(), get: jest.fn(), run: jest.fn() };
jest.unstable_mockModule('../../middleware/auth.js', () => ({
  requireAuth: jest.fn((req, res, next) => {
    req.userId = 1;
    next();
  }),
}));
jest.unstable_mockModule('../../utils/db.js', () => ({ getDb: jest.fn(() => Promise.resolve(mockDb)) }));
jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));
jest.unstable_mockModule('../../middleware/upload.js', () => ({
  default: { single: () => (req, res, next) => next() },
  optimizeImage: (req, res, next) => next(),
}));

const { default: router, sanitizeIngredients } = await import('../../routes/studyGlaze.js');

function setupDb({ codes = [], owns = true } = {}) {
  mockDb.get.mockImplementation(async (sql) => {
    if (sql.includes('SELECT study_enabled')) return { study_enabled: 1 };
    if (sql.includes('FROM glaze_tests t')) return { id: 9, tile_code: 'P3' };
    if (sql.includes('FROM glaze_recipes WHERE id = ?') && sql.startsWith('SELECT *')) return { id: 4, name: 'Glasklart', ingredients_json: '[]' };
    return owns ? { id: 1 } : null;
  });
  mockDb.all.mockImplementation(async (sql) => (sql.includes('tile_code LIKE') ? codes : []));
  mockDb.run.mockImplementation(async () => ({ lastID: 9, changes: 1 }));
}
const runCalls = (f) => mockDb.run.mock.calls.filter(([sql]) => sql.includes(f));

describe('Glaze API', () => {
  let app;
  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/study', router);
  });

  it('skapar en provplatta med nästa lediga kod och kopplat pass', async () => {
    setupDb({ codes: [{ tile_code: 'P1' }, { tile_code: 'P7' }, { tile_code: 'Px' }] });
    await request(app).post('/api/study/glaze/tests').send({
      session_id: 3, clay_material_id: 5, glaze_material_id: 6, method: 'dip', dip_seconds: '2,5', coats: 2, firing: 'Kon 6', result: 'Blank, lite rinnig',
    }).expect(201);
    const params = runCalls('INSERT INTO glaze_tests')[0][1];
    expect(params.slice(0, 3)).toEqual([1, 3, 'P8']);
    expect(params[6]).toBe('dip');
    expect(params[7]).toBe(2.5);
  });

  it('avvisar okänd metod och glasyr som inte är användarens', async () => {
    setupDb();
    await request(app).post('/api/study/glaze/tests').send({ method: 'kasta' }).expect(400);
    setupDb({ owns: false });
    await request(app).post('/api/study/glaze/tests').send({ glaze_material_id: 99 }).expect(400);
  });

  it('avvisar orimligt dopp', async () => {
    setupDb();
    await request(app).post('/api/study/glaze/tests').send({ dip_seconds: 500 }).expect(400);
  });

  it('sparar ett recept med ingredienser i procent', async () => {
    setupDb();
    await request(app).post('/api/study/glaze/recipes').send({
      name: 'Glasklart', cone: '6', ingredients: [{ material: 'Fältspat', percent: '30' }, { material: 'Kaolin', percent: 20 }, { material: '', percent: '' }],
    }).expect(201);
    const params = runCalls('INSERT INTO glaze_recipes')[0][1];
    expect(JSON.parse(params[3])).toEqual([{ material: 'Fältspat', percent: 30 }, { material: 'Kaolin', percent: 20 }]);
  });

  it('avvisar recept utan namn eller med trasig ingrediens', async () => {
    setupDb();
    await request(app).post('/api/study/glaze/recipes').send({ ingredients: [] }).expect(400);
    await request(app).post('/api/study/glaze/recipes').send({ name: 'X', ingredients: [{ material: 'Kvarts' }] }).expect(400);
  });

  it('sanitizeIngredients hoppar över tomma rader', () => {
    expect(sanitizeIngredients([{ material: ' Wollastonit ', percent: '12,5' }, {}])).toEqual([{ material: 'Wollastonit', percent: 12.5 }]);
    expect(sanitizeIngredients('x')).toBeNull();
  });
});
