import React, { useState } from 'react';
import { imagesAPI } from '../services/api';

function ImageUpload({ pieceId, phases, onUploaded }) {
  const [file, setFile] = useState(null);
  const [phaseId, setPhaseId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) {
      setError('Please select a file');
      return;
    }

    if (!phaseId) {
      setError('Please select a phase');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      await imagesAPI.upload(pieceId, file, parseInt(phaseId));
      setSuccess('Image uploaded successfully!');
      setFile(null);
      setPhaseId('');
      e.target.reset();
      if (onUploaded) {
        onUploaded();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="image-upload">
      <form onSubmit={handleSubmit}>
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        <div className="form-group">
          <label htmlFor="image-file">Select Image</label>
          <input
            type="file"
            id="image-file"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
          />
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

        <button type="submit" className="btn btn-primary" disabled={uploading || !file || !phaseId}>
          {uploading ? 'Uploading...' : 'Upload Image'}
        </button>
      </form>
    </div>
  );
}

export default ImageUpload;



