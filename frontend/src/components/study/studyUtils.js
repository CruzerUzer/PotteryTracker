// Gemensamma hjälpare för Studie-vyerna.

export const ACTIONS = [
  { id: 'thrown', label: 'Drejat' },
  { id: 'trimmed', label: 'Beskickat' },
  { id: 'handled', label: 'Hänklat' },
  { id: 'decorated', label: 'Dekorerat' },
  { id: 'glazed', label: 'Glaserat' },
];

export const ACTION_LABEL = Object.fromEntries(ACTIONS.map((a) => [a.id, a.label]));

/** Blockfärg: block i ordning 0–4 får fasfärgerna 1–5 från tokens. */
export function blockColor(order = 0) {
  const n = (Math.max(0, order) % 5) + 1;
  return {
    bg: `var(--phase-color-${n})`,
    border: `var(--phase-color-${n}-border)`,
    accent: `var(--phase-color-${n}-accent)`,
  };
}

export function blockStyle(order) {
  const c = blockColor(order);
  return { '--block-bg': c.bg, '--block-border': c.border, '--block-accent': c.accent };
}

/** "Återstart" / "Block 1" – kortnamnet före mittpunkten. */
export function shortBlockName(name = '') {
  return name.split('·')[0].trim();
}

export function blockTheme(name = '') {
  const parts = name.split('·');
  return parts.length > 1 ? parts.slice(1).join('·').trim() : '';
}

/** Dagens datum som ÅÅÅÅ-MM-DD i lokal tid. */
export function todayIso(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDay(iso, opts = {}) {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', ...opts });
}

export function formatTime(isoDateTime) {
  if (!isoDateTime) return '';
  const d = new Date(isoDateTime);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

export function sessionTitle(session) {
  if (!session) return '';
  if (session.is_free) return 'Fritt pass';
  return session.week_number ? `Pass ${session.week_number}` : 'Pass';
}

export function minutesLabel(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Läser/skriver en liten bekvämlighet i localStorage utan att krascha. */
export function readLocal(key, fallback = null) {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

export function writeLocal(key, value) {
  try {
    if (value === null || value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* privat läge e.d. */
  }
}
