import React, { useState } from 'react';
import { exportAPI } from '../services/api';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Download, Upload, Archive } from 'lucide-react';

function ExportData() {
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Export
  const [archivePassword, setArchivePassword] = useState('');
  const [encryptArchive, setEncryptArchive] = useState(false);
  const [creatingArchive, setCreatingArchive] = useState(false);

  // Import
  const [importFile, setImportFile] = useState(null);
  const [importPassword, setImportPassword] = useState('');
  const [importing, setImporting] = useState(false);

  const handleExportArchive = async () => {
    try {
      setCreatingArchive(true);
      setError(null);
      setSuccess(null);

      // Skapa arkivet (sparas på servern)
      const result = await exportAPI.exportArchive(encryptArchive ? archivePassword : undefined);

      // Ladda ner arkivfilen
      const response = await exportAPI.downloadArchive(result.filename);
      if (!response.ok) {
        throw new Error('Kunde inte hämta arkivet');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setArchivePassword('');
      setEncryptArchive(false);
      setSuccess('Säkerhetskopian är skapad och nedladdad. Förvara den på ett tryggt ställe.');
    } catch (err) {
      setError(err.message || 'Kunde inte skapa säkerhetskopian');
    } finally {
      setCreatingArchive(false);
    }
  };

  const isEncryptedFile = importFile?.name?.includes('.encrypted.');

  const handleImportArchive = async () => {
    if (!importFile) {
      setError('Välj en arkivfil att återställa från');
      return;
    }

    try {
      setImporting(true);
      setError(null);
      setSuccess(null);

      await exportAPI.importArchive(importFile, importPassword || undefined);

      setSuccess('Säkerhetskopian är återställd. Dina pjäser, material och bilder finns på plats igen.');
      setImportFile(null);
      setImportPassword('');
      const fileInput = document.getElementById('import-file');
      if (fileInput) fileInput.value = '';
    } catch (err) {
      setError(err.message || 'Kunde inte återställa säkerhetskopian');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="page-title">Säkerhetskopia</h2>

      {error && (
        <div className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 text-sm">
          {success}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Skapa säkerhetskopia
          </CardTitle>
          <CardDescription>
            Ladda ner allt – pjäser, material, faser, platser och bilder – som ett ZIP-arkiv. Spara det på en trygg plats, så kan du återställa din samling om något går förlorat. Kan krypteras med lösenord.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={encryptArchive}
                onChange={(e) => setEncryptArchive(e.target.checked)}
              />
              <span>Kryptera säkerhetskopian med lösenord</span>
            </label>
          </div>
          {encryptArchive && (
            <div className="space-y-2">
              <Label htmlFor="archive-password">Lösenord för säkerhetskopian</Label>
              <Input
                id="archive-password"
                type="password"
                value={archivePassword}
                onChange={(e) => setArchivePassword(e.target.value)}
                placeholder="Välj ett lösenord"
              />
              <p className="text-sm text-[var(--color-text-secondary)]">
                Spara lösenordet – utan det går arkivet inte att återställa.
              </p>
            </div>
          )}
          <Button
            onClick={handleExportArchive}
            disabled={creatingArchive || (encryptArchive && !archivePassword)}
            variant="outline"
          >
            <Archive className="mr-2 h-4 w-4" />
            {creatingArchive ? 'Skapar säkerhetskopia…' : 'Skapa säkerhetskopia'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Återställ från säkerhetskopia
          </CardTitle>
          <CardDescription>
            Läs in en tidigare säkerhetskopia och lägg tillbaka innehållet på ditt konto. Är arkivet krypterat behöver du lösenordet du valde när det skapades.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="import-file">Arkivfil (.zip eller .encrypted.zip)</Label>
            <Input
              id="import-file"
              type="file"
              accept=".zip,.encrypted.zip"
              onChange={(e) => {
                setImportFile(e.target.files[0] || null);
                setError(null);
                setSuccess(null);
              }}
            />
          </div>
          {isEncryptedFile && (
            <div className="space-y-2">
              <Label htmlFor="import-password">Arkivets lösenord</Label>
              <Input
                id="import-password"
                type="password"
                value={importPassword}
                onChange={(e) => setImportPassword(e.target.value)}
                placeholder="Lösenordet som arkivet krypterades med"
              />
            </div>
          )}
          <Button
            onClick={handleImportArchive}
            disabled={importing || !importFile || (isEncryptedFile && !importPassword)}
            variant="outline"
          >
            <Upload className="mr-2 h-4 w-4" />
            {importing ? 'Återställer…' : 'Återställ säkerhetskopia'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default ExportData;
