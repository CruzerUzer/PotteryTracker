import React, { useState, useEffect } from 'react';
import { versionAPI } from '../services/api.js';

function Footer() {
  const [backendVersion, setBackendVersion] = useState(null);
  const frontendVersion = import.meta.env.VITE_APP_VERSION || '1.0.0';

  useEffect(() => {
    // Fetch backend version
    versionAPI.getVersion()
      .then(data => {
        setBackendVersion(data.backend?.version || 'unknown');
      })
      .catch(() => {
        setBackendVersion('unknown');
      });
  }, []);

  return (
    <footer className="app-footer">
      <div className="container">
        <p className="version-info">
          Frontend: v{frontendVersion} | Backend: v{backendVersion || 'loading...'}
        </p>
      </div>
    </footer>
  );
}

export default Footer;

