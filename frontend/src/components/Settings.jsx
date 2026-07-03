import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowLeft, Save, Palette, Lock } from 'lucide-react';

function Settings() {
  const navigate = useNavigate();
  const { settings, updateSettings } = useTheme();
  const { user, checkAuth } = useAuth();
  const [localSettings, setLocalSettings] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);

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

  useEffect(() => {
    // Check if user needs to change password
    // This would come from the user object if we add it
    // For now, we'll check on mount - this is a placeholder
  }, [user]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Lösenorden stämmer inte överens');
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Det nya lösenordet måste vara minst 8 tecken');
      return;
    }

    setChangingPassword(true);

    try {
      await authAPI.changePassword(mustChangePassword ? undefined : passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMustChangePassword(false);
      await checkAuth(); // Refresh user data
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      setPasswordError(err.message || 'Kunde inte byta lösenord');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="page-title">Inställningar</h2>
        <Button variant="secondary" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Tillbaka
        </Button>
      </div>

      {saved && (
        <div className="p-3 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 text-sm">
          Inställningarna är sparade
        </div>
      )}

      {/* Password Change Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Byt lösenord
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mustChangePassword && (
            <div className="mb-4 p-3 rounded-md bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 text-sm">
              Du behöver byta lösenord innan du kan fortsätta.
            </div>
          )}
          {passwordError && (
            <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
              {passwordError}
            </div>
          )}
          {passwordSuccess && (
            <div className="mb-4 p-3 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 text-sm">
              Lösenordet är bytt
            </div>
          )}
          <form onSubmit={handlePasswordChange} className="space-y-4">
            {!mustChangePassword && (
              <div className="space-y-2">
                <Label htmlFor="current-password">Nuvarande lösenord</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                  autoComplete="current-password"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-password">Nytt lösenord (minst 8 tecken)</Label>
              <Input
                id="new-password"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Bekräfta nytt lösenord</Label>
              <Input
                id="confirm-new-password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                autoComplete="new-password"
                required
              />
            </div>
            <Button type="submit" disabled={changingPassword}>
              {changingPassword ? 'Byter…' : 'Byt lösenord'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Utseende</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Tema</Label>
            <div className="flex gap-4">
              {[
                { value: 'light', label: 'Ljust' },
                { value: 'dark', label: 'Mörkt' },
                { value: 'auto', label: 'Följ systemet' },
              ].map(({ value, label }) => (
                <label key={value} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="theme"
                    value={value}
                    checked={localSettings.theme === value}
                    onChange={(e) => handleChange('theme', e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Textstorlek: {localSettings.fontSize}%</Label>
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
            <Label>Täthet</Label>
            <div className="flex gap-4">
              {[
                { value: 'compact', label: 'Kompakt' },
                { value: 'comfortable', label: 'Bekväm' },
                { value: 'spacious', label: 'Luftig' },
              ].map(({ value, label }) => (
                <label key={value} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="density"
                    value={value}
                    checked={localSettings.layoutDensity === value}
                    onChange={(e) => handleChange('layoutDensity', e.target.value)}
                    className="w-4 h-4"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Visning</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="default-view">Standardvy</Label>
            <Select
              value={localSettings.defaultView}
              onValueChange={(value) => handleChange('defaultView', value)}
            >
              <SelectTrigger id="default-view">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kanban">Kanban</SelectItem>
                <SelectItem value="list">Lista</SelectItem>
                <SelectItem value="grid">Rutnät</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span>Visa bilder på korten</span>
              <input
                type="checkbox"
                checked={localSettings.showImagesInCards}
                onChange={(e) => handleChange('showImagesInCards', e.target.checked)}
                className="w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer">
              <span>Visa beskrivningar</span>
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
            Fasfärger
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
            Spara inställningar
          </Button>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Avbryt
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default Settings;
