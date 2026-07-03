import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

/**
 * Visible light/dark toggle in the header.
 * Toggles between explicit light/dark; 'auto' can still be chosen in Settings.
 */
function ThemeToggle() {
  const { theme, updateSettings } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={() => updateSettings({ theme: isDark ? 'light' : 'dark' })}
      title={isDark ? 'Byt till ljust läge' : 'Byt till mörkt läge'}
      aria-label={isDark ? 'Byt till ljust läge' : 'Byt till mörkt läge'}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '34px',
        height: '34px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        color: 'var(--color-text-primary)',
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--color-surface-hover)';
        e.currentTarget.style.borderColor = 'var(--color-border-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--color-surface)';
        e.currentTarget.style.borderColor = 'var(--color-border)';
      }}
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

export default ThemeToggle;
