// Fasfärgerna kommer från tokens i App.css (--phase-color-N).
const PHASE_COLOR_COUNT = 5;

export function phaseColor(index) {
  const n = ((index < 0 ? 0 : index) % PHASE_COLOR_COUNT) + 1;
  return {
    bg: `var(--phase-color-${n})`,
    border: `var(--phase-color-${n}-border)`,
    accent: `var(--phase-color-${n}-accent)`,
  };
}

export function phaseColorById(phases, phaseId) {
  return phaseColor(phases.findIndex((p) => p.id === phaseId));
}
