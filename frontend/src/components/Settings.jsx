import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';

function Settings() {
  const navigate = useNavigate();
  const { settings, updateSettings } = useTheme();
  const [localSettings, setLocalSettings] = useState(settings);
  const [saved, setSaved] = useState(false);

  const handleChange = (key, value) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    updateSettings(localSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePhaseColorChange = (phaseName, color) => {
    setLocalSettings((prev) => ({
      ...prev,
      phaseColors: {
        ...prev.phaseColors,
        [phaseName]: color,
      },
    }));
    setSaved(false);
  };

  return (
    <div>
      <div className="actions-row">
        <h2>Settings</h2>
        <button onClick={() => navigate(-1)} className="btn btn-secondary">
          ← Back
        </button>
      </div>

      {saved && <div className="success">Settings saved!</div>}

      <div className="card">
        <h3>Appearance</h3>
        <div className="form-group">
          <label>Theme</label>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="theme"
                value="light"
                checked={localSettings.theme === 'light'}
                onChange={(e) => handleChange('theme', e.target.value)}
              />
              Light
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="theme"
                value="dark"
                checked={localSettings.theme === 'dark'}
                onChange={(e) => handleChange('theme', e.target.value)}
              />
              Dark
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="theme"
                value="auto"
                checked={localSettings.theme === 'auto'}
                onChange={(e) => handleChange('theme', e.target.value)}
              />
              Auto
            </label>
          </div>
        </div>

        <div className="form-group">
          <label>Font Size: {localSettings.fontSize}%</label>
          <input
            type="range"
            min="75"
            max="150"
            value={localSettings.fontSize}
            onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
            style={{ width: '100%', marginTop: '8px' }}
          />
        </div>

        <div className="form-group">
          <label>Layout Density</label>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="density"
                value="compact"
                checked={localSettings.layoutDensity === 'compact'}
                onChange={(e) => handleChange('layoutDensity', e.target.value)}
              />
              Compact
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="density"
                value="comfortable"
                checked={localSettings.layoutDensity === 'comfortable'}
                onChange={(e) => handleChange('layoutDensity', e.target.value)}
              />
              Comfortable
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                name="density"
                value="spacious"
                checked={localSettings.layoutDensity === 'spacious'}
                onChange={(e) => handleChange('layoutDensity', e.target.value)}
              />
              Spacious
            </label>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>View Preferences</h3>
        <div className="form-group">
          <label>Default View</label>
          <select
            value={localSettings.defaultView}
            onChange={(e) => handleChange('defaultView', e.target.value)}
          >
            <option value="kanban">Kanban</option>
            <option value="list">List</option>
            <option value="grid">Grid</option>
          </select>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <span>Show Images in Cards</span>
            <input
              type="checkbox"
              checked={localSettings.showImagesInCards}
              onChange={(e) => handleChange('showImagesInCards', e.target.checked)}
            />
          </label>
        </div>

        <div className="form-group">
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <span>Show Descriptions</span>
            <input
              type="checkbox"
              checked={localSettings.showDescriptions}
              onChange={(e) => handleChange('showDescriptions', e.target.checked)}
            />
          </label>
        </div>
      </div>

      <div className="card">
        <h3>Phase Colors</h3>
        {Object.entries(localSettings.phaseColors).map(([phaseName, color]) => (
          <div key={phaseName} className="form-group">
            <label>{phaseName}</label>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  backgroundColor: color,
                  border: '2px solid var(--color-border)',
                }}
              />
              <input
                type="color"
                value={color}
                onChange={(e) => handlePhaseColorChange(phaseName, e.target.value)}
                style={{ width: '60px', height: '40px', cursor: 'pointer' }}
              />
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>{color}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="btn-group">
        <button onClick={handleSave} className="btn btn-primary">
          Save Preferences
        </button>
        <button onClick={() => navigate(-1)} className="btn btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default Settings;

