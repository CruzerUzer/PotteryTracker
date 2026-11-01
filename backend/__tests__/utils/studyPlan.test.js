import { describe, it, expect } from '@jest/globals';
import {
  loadPlanFile,
  loadPlanDocument,
  validatePlan,
  computeProgress,
  guessStageMap,
} from '../../utils/studyPlan.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

describe('studieplanen', () => {
  const plan = loadPlanFile();

  it('planfilen validerar mot schemat', () => {
    expect(validatePlan(plan)).toEqual({ valid: true, errors: [] });
  });

  it('ordet biskvi förekommer inte i planfilerna', () => {
    expect(JSON.stringify(plan)).not.toMatch(/biskvi/i);
    expect(loadPlanDocument()).not.toMatch(/biskvi/i);
    expect(plan.firingPipeline.stages.find((s) => s.id === 'bisque').name).toBe('Skröjbränt');
  });

  it('underkänner en plan som saknar block', () => {
    const bad = clone(plan);
    delete bad.phases;
    expect(validatePlan(bad).valid).toBe(false);
  });

  it('underkänner kort som inte finns i leken', () => {
    const bad = clone(plan);
    bad.phases[1].playCards.push('saknas');
    const { valid, errors } = validatePlan(bad);
    expect(valid).toBe(false);
    expect(errors.join()).toMatch(/saknas/);
  });

  it('underkänner överlappande veckor', () => {
    const bad = clone(plan);
    bad.phases[1].weekFrom = 4;
    expect(validatePlan(bad).valid).toBe(false);
  });

  it('räknar vecka och block från genomförda pass', () => {
    expect(computeProgress(plan, 0)).toMatchObject({ week: 1, doneInBlock: 0, blockLength: 4 });
    expect(computeProgress(plan, 0).block.id).toBe('restart');
    expect(computeProgress(plan, 4).block.id).toBe('block-1');
    expect(computeProgress(plan, 4).week).toBe(5);
    expect(computeProgress(plan, 9)).toMatchObject({ week: 10, doneInBlock: 5 });
    expect(computeProgress(plan, 52)).toMatchObject({ week: 52, finished: true });
  });

  it('gissar mappningen mot ägarens faser', () => {
    const phases = [
      { id: 1, name: 'På gång', display_order: 1 },
      { id: 2, name: 'Skröjbränd', display_order: 2 },
      { id: 3, name: 'Glasyrbränning', display_order: 3 },
      { id: 4, name: 'Klar', display_order: 4 },
    ];
    expect(guessStageMap(phases)).toEqual({ thrown: 1, trimmed: 1, bisque: 2, glazed: 3, done: 4 });
  });
});
