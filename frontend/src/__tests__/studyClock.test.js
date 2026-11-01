import { describe, it, expect } from 'vitest';
import { computeClock, formatCountdown } from '../hooks/useStudyClock';

const SEGMENTS = [
  { id: 'in', name: 'In, utan skiva', minutes: 15, enabled: true },
  { id: 'main', name: 'Huvudpass, på skivan', minutes: 70, enabled: true, wheel: true },
  { id: 'finish', name: 'Finish, på skivan', minutes: 40, enabled: true, wheel: true },
  { id: 'leave-wheel', name: 'Lämna skivan', minutes: 10, enabled: true, wheel: true },
  { id: 'surface', name: 'Yta och glasyr, utan skiva', minutes: 25, enabled: true },
  { id: 'out', name: 'Städ och logg ut', minutes: 20, enabled: true },
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
  it('startad 09:47 med starttid 10:00 visar "In, utan skiva" till 10:15', () => {
    const c = computeClock(session, at('09:47'));
    expect(c.before).toBe(true);
    expect(c.current.name).toBe('In, utan skiva');
    expect(Math.round(c.startsInSec)).toBe(13 * 60);
    expect(computeClock(session, at('10:14', 59)).current.name).toBe('In, utan skiva');
  });

  it('visar "Huvudpass, på skivan" från 10:15 och skivan är bokad', () => {
    const c = computeClock(session, at('10:15'));
    expect(c.current.name).toBe('Huvudpass, på skivan');
    expect(c.wheel.state).toBe('on');
    expect(c.next.name).toBe('Finish, på skivan');
  });

  it('ger samma läge vid omladdning (ren funktion av starttid och klocka)', () => {
    const a = computeClock(session, at('11:02', 30));
    const b = computeClock(JSON.parse(JSON.stringify(session)), at('11:02', 30));
    expect(b).toEqual(a);
    expect(a.current.name).toBe('Huvudpass, på skivan');
    expect(formatCountdown(a.segRemainingSec)).toBe('22:30');
  });

  it('hoppar över avstängda segment', () => {
    const s = { ...session, segments: SEGMENTS.map((x) => (x.id === 'surface' ? { ...x, enabled: false } : x)) };
    expect(computeClock(s, at('12:20')).current.name).toBe('Städ och logg ut');
    expect(computeClock(s, at('12:20')).totalSec).toBe(155 * 60);
  });

  it('markerar när passet är slut', () => {
    const c = computeClock(session, at('13:05'));
    expect(c.over).toBe(true);
    expect(Math.round(c.overtimeSec)).toBe(5 * 60);
    expect(c.wheel.state).toBe('after');
  });

  it('visar ingen skivtid vid ren nedräkning', () => {
    expect(computeClock({ ...session, timer_mode: 'countdown' }, at('10:30')).wheel).toBeNull();
  });
});
