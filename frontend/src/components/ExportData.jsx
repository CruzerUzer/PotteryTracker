import React, { useState } from 'react';
import { exportAPI } from '../services/api';
import { Button } from './ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Download, FileJson, FileSpreadsheet, BarChart3, Archive } from 'lucide-react';

function ExportData() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [archivePassword, setArchivePassword] = useState('');
  const [encryptArchive, setEncryptArchive] = useState(false);
  const [creatingArchive, setCreatingArchive] = useState(false);

  const handleExport = async (format) => {
    try {
      setExporting(true);
      setError(null);
      
      const response = await fetch(`/api/export/pieces?format=${format}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Exporten misslyckades');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : `pottery-pieces.${format}`;
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportStats = async () => {
    try {
      setExporting(true);
      setError(null);
      
      const stats = await exportAPI.getStats();
      
      const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pottery-stats-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportArchive = async () => {
    try {
      setCreatingArchive(true);
      setError(null);
      
      // Create archive (stored on server)
      const result = await exportAPI.exportArchive(encryptArchive ? archivePassword : undefined);
      
      // Download the archive file
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
      
      // Reset form
      setArchivePassword('');
      setEncryptArchive(false);
    } catch (err) {
      setError(err.message || 'Kunde inte skapa arkivet');
    } finally {
      setCreatingArchive(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="page-title">Exportera</h2>

      {error && (
        <div className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Pjäser</CardTitle>
          <CardDescription>
            Ladda ner alla dina pjäser som CSV (för kalkylblad) eller JSON.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={() => handleExport('csv')}
              disabled={exporting}
              variant="outline"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              {exporting ? 'Exporterar…' : 'Exportera som CSV'}
            </Button>
            <Button
              onClick={() => handleExport('json')}
              disabled={exporting}
              variant="outline"
            >
              <FileJson className="mr-2 h-4 w-4" />
              {exporting ? 'Exporterar…' : 'Exportera som JSON'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Statistik</CardTitle>
          <CardDescription>
            Hämta en sammanställning med statistik över dina pjäser.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleExportStats}
            disabled={exporting}
            variant="outline"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            {exporting ? 'Skapar…' : 'Exportera statistik'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Komplett arkiv</CardTitle>
          <CardDescription>
            Ladda ner allt – pjäser, material, faser och bilder – som ett ZIP-arkiv med PDF-rapport. Bra som säkerhetskopia. Kan krypteras med lösenord.
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
              <span>Kryptera arkivet med lösenord</span>
            </label>
          </div>
          {encryptArchive && (
            <div className="space-y-2">
              <Label htmlFor="archive-password">Lösenord för arkivet</Label>
              <Input
                id="archive-password"
                type="password"
                value={archivePassword}
                onChange={(e) => setArchivePassword(e.target.value)}
                placeholder="Välj ett lösenord"
              />
            </div>
          )}
          <Button
            onClick={handleExportArchive}
            disabled={creatingArchive || (encryptArchive && !archivePassword)}
            variant="outline"
          >
            <Archive className="mr-2 h-4 w-4" />
            {creatingArchive ? 'Skapar arkiv…' : 'Exportera arkiv'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default ExportData;
