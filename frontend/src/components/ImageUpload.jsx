import React, { useState, useEffect } from 'react';
import { imagesAPI } from '../services/api';
import { Button } from './ui/button';
import { Upload, CheckCircle, XCircle, Loader2, Camera, Check } from 'lucide-react';
import { phaseColor } from './kanban/phaseColors';

function ImageUpload({ pieceId, phases, onUploaded, defaultPhaseId = null }) {
  const [files, setFiles] = useState([]);
  const [phaseId, setPhaseId] = useState(defaultPhaseId || '');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [hasUserSelectedPhase, setHasUserSelectedPhase] = useState(false);

  useEffect(() => {
    if (defaultPhaseId && !hasUserSelectedPhase) {
      setPhaseId(defaultPhaseId);
    }
  }, [defaultPhaseId, hasUserSelectedPhase]);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    const oversizedFiles = selectedFiles.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      const fileNames = oversizedFiles.map(f => {
        const sizeMB = (f.size / (1024 * 1024)).toFixed(2);
        return `${f.name} (${sizeMB} MB)`;
      }).join(', ');
      setError(`För stora filer: ${fileNames}. Största tillåtna storlek är 10 MB.`);
      setFiles([]);
      setSuccess(null);
      e.target.value = '';
      return;
    }
    
    setFiles(selectedFiles);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (files.length === 0) {
      setError('Välj minst en bild att ladda upp');
      return;
    }

    if (!phaseId) {
      setError('Välj vilken fas bilden hör till');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress({});

    try {
      let successCount = 0;
      let errorCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          setUploadProgress(prev => ({ ...prev, [i]: 'uploading' }));
          await imagesAPI.upload(pieceId, file, parseInt(phaseId));
          setUploadProgress(prev => ({ ...prev, [i]: 'success' }));
          successCount++;
        } catch (err) {
          setUploadProgress(prev => ({ ...prev, [i]: 'error' }));
          errorCount++;
          console.error(`Error uploading ${file.name}:`, err);
        }
      }

      if (successCount > 0) {
        setSuccess(
          successCount === 1
            ? `Bilden är uppladdad${errorCount > 0 ? `, men ${errorCount} misslyckades` : ''}`
            : `${successCount} bilder uppladdade${errorCount > 0 ? `, ${errorCount} misslyckades` : ''}`
        );
        setFiles([]);
        setPhaseId(defaultPhaseId || '');
        setHasUserSelectedPhase(false);
        e.target.reset();
        if (onUploaded) {
          onUploaded();
        }
      }
      
      if (errorCount > 0 && successCount === 0) {
        setError('Uppladdningen misslyckades. Försök igen.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div className="space-y-2">
          <label htmlFor="image-file" className={`file-drop${uploading ? ' file-drop--disabled' : ''}`}>
            <Camera size={22} aria-hidden="true" />
            <span className="file-drop-title">
              {files.length === 0
                ? 'Välj eller ta bilder'
                : files.length === 1
                  ? '1 bild vald'
                  : `${files.length} bilder valda`}
            </span>
            <span className="file-drop-hint">Flera åt gången går bra. Max 10 MB per bild.</span>
            <input
              type="file"
              id="image-file"
              className="sr-only"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
          {files.length > 0 && (
            <ul className="space-y-1 text-sm text-[var(--color-text-secondary)]">
              {files.map((file, index) => (
                <li key={index} className="flex items-center gap-2 min-w-0">
                  {uploadProgress[index] === 'uploading' && <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />}
                  {uploadProgress[index] === 'success' && <CheckCircle className="h-4 w-4 text-[var(--color-success)] flex-shrink-0" />}
                  {uploadProgress[index] === 'error' && <XCircle className="h-4 w-4 text-[var(--color-error)] flex-shrink-0" />}
                  <span className="truncate">{file.name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <span className="field-sublabel" id="image-phase-label">Bilden hör till fas</span>
          <div className="chip-row" role="radiogroup" aria-labelledby="image-phase-label">
            {phases.map((phase, i) => {
              const active = String(phaseId) === String(phase.id);
              const c = phaseColor(i);
              return (
                <button
                  key={phase.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={`chip chip--phase${active ? ' chip--active' : ''}`}
                  style={{ '--chip-bg': c.bg, '--chip-border': c.border, '--chip-accent': c.accent }}
                  onClick={() => {
                    setPhaseId(String(phase.id));
                    setHasUserSelectedPhase(true);
                  }}
                  disabled={uploading}
                >
                  {active && <Check size={14} aria-hidden="true" />}
                  {phase.name}
                </button>
              );
            })}
          </div>
        </div>

        <Button type="submit" disabled={uploading || files.length === 0 || !phaseId} className="w-full">
          {uploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Laddar upp… ({Object.values(uploadProgress).filter(p => p === 'uploading').length}/{files.length})
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              {files.length > 1 ? `Ladda upp ${files.length} bilder` : 'Ladda upp bild'}
            </>
          )}
        </Button>
      </form>
    </div>
  );
}

export default ImageUpload;
