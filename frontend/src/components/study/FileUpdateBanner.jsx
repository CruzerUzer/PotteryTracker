import React, { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { studyAPI } from '../../services/api';
import { useToast } from '../ui/toast';
import { useConfirm } from '../ui/confirm-dialog';
import { readLocal, writeLocal } from './studyUtils';

const DISMISS_KEY = 'study.dismissedFileVersion';

/**
 * "Ny version av planen (v3): Block 2 flyttat två veckor. Hämta?"
 * Inget byts ut utan att användaren väljer det.
 */
function FileUpdateBanner({ info, onAdopted }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [hidden, setHidden] = useState(() => readLocal(DISMISS_KEY) === info?.fileVersion);
  const [busy, setBusy] = useState(false);
  if (!info?.newer || hidden) return null;

  const adopt = async () => {
    const ok = await confirm({
      title: `Hämta planen v${info.fileVersion}?`,
      description: 'Den nya versionen ersätter din nuvarande plan. Dina tidigare versioner finns kvar under Versioner och kan återställas. Gjorda pass påverkas inte.',
      confirmLabel: 'Hämta',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await studyAPI.adoptFile();
      toast.success(`Planen v${info.fileVersion} är hämtad`);
      onAdopted?.();
    } catch (err) {
      toast.error('Kunde inte hämta planen', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="file-banner" role="status">
      <RefreshCw size={18} aria-hidden="true" className="file-banner-icon" />
      <div className="file-banner-text">
        <strong>Ny version av planen (v{info.fileVersion})</strong>
        {info.summary && <span>{info.summary}</span>}
      </div>
      <div className="file-banner-actions">
        <button type="button" className="btn btn-primary" onClick={adopt} disabled={busy}>Hämta</button>
        <button
          type="button"
          className="icon-btn icon-btn--ghost"
          aria-label="Inte nu"
          onClick={() => {
            writeLocal(DISMISS_KEY, info.fileVersion);
            setHidden(true);
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

export default FileUpdateBanner;
