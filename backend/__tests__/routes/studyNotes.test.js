import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLAN = JSON.parse(readFileSync(join(__dirname, '../../database/studie/studieplan.json'), 'utf8'));

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

const { default: router, sanitizeNote, normalizeUrl } = await import('../../routes/studyNotes.js');

const NOTE_ROW = {
  id: 9, user_id: 1, week_number: 6, type: 'video', title: 'Armbågen mot knät',
  url: 'https://youtu.be/abc', note: null, created_at: '2026-11-07 10:00:00', updated_at: '2026-11-07 10:00:00',
};

function setupDb({ completed = 5, notes = [NOTE_ROW], changes = 1 } = {}) {
  const planRow = { id: 1, user_id: 1, version: PLAN.version, title: PLAN.title, json: JSON.stringify(PLAN) };
  mockDb.get.mockImplementation(async (sql) => {
    if (sql.includes('SELECT study_enabled')) return { study_enabled: 1 };
    if (sql.includes('FROM study_plans')) return planRow;
    if (sql.includes('COUNT(*) AS n FROM study_sessions')) return { n: completed };
    if (sql.includes('FROM study_notes WHERE id')) return NOTE_ROW;
    return null;
  });
  mockDb.all.mockImplementation(async (sql) => (sql.includes('FROM study_notes') ? notes : []));
  mockDb.run.mockImplementation(async () => ({ lastID: 9, changes }));
}
const runCalls = (f) => mockDb.run.mock.calls.filter(([sql]) => sql.includes(f));

describe('Egna anteckningar', () => {
  let app;
  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/study', router);
  });

  it('listar anteckningarna med planens pass och aktuellt pass', async () => {
    setupDb({ completed: 5 });
    const res = await request(app).get('/api/study/notes').expect(200);
    expect(res.body.week).toBe(6);
    expect(res.body.weeks).toHaveLength(52);
    expect(res.body.weeks[0]).toMatchObject({ week: 1, blockId: 'restart' });
    expect(res.body.weeks[5].main).toBe(PLAN.phases[1].weeks[0].main);
    expect(res.body.notes[0]).toMatchObject({ id: 9, week_number: 6, type: 'video', title: 'Armbågen mot knät' });
  });

  it('sparar en anteckning på rätt pass och lägger till https:// när det saknas', async () => {
    setupDb();
    const res = await request(app)
      .post('/api/study/notes')
      .send({ week_number: 7, type: 'video', title: '  Titta på handens vinkel ', url: 'youtube.com/watch?v=x', note: '' })
      .expect(201);
    const params = runCalls('INSERT INTO study_notes')[0][1];
    expect(params).toEqual([1, 7, 'video', 'Titta på handens vinkel', 'https://youtube.com/watch?v=x', null]);
    expect(res.body.id).toBe(9);
  });

  it('avvisar anteckning utan text, med fel länk eller utanför planen', async () => {
    setupDb();
    const bad = async (body, re) => {
      const res = await request(app).post('/api/study/notes').send(body).expect(400);
      expect(res.body.error).toMatch(re);
    };
    await bad({ week_number: 6, title: '   ' }, /komma ihåg/);
    await bad({ week_number: 6, title: 'x', url: 'ftp://nej' }, /http/);
    await bad({ week_number: 6, title: 'x', url: 'bara ord' }, /http/);
    await bad({ week_number: 53, title: 'x' }, /mellan 1 och 52/);
    await bad({ week_number: 6, title: 'x', type: 'podd' }, /typ/);
    expect(runCalls('INSERT')).toHaveLength(0);
  });

  it('ändrar och tar bort bara användarens egna anteckningar', async () => {
    setupDb();
    await request(app).put('/api/study/notes/9').send({ week_number: 8, title: 'Ny text', type: 'note' }).expect(200);
    const [sql, params] = runCalls('UPDATE study_notes')[0];
    expect(sql).toContain('WHERE id = ? AND user_id = ?');
    expect(params.slice(-2)).toEqual([9, 1]);
    await request(app).delete('/api/study/notes/9').expect(200);
    expect(runCalls('DELETE FROM study_notes')[0][1]).toEqual([9, 1]);

    setupDb({ changes: 0 });
    await request(app).put('/api/study/notes/77').send({ week_number: 8, title: 'x' }).expect(404);
    await request(app).delete('/api/study/notes/77').expect(404);
  });

  it('normaliserar länkar', () => {
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl('  ')).toBeNull();
    expect(normalizeUrl('https://vimeo.com/1')).toBe('https://vimeo.com/1');
    expect(normalizeUrl('youtu.be/abc')).toBe('https://youtu.be/abc');
    expect(normalizeUrl('http://localhost')).toBeUndefined();
    expect(normalizeUrl('mailto:x@y.se')).toBeUndefined();
    expect(sanitizeNote({ week_number: '3', title: 'a'.repeat(300) }, 52).values.title).toHaveLength(200);
  });
});
