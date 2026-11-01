import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

const defaultSettings = {
  theme: 'light', // 'light', 'dark', 'auto' — ljust läge som standard för nya användare
  fontSize: 100, // percentage
  layoutDensity: 'comfortable', // 'compact', 'comfortable', 'spacious'
};

// Inställningar som togs bort 2026-11 (lästes aldrig). Rensas ur sparad data.
const REMOVED_KEYS = ['defaultView', 'showImagesInCards', 'showDescriptions', 'phaseColors'];

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('potteryTrackerSettings') || 'null');
    if (!saved) return defaultSettings;
    const clean = { ...saved };
    REMOVED_KEYS.forEach((k) => delete clean[k]);
    if (REMOVED_KEYS.some((k) => k in saved)) {
      localStorage.setItem('potteryTrackerSettings', JSON.stringify(clean));
    }
    return { ...defaultSettings, ...clean };
  } catch {
    return defaultSettings;
  }
}

export const ThemeProvider = ({ children }) => {
  const [settings, setSettings] = useState(loadSettings);

  const [actualTheme, setActualTheme] = useState('light');

  useEffect(() => {
    // Determine actual theme based on setting
    if (settings.theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setActualTheme(prefersDark ? 'dark' : 'light');
      
      // Listen for system theme changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e) => setActualTheme(e.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      setActualTheme(settings.theme);
    }
  }, [settings.theme]);

  useEffect(() => {
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', actualTheme);
    document.documentElement.setAttribute('data-density', settings.layoutDensity);
    document.documentElement.style.fontSize = `${settings.fontSize}%`;
    // Statusfältet i mobilwebbläsaren följer temat
    const bg = actualTheme === 'dark' ? '#111013' : '#F4F1EA';
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', bg));
    document.documentElement.style.colorScheme = actualTheme;
  }, [actualTheme, settings.layoutDensity, settings.fontSize]);

  const updateSettings = (newSettings) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    try {
      localStorage.setItem('potteryTrackerSettings', JSON.stringify(updated));
    } catch {
      /* privat läge: inställningen gäller bara den här sessionen */
    }
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
    localStorage.removeItem('potteryTrackerSettings');
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: actualTheme,
        settings,
        updateSettings,
        resetSettings,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};





