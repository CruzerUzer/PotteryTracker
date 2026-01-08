import React from 'react';
import { FRONTEND_VERSION } from '../version';

function Footer() {
  const appVersion = FRONTEND_VERSION;

  return (
    <footer className="app-footer">
      <div className="container">
        <p className="version-info">
          PotteryTracker v{appVersion}
        </p>
      </div>
    </footer>
  );
}

export default Footer;

