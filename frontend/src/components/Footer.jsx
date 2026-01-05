import React from 'react';

function Footer() {
  const appVersion = '1.0.0';

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

