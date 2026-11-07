import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLAN = JSON.parse(readFileSync(join(__dirname, '../../database/studie/studieplan.json'), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));

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

const { default: router } = await import('../../routes/studyPlanEdit.js');

function setupDb({ version = PLAN.version, revision = null } = {}) {
  const planRow = { id: 1, user_id: 1, version, title: PLAN.title, json: JSON.stringify({ ...PLAN, version }) };
  mockDb.get.mockImplementation(async (sql) => {
    if (sql.includes('SELECT study_enabled')) return { study_enabled: 1 };
    if (sql.includes('FROM study_plans WHERE user_id')) return planRow;
    if (sql.includes('FROM study_plan_revisions WHERE id')) return revision;
    return null;
  });
  mockDb.all.mockImplementation(async () => [{ id: 3, author: 'user', summary: 'x', created_at: '2026-11-01' }]);
  mockDb.run.mockImplementation(async () => ({ lastID: 4, changes: 1 }));
}
const runCalls = (f) => mockDb.run.mock.calls.filter(([sql]) => sql.includes(f));

describe('Study plan editing API', () => {
  let app;
  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json({ limit: '2mb' }));
    app.use('/api/study', router);
  });

  it('sparar en giltig ändring som revision av användaren', async () => {
    setupDb();
    const plan = clone(PLAN);
    plan.phases[2].weeks[0].main = 'Fat: 6 à 1 kg.';
    await request(app).put('/api/study/plan').send({ plan, summary: 'Tallrikar bytta mot fat' }).expect(200);
    const [sql, params] = runCalls('INSERT INTO study_plan_revisions')[0];
    expect(params[2]).toBe('user');
    expect(params[3]).toBe('Tallrikar bytta mot fat');
    expect(JSON.parse(params[4]).phases[2].weeks[0].main).toBe('Fat: 6 à 1 kg.');
    expect(sql).toContain('snapshot');
  });

  it('sparar aldrig en ogiltig plan', async () => {
    setupDb();
    const plan = clone(PLAN);
    plan.phases[1].playCards.push('finns-inte');
    const res = await request(app).put('/api/study/plan').send({ plan }).expect(400);
    expect(res.body.errors.join()).toMatch(/finns-inte/);
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  it('låter inte användaren ändra filversionen', async () => {
    setupDb({ version: 1 });
    const plan = { ...clone(PLAN), version: 99 };
    await request(app).put('/api/study/plan').send({ plan }).expect(200);
    expect(runCalls('UPDATE study_plans')[0][1][2]).toBe(1);
  });

  it('återställer en tidigare version som ny revision', async () => {
    setupDb({ revision: { id: 2, created_at: '2026-11-01 10:00:00', summary: 'Seed', snapshot: JSON.stringify(PLAN) } });
    await request(app).post('/api/study/plan/revisions/2/restore').expect(200);
    const params = runCalls('INSERT INTO study_plan_revisions')[0][1];
    expect(params[3]).toMatch(/Återställd till versionen från 2026-11-01/);
    expect(runCalls('UPDATE study_plans')).toHaveLength(1);
  });

  it('ger 404 för en version som inte finns', async () => {
    setupDb();
    await request(app).post('/api/study/plan/revisions/77/restore').expect(404);
  });

  it('visar när filen är nyare än användarens plan', async () => {
    setupDb({ version: 0 });
    const res = await request(app).get('/api/study/plan/file-version').expect(200);
    expect(res.body).toMatchObject({ newer: true, fileVersion: PLAN.version, userVersion: 0 });
  });

  it('hämtar filen som revision med author file', async () => {
    setupDb({ version: 0 });
    await request(app).post('/api/study/plan/adopt-file').expect(200);
    expect(runCalls('INSERT INTO study_plan_revisions')[0][1][2]).toBe('file');
  });
});
