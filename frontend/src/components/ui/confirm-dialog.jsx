import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertTriangle } from 'lucide-react';

/**
 * Bekräftelsedialog som ersätter window.confirm.
 *
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Ta bort pjäsen?', description: '…', confirmLabel: 'Ta bort', destructive: true }))) return;
 *
 * Utan provider (t.ex. i enhetstester) används window.confirm som reserv.
 */
const ConfirmContext = React.createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = React.useState(null);
  const resolver = React.useRef(null);

  const confirm = React.useCallback((options) => {
    return new Promise((resolve) => {
      resolver.current = resolve;
      setState({ open: true, ...options });
    });
  }, []);

  const finish = (value) => {
    resolver.current?.(value);
    resolver.current = null;
    setState((s) => (s ? { ...s, open: false } : s));
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <DialogPrimitive.Root open={!!state?.open} onOpenChange={(open) => !open && finish(false)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="sheet-overlay" />
          <DialogPrimitive.Content className="confirm-panel" role="alertdialog">
            {state?.destructive && (
              <div className="confirm-icon" aria-hidden="true">
                <AlertTriangle size={22} />
              </div>
            )}
            <DialogPrimitive.Title className="confirm-title">{state?.title || 'Är du säker?'}</DialogPrimitive.Title>
            {state?.description ? (
              <DialogPrimitive.Description className="confirm-description">
                {state.description}
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">Bekräfta åtgärden</DialogPrimitive.Description>
            )}
            <div className="confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={() => finish(false)}>
                {state?.cancelLabel || 'Avbryt'}
              </button>
              <button
                type="button"
                className={`btn ${state?.destructive ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => finish(true)}
              >
                {state?.confirmLabel || 'OK'}
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext);
  return (
    ctx ||
    ((options = {}) =>
      Promise.resolve(window.confirm([options.title, options.description].filter(Boolean).join('\n\n'))))
  );
}
