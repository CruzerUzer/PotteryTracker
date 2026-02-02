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
  const [archivePassword, setArchivePassword] = useState('');
  const [encryptArchive, setEncryptArchive] = useState(false);
  const [creatingArchive, setCreatingArchive] = useState(false);

  // Import state
  const [importFile, setImportFile] = useState(null);
  const [importPassword, setImportPassword] = useState('');
  const [importing, setImporting] = useState(false);

  const handleExportArchive = async () => {
    try {
      setCreatingArchive(true);
      setError(null);
      setSuccess(null);

      // Create archive (stored on server)
      const result = await exportAPI.exportArchive(encryptArchive ? archivePassword : undefined);

      // Download the archive file
      const response = await exportAPI.downloadArchive(result.filename);
      if (!response.ok) {
        throw new Error('Failed to download archive');
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

      // Reset form
      setArchivePassword('');
      setEncryptArchive(false);
      setSuccess('Archive exported successfully');
    } catch (err) {
      setError(err.message || 'Failed to export archive');
    } finally {
      setCreatingArchive(false);
    }
  };

  const handleImportArchive = async () => {
    if (!importFile) {
      setError('Please select an archive file to import');
      return;
    }

    try {
      setImporting(true);
      setError(null);
      setSuccess(null);

      await exportAPI.importArchive(importFile, importPassword || undefined);

      setSuccess('Archive imported successfully! Your data has been restored.');
      setImportFile(null);
      setImportPassword('');

      // Clear file input
      const fileInput = document.getElementById('import-file');
      if (fileInput) fileInput.value = '';
    } catch (err) {
      setError(err.message || 'Failed to import archive');
    } finally {
      setImporting(false);
    }
  };

  const isEncryptedFile = importFile?.name?.includes('.encrypted.');

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Backup</h2>

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
            Export Archive
          </CardTitle>
          <CardDescription>
            Export all your data (pieces, materials, phases, locations, images) as a ZIP archive. Optionally encrypt with a password for secure storage.
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
              <span>Encrypt archive with password</span>
            </label>
          </div>
          {encryptArchive && (
            <div className="space-y-2">
              <Label htmlFor="archive-password">Archive Password</Label>
              <Input
                id="archive-password"
                type="password"
                value={archivePassword}
                onChange={(e) => setArchivePassword(e.target.value)}
                placeholder="Enter password for encryption"
              />
            </div>
          )}
          <Button
            onClick={handleExportArchive}
            disabled={creatingArchive || (encryptArchive && !archivePassword)}
            variant="outline"
          >
            <Archive className="mr-2 h-4 w-4" />
            {creatingArchive ? 'Creating Archive...' : 'Export Archive'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Archive
          </CardTitle>
          <CardDescription>
            Restore your data from a previously exported archive. If the archive is encrypted, provide the password used during export.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="import-file">Archive File</Label>
            <Input
              id="import-file"
              type="file"
              accept=".zip"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            />
          </div>
          {(isEncryptedFile || importPassword) && (
            <div className="space-y-2">
              <Label htmlFor="import-password">
                Archive Password {isEncryptedFile && <span className="text-muted-foreground">(encrypted archive detected)</span>}
              </Label>
              <Input
                id="import-password"
                type="password"
                value={importPassword}
                onChange={(e) => setImportPassword(e.target.value)}
                placeholder="Enter password to decrypt archive"
              />
            </div>
          )}
          <Button
            onClick={handleImportArchive}
            disabled={importing || !importFile || (isEncryptedFile && !importPassword)}
            variant="outline"
          >
            <Upload className="mr-2 h-4 w-4" />
            {importing ? 'Importing...' : 'Import Archive'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default ExportData;
