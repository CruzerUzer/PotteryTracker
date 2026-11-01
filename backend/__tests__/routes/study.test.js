import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLAN = JSON.parse(readFileSync(join(__dirname, '../../database/studie/studieplan.json'), 'utf8'));

// Mock database
const mockDb = {
  all: jest.fn(),
  get: jest.fn(),
  run: jest.fn(),
};

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
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const { default: studyRouter } = await import('../../routes/study.js');

const PHASES = [
  { id: 10, name: 'På gång', display_order: 1 },
  { id: 11, name: 'Skröjbränd', display_order: 2 },
  { id: 12, name: 'Glasyrbränning', display_order: 3 },
  { id: 13, name: 'Klar', display_order: 4 },
];
const STAGE_ROWS = [
  { stage_id: 'thrown', phase_id: 10 },
  { stage_id: 'trimmed', phase_id: 10 },
  { stage_id: 'bisque', phase_id: 11 },
  { stage_id: 'glazed', phase_id: 12 },
  { stage_id: 'done', phase_id: 13 },
];

/**
 * Enkel SQL-styrd mock: svarar utifrån frågans text och ett tillstånd
 * som testerna kan ändra (studieflagga, antal avslutade pass, plan, pass).
 */
function setupDb(state = {}) {
  const s = {
    studyEnabled: 1,
    hasPlan: true,
    completed: 0,
    session: null,
    piece: { id: 50, current_phase_id: 10 },
    nextId: 100,
    ...state,
  };
  const planRow = { id: 1, user_id: 1, version: 1, title: PLAN.title, json: JSON.stringify(PLAN), updated_at: 'x' };

  mockDb.get.mockImplementation(async (sql) => {
    if (sql.includes('SELECT study_enabled FROM users')) return { study_enabled: s.studyEnabled };
    if (sql.includes('FROM study_plans WHERE user_id')) return s.hasPlan ? planRow : null;
    if (sql.includes('FROM study_plans WHERE id')) return planRow;
    if (sql.includes('COUNT(*) AS n FROM study_sessions')) return { n: s.completed };
    if (sql.includes('FROM study_sessions WHERE id = ? AND user_id')) return s.session;
    if (sql.includes('FROM study_sessions')) return null; // aktivt/förra pass
    if (sql.includes('FROM ceramic_pieces WHERE id = ? AND user_id')) return s.piece;
    if (sql.includes('MAX(number)')) return { n: s.maxSeries ?? 0 };
    if (sql.includes('FROM materials')) return { id: 5 };
    if (sql.includes('FROM locations')) return { id: 7 };
    if (sql.includes('FROM phases WHERE id = ? AND user_id')) return { id: 12 };
    return null;
  });
  mockDb.all.mockImplementation(async (sql) => {
    if (sql.includes('FROM study_stage_phase_map')) return STAGE_ROWS;
    if (sql.includes('FROM phases')) return PHASES;
    return [];
  });
  mockDb.run.mockImplementation(async () => ({ lastID: s.nextId++, changes: 1 }));
  return s;
}

const sessionRow = (extra = {}) => ({
  id: 3,
  user_id: 1,
  plan_id: 1,
  plan_block_id: 'restart',
  week_number: 1,
  date: '2026-11-01',
  is_free: 0,
  goal: 'Centrera',
  planned_start: null,
  started_at: null,
  ended_at: null,
  segments_json: '[]',
  challenge_card_id: null,
  created_at: '2026-11-01 09:00:00',
  ...extra,
});

const runCalls = (fragment) => mockDb.run.mock.calls.filter(([sql]) => sql.includes(fragment));

describe('Study API', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/study', studyRouter);
  });

  describe('behörighet', () => {
    it('ger 403 när Studie är av för användaren', async () => {
      setupDb({ studyEnabled: 0 });
      const res = await request(app).get('/api/study/today').expect(403);
      expect(res.body.error).toMatch(/Studie/);
    });
  });

  describe('GET /api/study/today', () => {
    it('seedar planen första gången och visar Återstart vecka 1', async () => {
      setupDb({ hasPlan: false });
      // Efter INSERT ska planen hittas via id
      const res = await request(app).get('/api/study/today').expect(200);

      expect(runCalls('INSERT INTO study_plans')).toHaveLength(1);
      const rev = runCalls('INSERT INTO study_plan_revisions');
      expect(rev).toHaveLength(1);
      expect(rev[0][0]).toContain("'seed'");
      expect(res.body.progress.week).toBe(1);
      expect(res.body.progress.block.name).toBe('Återstart');
      expect(res.body.progress.weekEntry.main).toBe(PLAN.phases[0].weeks[0].main);
    });

    it('visar Block 1 vecka 5 efter fyra genomförda pass', async () => {
      setupDb({ completed: 4 });
      const res = await request(app).get('/api/study/today').expect(200);
      expect(res.body.progress.week).toBe(5);
      expect(res.body.progress.block.id).toBe('block-1');
      expect(res.body.gate.items).toHaveLength(2);
      expect(res.body.blockCards.map((c) => c.id)).toEqual(['tarningen', 'fem-fotter', 'blind']);
    });

    it('räknar bara avslutade pass som inte är fria', async () => {
      setupDb({ completed: 0 });
      await request(app).get('/api/study/today').expect(200);
      const countSql = mockDb.get.mock.calls.find(([sql]) => sql.includes('COUNT(*) AS n FROM study_sessions'))[0];
      expect(countSql).toContain('ended_at IS NOT NULL');
      expect(countSql).toContain('is_free = 0');
    });
  });

  describe('POST /api/study/sessions', () => {
    it('skapar ett pass med veckans huvudpass som delmål och mallens segment', async () => {
      const s = setupDb({ completed: 4 });
      s.session = sessionRow();
      await request(app).post('/api/study/sessions').send({}).expect(201);

      const [sql, params] = runCalls('INSERT INTO study_sessions')[0];
      expect(sql).toContain('segments_json');
      expect(params[2]).toBe('block-1'); // block
      expect(params[3]).toBe(5); // vecka
      expect(params[5]).toBe(0); // inte fritt
      expect(params[6]).toBe(PLAN.phases[1].weeks[0].main);
      expect(JSON.parse(params[7])).toHaveLength(PLAN.sessionTemplate.segments.length);
    });

    it('ett fritt pass får ingen vecka', async () => {
      const s = setupDb({ completed: 2 });
      s.session = sessionRow({ is_free: 1, week_number: null });
      await request(app).post('/api/study/sessions').send({ is_free: true }).expect(201);
      const params = runCalls('INSERT INTO study_sessions')[0][1];
      expect(params[3]).toBeNull();
      expect(params[5]).toBe(1);
    });

    it('avvisar ett ogiltigt datum', async () => {
      setupDb();
      const res = await request(app).post('/api/study/sessions').send({ date: '1/11' }).expect(400);
      expect(res.body.error).toMatch(/ÅÅÅÅ-MM-DD/);
    });

    it('godtar ett datum i efterhand', async () => {
      const s = setupDb();
      s.session = sessionRow({ date: '2026-10-20' });
      await request(app).post('/api/study/sessions').send({ date: '2026-10-20' }).expect(201);
      expect(runCalls('INSERT INTO study_sessions')[0][1][4]).toBe('2026-10-20');
    });
  });

  describe('POST /api/study/sessions/:id/end', () => {
    it('sätter ended_at och ögonblicksbild av vecka och block', async () => {
      const s = setupDb({ completed: 4 });
      s.session = sessionRow();
      await request(app).post('/api/study/sessions/3/end').expect(200);
      const [sql, params] = runCalls('UPDATE study_sessions SET ended_at')[0];
      expect(sql).toContain('week_number');
      expect(params[1]).toBe(5);
      expect(params[2]).toBe('block-1');
    });

    it('vägrar avsluta ett redan avslutat pass', async () => {
      const s = setupDb();
      s.session = sessionRow({ ended_at: '2026-11-01T12:00:00Z' });
      await request(app).post('/api/study/sessions/3/end').expect(400);
    });

    it('ger 404 för ett pass som inte finns', async () => {
      setupDb();
      await request(app).post('/api/study/sessions/99/end').expect(404);
    });
  });

  describe('POST /api/study/sessions/:id/pieces', () => {
    it('skapar en serie om 6 i fasen för drejat med löpande serienummer', async () => {
      const s = setupDb({ maxSeries: 11 });
      s.session = sessionRow();
      const res = await request(app)
        .post('/api/study/sessions/3/pieces')
        .send({ series: { count: 6, name: 'Cylinder', weight_grams: 500, clay_material_id: 5 } })
        .expect(201);

      expect(res.body.series.number).toBe(12);
      const pieces = runCalls('INSERT INTO ceramic_pieces');
      expect(pieces).toHaveLength(6);
      expect(pieces.map(([, p]) => p[1])).toEqual([1, 2, 3, 4, 5, 6].map((i) => `Cylinder 500 g · S12-${i}`));
      expect(pieces[0][1][3]).toBe(10); // På gång
      const links = runCalls('INSERT OR IGNORE INTO study_session_pieces');
      expect(links).toHaveLength(6);
      expect(links[0][0]).toContain("'thrown'");
      expect(runCalls('INSERT OR IGNORE INTO piece_materials')).toHaveLength(6);
    });

    it('avvisar en serie utan namn', async () => {
      const s = setupDb();
      s.session = sessionRow();
      await request(app).post('/api/study/sessions/3/pieces').send({ series: { count: 6, name: ' ' } }).expect(400);
      expect(runCalls('INSERT INTO ceramic_pieces')).toHaveLength(0);
    });

    it('föreslår Glasyrbränning för ett glaserat alster men flyttar det inte', async () => {
      const s = setupDb();
      s.session = sessionRow();
      const res = await request(app)
        .post('/api/study/sessions/3/pieces')
        .send({ piece_id: 50, action: 'glazed' })
        .expect(201);

      expect(res.body.suggestion).toEqual({ phase_id: 12, phase_name: 'Glasyrbränning' });
      expect(runCalls('UPDATE ceramic_pieces')).toHaveLength(0);
    });

    it('föreslår ingen flytt när alstret redan ligger i fasen', async () => {
      const s = setupDb({ piece: { id: 50, current_phase_id: 12 } });
      s.session = sessionRow();
      const res = await request(app)
        .post('/api/study/sessions/3/pieces')
        .send({ piece_id: 50, action: 'glazed' })
        .expect(201);
      expect(res.body.suggestion).toBeNull();
    });

    it('avvisar okänd åtgärd', async () => {
      const s = setupDb();
      s.session = sessionRow();
      await request(app).post('/api/study/sessions/3/pieces').send({ piece_id: 50, action: 'bränt' }).expect(400);
    });

    it('ger 404 för ett alster som inte är användarens', async () => {
      const s = setupDb({ piece: null });
      s.session = sessionRow();
      await request(app).post('/api/study/sessions/3/pieces').send({ piece_id: 51, action: 'trimmed' }).expect(404);
    });
  });

  describe('PATCH /api/study/sessions/:id', () => {
    it('sparar justerade segment utan att röra mallen', async () => {
      const s = setupDb();
      s.session = sessionRow();
      const segments = [{ id: 'in', name: 'In', minutes: 15, enabled: true }, { id: 'surface', name: 'Yta', minutes: 25, enabled: false }];
      await request(app).patch('/api/study/sessions/3').send({ segments }).expect(200);
      const [sql, params] = runCalls('UPDATE study_sessions SET')[0];
      expect(sql).toContain('segments_json');
      expect(JSON.parse(params[0])[1].enabled).toBe(false);
      expect(runCalls('study_plans')).toHaveLength(0);
    });

    it('avvisar ett kort som inte finns', async () => {
      const s = setupDb();
      s.session = sessionRow();
      await request(app).patch('/api/study/sessions/3').send({ challenge_card_id: 'finns-inte' }).expect(400);
    });
  });

  describe('grind och kort', () => {
    it('kryssar en grindpunkt', async () => {
      setupDb();
      await request(app).post('/api/study/gates/block-1/1').expect(200);
      expect(runCalls('INSERT OR IGNORE INTO study_gate_checks')[0][1]).toEqual([1, 'block-1', 1]);
    });

    it('ger 404 för en grindpunkt utanför blocket', async () => {
      setupDb();
      await request(app).post('/api/study/gates/block-1/5').expect(404);
    });

    it('drar ett kort ur blockets lek', async () => {
      setupDb();
      const res = await request(app).get('/api/study/cards/draw?block=block-2').expect(200);
      expect(PLAN.phases[2].playCards).toContain(res.body.card.id);
      expect(res.body.deckSize).toBe(3);
    });

    it('drar ur hela leken', async () => {
      setupDb();
      const res = await request(app).get('/api/study/cards/draw?block=all').expect(200);
      expect(res.body.deckSize).toBe(PLAN.challengeCards.length);
    });
  });

  describe('GET /api/study/pieces/:pieceId/sessions', () => {
    it('listar passen alstret varit med i', async () => {
      setupDb();
      mockDb.all.mockImplementation(async (sql) => {
        if (sql.includes('FROM study_session_pieces sp')) {
          return [{ id: 1, action: 'thrown', session_id: 3, date: '2026-11-01', week_number: 7, is_free: 0 }];
        }
        return [];
      });
      const res = await request(app).get('/api/study/pieces/50/sessions').expect(200);
      expect(res.body[0]).toMatchObject({ action_label: 'Drejat', week_number: 7, is_free: false });
    });
  });

  describe('PUT /api/study/stage-map', () => {
    it('avvisar en fas som inte är användarens', async () => {
      setupDb();
      mockDb.get.mockImplementation(async (sql) => {
        if (sql.includes('SELECT study_enabled')) return { study_enabled: 1 };
        return null;
      });
      await request(app).put('/api/study/stage-map').send({ glazed: 999 }).expect(400);
    });
  });
});
