import { useEffect, useState } from 'react';

/**
 * Räknar fram passets läge från sparad starttid och klockan, aldrig från en
 * löpande räknare. Samma indata ger alltid samma läge, även efter omladdning
 * eller låst skärm.
 *
 * @param {object} session  { planned_start, segments, timer_mode, wheel_booking }
 * @param {number} nowMs    Date.now()
 */
export function computeClock(session, nowMs) {
  if (!session?.planned_start) return null;
  const start = Date.parse(session.planned_start);
  if (Number.isNaN(start)) return null;

  const segments = (session.segments || []).filter((s) => s.enabled !== false);
  let acc = 0;
  const timeline = segments.map((s) => {
    const from = acc;
    acc += Math.max(0, s.minutes || 0) * 60;
    return { ...s, startSec: from, endSec: acc, startMs: start + from * 1000, endMs: start + acc * 1000 };
  });
  const totalSec = acc;
  const elapsed = (nowMs - start) / 1000;
  const before = elapsed < 0;

  let index = before ? 0 : timeline.findIndex((s) => elapsed < s.endSec);
  // Hoppa över segment med noll minuter
  while (index >= 0 && index < timeline.length && timeline[index].endSec === timeline[index].startSec) index++;
  if (index >= timeline.length) index = -1;
  const over = !before && index === -1;
  const current = index >= 0 ? timeline[index] : null;
  const next = index >= 0 ? timeline.slice(index + 1).find((s) => s.endSec > s.startSec) || null : null;

  const segLength = current ? current.endSec - current.startSec : 0;
  const segElapsed = current ? Math.max(0, elapsed - current.startSec) : 0;

  let wheel = null;
  const booking = session.wheel_booking;
  if (booking && session.timer_mode !== 'countdown') {
    const fromMs = start + booking.fromMinute * 60000;
    const toMs = start + booking.toMinute * 60000;
    const state = nowMs < fromMs ? 'before' : nowMs < toMs ? 'on' : 'after';
    wheel = {
      fromMs,
      toMs,
      state,
      secondsToChange: state === 'before' ? (fromMs - nowMs) / 1000 : state === 'on' ? (toMs - nowMs) / 1000 : 0,
    };
  }

  return {
    startMs: start,
    endMs: start + totalSec * 1000,
    before,
    startsInSec: before ? -elapsed : 0,
    over,
    overtimeSec: over ? elapsed - totalSec : 0,
    elapsedSec: Math.max(0, elapsed),
    totalSec,
    totalRemainingSec: Math.max(0, totalSec - Math.max(0, elapsed)),
    index,
    current,
    next,
    // Före start räknas väntan in i första segmentet
    segRemainingSec: current ? Math.max(0, current.endSec - elapsed) : 0,
    segProgress: current && segLength ? Math.min(1, segElapsed / segLength) : 0,
    timeline,
    wheel,
  };
}

/** Klockan som tickar varje sekund och räknar om direkt när sidan blir synlig. */
export function useStudyClock(session, { active = true } = {}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 1000);
    const onVis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', tick);
    };
  }, [active]);
  return computeClock(session, now);
}

/** mm:ss, eller h:mm:ss över en timme. */
export function formatCountdown(sec) {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

/** "1 h 20 min" / "13 min" för löptext. */
export function formatDuration(sec) {
  const min = Math.max(0, Math.ceil(sec / 60));
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function clockTime(ms) {
  return new Date(ms).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}
