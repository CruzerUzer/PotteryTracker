/**
 * Studieplanen: läsa filen, validera mot schemat och räkna fram var
 * användaren står i planen. Ren logik utan databas, så att den går att testa.
 *
 * Planens "phases" heter block i appen (se design/STUDIE_PLAN.md, Namn).
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const STUDY_DIR = process.env.STUDY_PLAN_DIR || join(__dirname, '..', 'database', 'studie');

export const TOTAL_WEEKS = 52;
export const STAGE_IDS = ['thrown', 'trimmed', 'bisque', 'glazed', 'done'];
export const SESSION_ACTIONS = ['thrown', 'trimmed', 'handled', 'decorated', 'glazed'];

/** Åtgärd i passet → steg i bränningsflödet (för fasförslag). */
export const ACTION_TO_STAGE = {
  thrown: 'thrown',
  trimmed: 'trimmed',
  glazed: 'glazed',
};

export const ACTION_LABELS = {
  thrown: 'Drejat',
  trimmed: 'Svarvat',
  handled: 'Hänklat',
  decorated: 'Dekorerat',
  glazed: 'Glaserat',
};

let cachedSchema = null;
let cachedValidator = null;

export function loadPlanFile() {
  return JSON.parse(readFileSync(join(STUDY_DIR, 'studieplan.json'), 'utf8'));
}

export function loadPlanDocument() {
  return readFileSync(join(STUDY_DIR, 'studieplan.md'), 'utf8');
}

export function loadSchema() {
  if (!cachedSchema) {
    cachedSchema = JSON.parse(readFileSync(join(STUDY_DIR, 'studieplan.schema.json'), 'utf8'));
  }
  return cachedSchema;
}

function getValidator() {
  if (!cachedValidator) {
    const ajv = new Ajv({ allErrors: true, strict: false });
    cachedValidator = ajv.compile(loadSchema());
  }
  return cachedValidator;
}

/**
 * Validerar en plan mot schemat och mot regler schemat inte kan uttrycka
 * (unika id:n, veckor inom blocket, kort som finns, segment i ordning).
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePlan(plan) {
  const validate = getValidator();
  const errors = [];
  if (!validate(plan)) {
    for (const e of validate.errors || []) {
      errors.push(`${e.instancePath || '(roten)'} ${e.message}`);
    }
    return { valid: false, errors };
  }

  const t = plan.sessionTemplate;
  let prevTo = 0;
  const segIds = new Set();
  for (const s of t.segments) {
    if (segIds.has(s.id)) errors.push(`Segmentet ${s.id} finns två gånger`);
    segIds.add(s.id);
    if (s.toMinute <= s.fromMinute) errors.push(`Segmentet ${s.id} slutar innan det börjar`);
    if (s.fromMinute < prevTo) errors.push(`Segmentet ${s.id} överlappar föregående segment`);
    if (s.toMinute > t.totalMinutes) errors.push(`Segmentet ${s.id} går längre än passet`);
    prevTo = s.toMinute;
  }
  if (t.wheelBooking && t.wheelBooking.toMinute <= t.wheelBooking.fromMinute) {
    errors.push('Skivbokningen slutar innan den börjar');
  }

  const cardIds = new Set();
  for (const c of plan.challengeCards) {
    if (cardIds.has(c.id)) errors.push(`Kortet ${c.id} finns två gånger`);
    cardIds.add(c.id);
  }

  const blockIds = new Set();
  const covered = new Map();
  for (const b of plan.phases) {
    if (blockIds.has(b.id)) errors.push(`Blocket ${b.id} finns två gånger`);
    blockIds.add(b.id);
    if (b.weekTo < b.weekFrom) errors.push(`Blocket ${b.id} slutar innan det börjar`);
    for (let w = b.weekFrom; w <= b.weekTo; w++) {
      if (covered.has(w)) errors.push(`Vecka ${w} finns i både ${covered.get(w)} och ${b.id}`);
      covered.set(w, b.id);
    }
    for (const wk of b.weeks) {
      if (wk.weekTo < wk.weekFrom) errors.push(`${b.id}: vecka ${wk.weekFrom}–${wk.weekTo} slutar innan den börjar`);
      if (wk.weekFrom < b.weekFrom || wk.weekTo > b.weekTo) {
        errors.push(`${b.id}: vecka ${wk.weekFrom}–${wk.weekTo} ligger utanför blocket`);
      }
    }
    for (const id of b.playCards || []) {
      if (!cardIds.has(id)) errors.push(`${b.id}: kortet ${id} finns inte i leken`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function sortedBlocks(plan) {
  return [...(plan.phases || [])].sort((a, b) => a.order - b.order || a.weekFrom - b.weekFrom);
}

export function findBlock(plan, blockId) {
  return (plan.phases || []).find((b) => b.id === blockId) || null;
}

/** Blocket som innehåller veckan, annars närmaste block före (eller det första). */
export function blockForWeek(plan, week) {
  const blocks = sortedBlocks(plan);
  const hit = blocks.find((b) => week >= b.weekFrom && week <= b.weekTo);
  if (hit) return hit;
  const before = blocks.filter((b) => b.weekTo < week);
  return before.length ? before[before.length - 1] : blocks[0] || null;
}

export function weekEntry(block, week) {
  if (!block) return null;
  return block.weeks.find((w) => week >= w.weekFrom && week <= w.weekTo) || null;
}

/**
 * Var användaren står: veckan räknas i genomförda pass som inte är fria.
 * @param {object} plan  planens JSON
 * @param {number} completed  antal avslutade pass med is_free = 0
 */
export function computeProgress(plan, completed) {
  const lastWeek = Math.max(TOTAL_WEEKS, ...sortedBlocks(plan).map((b) => b.weekTo));
  const finished = completed >= lastWeek;
  const week = Math.min(completed + 1, lastWeek);
  const block = blockForWeek(plan, week);
  const entry = weekEntry(block, week);
  const nextWeek = week < lastWeek ? week + 1 : null;
  const nextBlock = nextWeek ? blockForWeek(plan, nextWeek) : null;
  const nextEntry = nextWeek ? weekEntry(nextBlock, nextWeek) : null;
  const blockLength = block ? block.weekTo - block.weekFrom + 1 : 0;
  const doneInBlock = block ? Math.max(0, Math.min(blockLength, completed - (block.weekFrom - 1))) : 0;

  return {
    week,
    completed,
    totalWeeks: lastWeek,
    finished,
    block: block ? summarizeBlock(block) : null,
    blockLength,
    doneInBlock,
    weekInBlock: block ? week - block.weekFrom + 1 : null,
    weekEntry: entry,
    nextWeek,
    nextBlock: nextBlock && block && nextBlock.id !== block.id ? summarizeBlock(nextBlock) : null,
    nextWeekEntry: nextEntry,
  };
}

export function summarizeBlock(b) {
  return {
    id: b.id,
    order: b.order,
    name: b.name,
    weekFrom: b.weekFrom,
    weekTo: b.weekTo,
    themeTechnical: b.themeTechnical ?? null,
    themeCreative: b.themeCreative ?? null,
  };
}

/** Segment för ett nytt pass: kopia av mallen, alla påslagna. */
export function templateSegments(plan) {
  return (plan.sessionTemplate?.segments || []).map((s) => ({
    id: s.id,
    name: s.name,
    fromMinute: s.fromMinute,
    toMinute: s.toMinute,
    minutes: s.toMinute - s.fromMinute,
    wheel: !!s.wheel,
    description: s.description || '',
    enabled: true,
  }));
}

/** Rimlighetskontroll av segment som klienten skickar. */
export function sanitizeSegments(input) {
  if (!Array.isArray(input) || input.length === 0 || input.length > 30) return null;
  const out = [];
  for (const s of input) {
    if (!s || typeof s !== 'object') return null;
    const minutes = Number(s.minutes);
    if (typeof s.id !== 'string' || !s.id || typeof s.name !== 'string' || !s.name) return null;
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 600) return null;
    out.push({
      id: s.id.slice(0, 64),
      name: s.name.slice(0, 120),
      minutes,
      wheel: !!s.wheel,
      description: typeof s.description === 'string' ? s.description.slice(0, 2000) : '',
      enabled: s.enabled !== false,
      fromMinute: Number.isInteger(s.fromMinute) ? s.fromMinute : undefined,
      toMinute: Number.isInteger(s.toMinute) ? s.toMinute : undefined,
    });
  }
  return out;
}

/**
 * Gissar mappning bränningsflöde → användarens faser utifrån namnen.
 * Ägarens faser: På gång → Skröjbränd → Glasyrbränning → Klar.
 * @param {{id:number,name:string,display_order:number}[]} phases
 */
export function guessStageMap(phases) {
  const sorted = [...phases].sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || a.id - b.id);
  if (sorted.length === 0) return {};
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const find = (re, exclude = []) => sorted.find((p) => re.test(p.name) && !exclude.includes(p.id));
  const bisque = find(/skröj|bisk|bisque/i);
  const glazed = find(/glasyrbränning|glaser|glasyr|glaze/i, [last.id, bisque?.id].filter(Boolean));
  return {
    thrown: first.id,
    trimmed: first.id,
    bisque: bisque?.id ?? null,
    glazed: glazed?.id ?? null,
    done: last.id,
  };
}

export function pickRandom(list, random = Math.random) {
  if (!list.length) return null;
  return list[Math.floor(random() * list.length)];
}

/**
 * Blockutvärdering: det senast avklarade blocket som saknar utvärdering.
 * Ett block är avklarat när antalet genomförda pass når blockets sista vecka.
 * @param {string[]} reviewedBlockIds
 */
export function reviewDueBlock(plan, completed, reviewedBlockIds = []) {
  const done = sortedBlocks(plan).filter((b) => b.weekTo <= completed);
  const last = done[done.length - 1];
  if (!last || reviewedBlockIds.includes(last.id)) return null;
  return last;
}

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[åä]/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/é/g, 'e')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'kort';
}

/**
 * Lägger till ett utmaningskort i leken och i ett blocks lek.
 * Returnerar { plan, card } – planen kopieras, originalet ändras inte.
 */
export function addCardToPlan(plan, { name, how, trains }, blockId) {
  const next = JSON.parse(JSON.stringify(plan));
  const ids = new Set(next.challengeCards.map((c) => c.id));
  const base = slugify(name);
  let id = base;
  for (let i = 2; ids.has(id); i++) id = `${base}-${i}`;
  const card = { id, name: name.trim(), how: how.trim() };
  if (trains && trains.trim()) card.trains = trains.trim();
  next.challengeCards.push(card);
  const block = next.phases.find((b) => b.id === blockId);
  if (block) block.playCards = [...(block.playCards || []), id];
  return { plan: next, card };
}

/** Nästa block i ordningen efter blockId (eller null). */
export function nextBlock(plan, blockId) {
  const blocks = sortedBlocks(plan);
  const i = blocks.findIndex((b) => b.id === blockId);
  return i >= 0 && i + 1 < blocks.length ? blocks[i + 1] : null;
}
