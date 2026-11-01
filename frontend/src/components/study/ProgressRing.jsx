import React from 'react';

/** Tunn framstegsring: "4/12" i mitten. */
function ProgressRing({ value = 0, max = 1, size = 64, stroke = 4, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className="progress-ring" style={{ width: size, height: size }} role="img" aria-label={label || `${value} av ${max}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--block-accent, var(--color-primary))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="progress-ring-bar"
        />
      </svg>
      <span className="progress-ring-text" aria-hidden="true">
        {value}
        <span className="progress-ring-max">/{max}</span>
      </span>
    </div>
  );
}

export default ProgressRing;
