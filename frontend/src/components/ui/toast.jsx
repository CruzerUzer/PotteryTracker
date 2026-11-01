import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

/**
 * Toasts för kvitton och felmeddelanden (ersätter window.alert).
 *
 *   const toast = useToast();
 *   toast.error('Kunde inte spara', err.message);
 *   toast.success('Sparat');
 *
 * Utan provider (t.ex. i enhetstester) loggas meddelandet i stället.
 */
const ToastContext = React.createContext(null);

let nextId = 1;

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);

  const remove = React.useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const api = React.useMemo(() => {
    const show = (variant, title, description, opts = {}) => {
      const id = nextId++;
      setToasts((list) => [...list.slice(-2), { id, variant, title, description, ...opts }]);
      return id;
    };
    return {
      show,
      success: (title, description, opts) => show('success', title, description, opts),
      error: (title, description, opts) => show('error', title, description, { duration: 6000, ...opts }),
      info: (title, description, opts) => show('info', title, description, opts),
      dismiss: remove,
    };
  }, [remove]);

  return (
    <ToastContext.Provider value={api}>
      <ToastPrimitive.Provider swipeDirection="down" duration={3500} label="Meddelande">
        {children}
        {toasts.map((t) => {
          const Icon = ICONS[t.variant] || Info;
          return (
            <ToastPrimitive.Root
              key={t.id}
              className={`toast toast--${t.variant}`}
              duration={t.duration}
              type={t.variant === 'error' ? 'foreground' : 'background'}
              onOpenChange={(open) => {
                if (!open) setTimeout(() => remove(t.id), 200);
              }}
            >
              <Icon className="toast-icon" size={18} aria-hidden="true" />
              <div className="toast-text">
                <ToastPrimitive.Title className="toast-title">{t.title}</ToastPrimitive.Title>
                {t.description && (
                  <ToastPrimitive.Description className="toast-description">
                    {t.description}
                  </ToastPrimitive.Description>
                )}
              </div>
              {t.action && (
                <ToastPrimitive.Action
                  className="toast-action"
                  altText={t.action.label}
                  onClick={t.action.onClick}
                >
                  {t.action.label}
                </ToastPrimitive.Action>
              )}
              <ToastPrimitive.Close className="toast-close" aria-label="Stäng">
                <X size={14} />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          );
        })}
        <ToastPrimitive.Viewport className="toast-viewport" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

const fallback = {
  show: (variant, title, description) => console.info(`[toast:${variant}]`, title, description || ''),
  success: (title, description) => console.info('[toast:success]', title, description || ''),
  error: (title, description) => console.warn('[toast:error]', title, description || ''),
  info: (title, description) => console.info('[toast:info]', title, description || ''),
  dismiss: () => {},
};

export function useToast() {
  return React.useContext(ToastContext) || fallback;
}
