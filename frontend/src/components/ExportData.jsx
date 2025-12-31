import React, { useState } from 'react';
import { exportAPI } from '../services/api';

function ExportData() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

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
      
      // Convert to JSON and download
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

  return (
    <div className="card">
      <h2>Export Data</h2>
      {error && <div className="error">{error}</div>}
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Export Pieces</h3>
        <p style={{ color: '#6b7280', marginBottom: '15px' }}>
          Export all your pieces as CSV or JSON format.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting}
            className="btn btn-primary"
          >
            {exporting ? 'Exporting...' : 'Export as CSV'}
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={exporting}
            className="btn btn-primary"
          >
            {exporting ? 'Exporting...' : 'Export as JSON'}
          </button>
        </div>
      </div>

      <div>
        <h3>Export Statistics</h3>
        <p style={{ color: '#6b7280', marginBottom: '15px' }}>
          Get a detailed report with statistics about your pieces.
        </p>
        <button
          onClick={handleExportStats}
          disabled={exporting}
          className="btn btn-secondary"
        >
          {exporting ? 'Generating...' : 'Export Statistics'}
        </button>
      </div>
    </div>
  );
}

export default ExportData;




