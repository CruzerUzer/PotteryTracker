import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowLeft, Save, Palette } from 'lucide-react';

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Settings</h2>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      {saved && (
        <div className="p-3 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 text-sm">
          Settings saved!
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Theme</Label>
            <div className="flex gap-4">
              {['light', 'dark', 'auto'].map((theme) => (
                <label key={theme} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="theme"
                    value={theme}
                    checked={localSettings.theme === theme}
                    onChange={(e) => handleChange('theme', e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="capitalize">{theme}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Font Size: {localSettings.fontSize}%</Label>
            <input
              type="range"
              min="75"
              max="150"
              value={localSettings.fontSize}
              onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="space-y-3">
            <Label>Layout Density</Label>
            <div className="flex gap-4">
              {['compact', 'comfortable', 'spacious'].map((density) => (
                <label key={density} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="density"
                    value={density}
                    checked={localSettings.layoutDensity === density}
                    onChange={(e) => handleChange('layoutDensity', e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="capitalize">{density}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>View Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="default-view">Default View</Label>
            <Select
              value={localSettings.defaultView}
              onValueChange={(value) => handleChange('defaultView', value)}
            >
              <SelectTrigger id="default-view">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kanban">Kanban</SelectItem>
                <SelectItem value="list">List</SelectItem>
                <SelectItem value="grid">Grid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span>Show Images in Cards</span>
              <input
                type="checkbox"
                checked={localSettings.showImagesInCards}
                onChange={(e) => handleChange('showImagesInCards', e.target.checked)}
                className="w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span>Show Descriptions</span>
              <input
                type="checkbox"
                checked={localSettings.showDescriptions}
                onChange={(e) => handleChange('showDescriptions', e.target.checked)}
                className="w-4 h-4"
              />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Phase Colors
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(localSettings.phaseColors).map(([phaseName, color]) => (
            <div key={phaseName} className="space-y-2">
              <Label>{phaseName}</Label>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-lg border-2 border-[var(--color-border)]"
                  style={{ backgroundColor: color }}
                />
                <input
                  type="color"
                  value={color}
                  onChange={(e) => handlePhaseColorChange(phaseName, e.target.value)}
                  className="w-16 h-12 cursor-pointer rounded border border-[var(--color-border)]"
                />
                <span className="text-sm text-[var(--color-text-secondary)] font-mono">{color}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardFooter className="gap-2">
          <Button onClick={handleSave} className="flex-1">
            <Save className="mr-2 h-4 w-4" />
            Save Preferences
          </Button>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default Settings;
