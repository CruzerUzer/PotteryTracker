import React, { useState } from 'react';
import { imagesAPI } from '../services/api';

function ImageUpload({ pieceId, phases, onUploaded }) {
  const [files, setFiles] = useState([]);
  const [phaseId, setPhaseId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles(selectedFiles);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (files.length === 0) {
      setError('Please select at least one file');
      return;
    }

    if (!phaseId) {
      setError('Please select a phase');
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
        setSuccess(`${successCount} image(s) uploaded successfully${errorCount > 0 ? `, ${errorCount} failed` : ''}!`);
        setFiles([]);
        setPhaseId('');
        e.target.reset();
        if (onUploaded) {
          onUploaded();
        }
      }
      
      if (errorCount > 0 && successCount === 0) {
        setError(`Failed to upload images. Please try again.`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      setUploadProgress({});
    }
  };

  return (
    <div className="image-upload">
      <form onSubmit={handleSubmit}>
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        <div className="form-group">
          <label htmlFor="image-file">Select Image(s)</label>
          <input
            type="file"
            id="image-file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={handleFileChange}
            disabled={uploading}
          />
          <small style={{ display: 'block', marginTop: '5px', color: '#9ca3af', fontSize: '0.875rem' }}>
            You can select multiple images at once. On mobile devices, tap to take photos with your camera.
          </small>
          {files.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <strong>Selected: {files.length} file(s)</strong>
              <ul style={{ marginTop: '5px', fontSize: '0.875rem', color: '#6b7280' }}>
                {files.map((file, index) => (
                  <li key={index}>
                    {file.name}
                    {uploadProgress[index] === 'uploading' && ' (uploading...)'}
                    {uploadProgress[index] === 'success' && ' ✓'}
                    {uploadProgress[index] === 'error' && ' ✗'}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="image-phase">Phase</label>
          <select
            id="image-phase"
            value={phaseId}
            onChange={(e) => setPhaseId(e.target.value)}
            disabled={uploading}
            required
          >
            <option value="">Select a phase</option>
            {phases.map((phase) => (
              <option key={phase.id} value={phase.id}>
                {phase.name}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className="btn btn-primary" disabled={uploading || files.length === 0 || !phaseId}>
          {uploading ? `Uploading... (${Object.values(uploadProgress).filter(p => p === 'uploading').length}/${files.length})` : `Upload ${files.length > 0 ? `${files.length} ` : ''}Image${files.length !== 1 ? 's' : ''}`}
        </button>
      </form>
    </div>
  );
}

export default ImageUpload;



