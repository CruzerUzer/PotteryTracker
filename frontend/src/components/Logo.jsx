/**
 * PotteryTracker logo — soft studio jug with smooth curves.
 * Uses currentColor so it follows the surrounding text/theme color.
 */
function Logo({ size = 26, color = 'var(--color-primary)' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{ flexShrink: 0, color }}
    >
      <path
        d="M25 7
          C 24.2 7, 23.5 7.8, 23.5 9
          C 23.5 13.5, 26.5 15.5, 26.5 20
          C 26.5 24.5, 17 27.5, 15 36
          C 12.8 45.5, 20.5 56, 32 56
          C 43.5 56, 51.2 45.5, 49 36
          C 47 27.5, 37.5 24.5, 37.5 20
          C 37.5 15.5, 40.5 13.5, 40.5 9
          C 40.5 7.8, 39.8 7, 39 7
          Z"
        fill="currentColor"
      />
      <path
        d="M22 38 C 22 44 25 49 30 50.5"
        stroke="var(--color-surface, #fff)"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

export default Logo;
