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
      setError(err.message || 'Kunde inte hämta registreringsinställningarna');
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
      setError(err.message || 'Kunde inte spara registreringsinställningarna');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Laddar…</div>;
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
          Inställningarna är sparade
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Registrering</CardTitle>
          <CardDescription>
            Styr om nya användare kan skapa konton.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="registration-enabled">Tillåt registrering</Label>
              <p className="text-sm text-[var(--color-text-secondary)]">
                När det är avstängt kan inga nya konton skapas.
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
              <Label htmlFor="registration-message">Meddelande vid stängd registrering</Label>
              <Textarea
                id="registration-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Skriv ett meddelande som visas när registreringen är stängd (valfritt)"
                rows={4}
              />
              <p className="text-sm text-[var(--color-text-secondary)]">
                Meddelandet visas för den som försöker registrera sig. Lämnas det tomt visas ett standardmeddelande.
              </p>
            </div>
          )}

          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Sparar…' : 'Spara inställningar'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default RegistrationControl;

