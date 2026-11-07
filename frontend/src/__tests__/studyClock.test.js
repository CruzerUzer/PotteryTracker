import { describe, it, expect } from 'vitest';
import { computeClock, formatCountdown } from '../hooks/useStudyClock';

const SEGMENTS = [
  { id: 'in', name: 'Förberedelse', minutes: 15, enabled: true },
  { id: 'main', name: 'Drejning', minutes: 70, enabled: true, wheel: true },
  { id: 'finish', name: 'Beskickning', minutes: 40, enabled: true, wheel: true },
  { id: 'leave-wheel', name: 'Lämna drejskivan', minutes: 10, enabled: true, wheel: true },
  { id: 'surface', name: 'Dekor och glasyr', minutes: 25, enabled: true },
  { id: 'out', name: 'Städning och loggbok', minutes: 20, enabled: true },
];
const at = (hhmm, sec = 0) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2026, 10, 7, h, m, sec).getTime();
};
const session = {
  planned_start: new Date(at('10:00')).toISOString(),
  segments: SEGMENTS,
  timer_mode: 'clock',
  wheel_booking: { fromMinute: 15, toMinute: 135 },
};

describe('computeClock', () => {
  it('startad 09:47 med starttid 10:00 visar "Förberedelse" till 10:15', () => {
    const c = computeClock(session, at('09:47'));
    expect(c.before).toBe(true);
    expect(c.current.name).toBe('Förberedelse');
    expect(Math.round(c.startsInSec)).toBe(13 * 60);
    expect(computeClock(session, at('10:14', 59)).current.name).toBe('Förberedelse');
  });

  it('visar "Drejning" från 10:15 och drejskivan är bokad', () => {
    const c = computeClock(session, at('10:15'));
    expect(c.current.name).toBe('Drejning');
    expect(c.wheel.state).toBe('on');
    expect(c.next.name).toBe('Beskickning');
  });

  it('ger samma läge vid omladdning (ren funktion av starttid och klocka)', () => {
    const a = computeClock(session, at('11:02', 30));
    const b = computeClock(JSON.parse(JSON.stringify(session)), at('11:02', 30));
    expect(b).toEqual(a);
    expect(a.current.name).toBe('Drejning');
    expect(formatCountdown(a.segRemainingSec)).toBe('22:30');
  });

  it('hoppar över avstängda segment', () => {
    const s = { ...session, segments: SEGMENTS.map((x) => (x.id === 'surface' ? { ...x, enabled: false } : x)) };
    expect(computeClock(s, at('12:20')).current.name).toBe('Städning och loggbok');
    expect(computeClock(s, at('12:20')).totalSec).toBe(155 * 60);
  });

  it('markerar när passet är slut', () => {
    const c = computeClock(session, at('13:05'));
    expect(c.over).toBe(true);
    expect(Math.round(c.overtimeSec)).toBe(5 * 60);
    expect(c.wheel.state).toBe('after');
  });

  it('visar ingen tid på drejskivan vid ren nedräkning', () => {
    expect(computeClock({ ...session, timer_mode: 'countdown' }, at('10:30')).wheel).toBeNull();
  });
});
