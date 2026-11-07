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
jest.unstable_mockModule('../../utils/db.js', () => ({
  getDb: jest.fn(() => Promise.resolve(mockDb)),
}));
jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));
jest.unstable_mockModule('../../middleware/upload.js', () => ({
  default: { single: () => (req, res, next) => next() },
  optimizeImage: (req, res, next) => next(),
}));

const { default: studyLogRouter } = await import('../../routes/studyLog.js');

function setupDb(state = {}) {
  const s = { completed: 0, session: { id: 3, user_id: 1, date: '2026-11-01', is_free: 0, week_number: 1, plan_block_id: 'restart', ended_at: 'x', segments_json: '[]' }, log: null, reviews: [], ...state };
  const planRow = { id: 1, user_id: 1, version: 1, title: PLAN.title, json: JSON.stringify(PLAN) };
  mockDb.get.mockImplementation(async (sql) => {
    if (sql.includes('SELECT study_enabled FROM users')) return { study_enabled: 1 };
    if (sql.includes('FROM study_plans WHERE user_id')) return planRow;
    if (sql.includes('COUNT(*) AS n FROM study_sessions')) return { n: s.completed };
    if (sql.includes('FROM study_sessions WHERE id = ? AND user_id')) return s.session;
    if (sql.includes('SELECT id FROM study_log_entries')) return s.log;
    if (sql.includes('FROM study_log_entries l')) return s.log ? { ...s.log, clay_name: null } : null;
    if (sql.includes('FROM materials')) return s.clay === false ? null : { id: 5 };
    if (sql.includes('FROM study_block_reviews WHERE id')) return { id: 9, plan_block_id: 'restart', answers_json: '["a"]' };
    if (sql.includes('FROM study_metrics WHERE id')) return { id: 4, metric_id: 'evenness', value: 4 };
    return null;
  });
  mockDb.all.mockImplementation(async (sql) => {
    if (sql.includes('SELECT plan_block_id FROM study_block_reviews')) return s.reviews;
    if (sql.includes('FROM study_sessions s WHERE')) return s.sessions || [];
    return [];
  });
  mockDb.run.mockImplementation(async () => ({ lastID: 9, changes: 1 }));
  return s;
}

const runCalls = (fragment) => mockDb.run.mock.calls.filter(([sql]) => sql.includes(fragment));

describe('Study log API', () => {
  let app;
  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/study', studyLogRouter);
  });

  describe('PUT /sessions/:id/log', () => {
    it('sparar tre rader och extrafälten', async () => {
      setupDb();
      await request(app)
        .put('/api/study/sessions/3/log')
        .send({ goal_and_measure: '6 cylindrar', observation: 'Kanten vinglar', change: 'Blicken på kanten', weight_grams: 500, series_number: 'S12', clay_material_id: 5, into_damp_box: '6 cylindrar' })
        .expect(200);
      const [sql, params] = runCalls('INSERT INTO study_log_entries')[0];
      expect(sql).toContain('change');
      expect(params).toEqual([3, 1, '6 cylindrar', 'Kanten vinglar', 'Blicken på kanten', 5, 500, 'S12', '6 cylindrar']);
    });

    it('uppdaterar en befintlig loggrad', async () => {
      setupDb({ log: { id: 7 } });
      await request(app).put('/api/study/sessions/3/log').send({ change: 'Långsammare' }).expect(200);
      expect(runCalls('UPDATE study_log_entries')).toHaveLength(1);
      expect(runCalls('INSERT INTO study_log_entries')).toHaveLength(0);
    });

    it('avvisar lera som inte är användarens', async () => {
      setupDb({ clay: false });
      await request(app).put('/api/study/sessions/3/log').send({ clay_material_id: 99 }).expect(400);
    });

    it('avvisar orimlig vikt', async () => {
      setupDb();
      await request(app).put('/api/study/sessions/3/log').send({ weight_grams: -3 }).expect(400);
    });

    it('ger 404 för ett pass som inte finns', async () => {
      setupDb({ session: null });
      await request(app).put('/api/study/sessions/3/log').send({}).expect(404);
    });
  });

  describe('blockutvärdering', () => {
    it('visar att Återstart ska utvärderas efter fyra pass', async () => {
      setupDb({ completed: 4 });
      const res = await request(app).get('/api/study/reviews').expect(200);
      expect(res.body.due).toMatchObject({ blockId: 'restart' });
    });

    it('visar ingen utvärdering när blocket redan är utvärderat', async () => {
      setupDb({ completed: 5, reviews: [{ plan_block_id: 'restart' }] });
      const res = await request(app).get('/api/study/reviews').expect(200);
      expect(res.body.due).toBeNull();
    });

    it('sparar svaren och ett nytt kort i nästa blocks lek med revision', async () => {
      setupDb({ completed: 4 });
      await request(app)
        .post('/api/study/reviews')
        .send({
          plan_block_id: 'restart',
          answers: ['Centrera', 'Cylinder 3', 'Tjock botten', 'Tärningen', 'Muggar'],
          next_goals: 'Sex lika muggar',
          new_card: { name: 'Tunn botten', how: 'Mät bottnen med nål på alla.', trains: 'Botten' },
        })
        .expect(201);

      const [, planParams] = runCalls('UPDATE study_plans SET json')[0];
      const updated = JSON.parse(planParams[0]);
      expect(updated.challengeCards.at(-1)).toMatchObject({ id: 'tunn-botten', name: 'Tunn botten' });
      expect(updated.phases.find((b) => b.id === 'block-1').playCards).toContain('tunn-botten');
      const rev = runCalls('INSERT INTO study_plan_revisions')[0];
      expect(rev[0]).toContain("'user'");
      const review = runCalls('INSERT INTO study_block_reviews')[0][1];
      expect(review[2]).toBe('restart');
      expect(JSON.parse(review[3])).toHaveLength(5);
      expect(review[5]).toBe('tunn-botten');
    });

    it('kräver minst ett svar', async () => {
      setupDb();
      await request(app).post('/api/study/reviews').send({ plan_block_id: 'restart', answers: ['', ''] }).expect(400);
    });
  });

  describe('mått', () => {
    it('sparar ett mått på aktuellt block', async () => {
      setupDb({ completed: 6 });
      await request(app).post('/api/study/metrics').send({ metric_id: 'evenness', value: '4,5' }).expect(201);
      const params = runCalls('INSERT INTO study_metrics')[0][1];
      expect(params[1]).toBe('block-1');
      expect(params[2]).toBe('evenness');
      expect(params[3]).toBe(4.5);
    });

    it('avvisar okänt mått och icke-tal', async () => {
      setupDb();
      await request(app).post('/api/study/metrics').send({ metric_id: 'okänt', value: 3 }).expect(400);
      await request(app).post('/api/study/metrics').send({ metric_id: 'tempo', value: 'snabbt' }).expect(400);
    });
  });

  describe('export', () => {
    const sessions = [{ id: 3, user_id: 1, date: '2026-11-01', is_free: 0, week_number: 1, plan_block_id: 'restart', ended_at: 'x', segments_json: '[]', goal: 'Centrera' }];

    it('exporterar Markdown', async () => {
      setupDb({ sessions, log: { change: 'Långsammare; sista draget' } });
      const res = await request(app).get('/api/study/export?format=md').expect(200);
      expect(res.headers['content-type']).toMatch(/markdown/);
      expect(res.headers['content-disposition']).toMatch(/loggbok-.*\.md/);
      expect(res.text).toContain('### 2026-11-01 · Pass 1 · Återstart');
      expect(res.text).toContain('**En förändring:** Långsammare; sista draget');
    });

    it('exporterar CSV med semikolon och citat där det behövs', async () => {
      setupDb({ sessions, log: { change: 'Långsammare; sista draget' } });
      const res = await request(app).get('/api/study/export?format=csv').expect(200);
      expect(res.headers['content-type']).toMatch(/csv/);
      const lines = res.text.replace('﻿', '').trim().split('\r\n');
      expect(lines[0].split(';')[0]).toBe('Datum');
      expect(lines[1]).toContain('"Långsammare; sista draget"');
    });
  });
});
