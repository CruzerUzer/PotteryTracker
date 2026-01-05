import React, { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Save } from 'lucide-react';

function RegistrationControl() {
  const [enabled, setEnabled] = useState(true);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const data = await adminAPI.getRegistrationStatus();
      setEnabled(data.enabled);
      setMessage(data.message || '');
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load registration status');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await adminAPI.setRegistrationStatus(enabled, message);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message || 'Failed to update registration status');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      {saved && (
        <div className="p-3 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 text-sm">
          Registration settings saved!
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Registration Control</CardTitle>
          <CardDescription>
            Control whether new users can register accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="registration-enabled">Allow Registration</Label>
              <p className="text-sm text-[var(--color-text-secondary)]">
                When disabled, new users cannot create accounts.
              </p>
            </div>
            <label className="flex items-center">
              <input
                type="checkbox"
                id="registration-enabled"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="w-4 h-4"
              />
            </label>
          </div>

          {!enabled && (
            <div className="space-y-2">
              <Label htmlFor="registration-message">Registration Closed Message</Label>
              <Textarea
                id="registration-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter a message to display when registration is closed (optional)"
                rows={4}
              />
              <p className="text-sm text-[var(--color-text-secondary)]">
                This message will be shown to users when they try to register. If left empty, a default message will be displayed.
              </p>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default RegistrationControl;

