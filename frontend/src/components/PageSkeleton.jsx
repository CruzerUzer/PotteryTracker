import React from 'react';

/** Laddningsskelett: rubrik och några rader, i samma form som innehållet. */
function PageSkeleton({ rows = 4, title = true, label = 'Laddar' }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label={label}>
      {title && <div className="skeleton h-8 w-44" />}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-16 w-full rounded-xl" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}

export default PageSkeleton;
