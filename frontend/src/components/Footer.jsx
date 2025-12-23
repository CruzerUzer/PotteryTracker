import React, { useState, useEffect } from 'react';
import { versionAPI } from '../services/api.js';
import { FRONTEND_VERSION } from '../version.js';

function Footer() {
  const [backendVersion, setBackendVersion] = useState(null);
  const frontendVersion = FRONTEND_VERSION;

  useEffect(() => {
    // Fetch backend version
    // #region agent log
    console.log('[FOOTER] Fetching backend version...');
    // #endregion
    versionAPI.getVersion()
      .then(data => {
        // #region agent log
        console.log('[FOOTER] Backend version response:', data);
        // #endregion
        setBackendVersion(data.backend?.version || 'unknown');
      })
      .catch((error) => {
        // #region agent log
        console.error('[FOOTER] Error fetching backend version:', error);
        // #endregion
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

