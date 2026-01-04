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
  theme: 'light', // 'light', 'dark', 'auto'
  fontSize: 100, // percentage
  layoutDensity: 'comfortable', // 'compact', 'comfortable', 'spacious'
  defaultView: 'kanban', // 'kanban', 'list', 'grid'
  showImagesInCards: true,
  showDescriptions: true,
  phaseColors: {
    'På tork': '#E3F2FD',
    'Skröjbränd': '#FFF3E0',
    'Glaserad': '#F3E5F5',
    'Glasyrbränd': '#E8F5E9',
  },
};

export const ThemeProvider = ({ children }) => {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('potteryTrackerSettings');
    return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
  });

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
  }, [actualTheme, settings.layoutDensity, settings.fontSize]);

  const updateSettings = (newSettings) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem('potteryTrackerSettings', JSON.stringify(updated));
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





