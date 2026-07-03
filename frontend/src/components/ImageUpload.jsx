import React, { useState, useEffect } from 'react';
import { imagesAPI } from '../services/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Upload, CheckCircle, XCircle, Loader2 } from 'lucide-react';

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
          <Label htmlFor="image-file">Välj bilder</Label>
          <Input
            type="file"
            id="image-file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            disabled={uploading}
          />
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Du kan välja flera bilder samtidigt. På mobilen kan du hämta från bildbiblioteket eller fota direkt.
          </p>
          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-medium">{files.length === 1 ? '1 bild vald' : `${files.length} bilder valda`}</p>
              <ul className="space-y-1 text-sm text-[var(--color-text-secondary)]">
                {files.map((file, index) => (
                  <li key={index} className="flex items-center gap-2">
                    {uploadProgress[index] === 'uploading' && <Loader2 className="h-4 w-4 animate-spin" />}
                    {uploadProgress[index] === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
                    {uploadProgress[index] === 'error' && <XCircle className="h-4 w-4 text-red-600" />}
                    <span>{file.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="image-phase">Fas</Label>
          <Select
            value={phaseId || undefined}
            onValueChange={(value) => {
              setPhaseId(value || '');
              setHasUserSelectedPhase(true);
            }}
            disabled={uploading}
            required
          >
            <SelectTrigger id="image-phase">
              <SelectValue placeholder="Välj fas" />
            </SelectTrigger>
            <SelectContent>
              {phases.map((phase) => (
                <SelectItem key={phase.id} value={phase.id.toString()}>
                  {phase.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
