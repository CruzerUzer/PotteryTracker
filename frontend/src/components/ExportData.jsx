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
        throw new Error('Export failed');
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
    } catch (err) {
      setError(err.message || 'Failed to export archive');
    } finally {
      setCreatingArchive(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Export Data</h2>

      {error && (
        <div className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Export Pieces</CardTitle>
          <CardDescription>
            Export all your pieces as CSV or JSON format.
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
              {exporting ? 'Exporting...' : 'Export as CSV'}
            </Button>
            <Button
              onClick={() => handleExport('json')}
              disabled={exporting}
              variant="outline"
            >
              <FileJson className="mr-2 h-4 w-4" />
              {exporting ? 'Exporting...' : 'Export as JSON'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export Statistics</CardTitle>
          <CardDescription>
            Get a detailed report with statistics about your pieces.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleExportStats}
            disabled={exporting}
            variant="outline"
          >
            <BarChart3 className="mr-2 h-4 w-4" />
            {exporting ? 'Generating...' : 'Export Statistics'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export Complete Archive</CardTitle>
          <CardDescription>
            Export all your data (pieces, materials, phases, images) as a ZIP archive. Includes a PDF report. Optionally encrypt with a password.
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
    </div>
  );
}

export default ExportData;
