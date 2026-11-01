import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Bottom sheet (mobil) som blir en centrerad panel på större skärmar.
 * Bygger på Radix Dialog: fokusfälla, Esc, klick utanför och skärmläsarstöd.
 * Dra i greppet (eller rubriken) nedåt för att stänga.
 *
 * Användning:
 *   <Sheet open={open} onOpenChange={setOpen}>
 *     <SheetContent title="Mer" description="…">…</SheetContent>
 *   </Sheet>
 */
const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;

const DISMISS_DISTANCE = 90; // px nedåt som stänger arket
const DISMISS_VELOCITY = 0.6; // px/ms

const SheetContent = React.forwardRef(
  ({ className, children, title, description, hideTitle = false, showClose = true, footer, ...props }, ref) => {
    const panelRef = React.useRef(null);
    const drag = React.useRef(null);
    const closeRef = React.useRef(null);

    const setRefs = (node) => {
      panelRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    };

    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e) => {
      if (!drag.current || !panelRef.current) return;
      const dy = Math.max(0, e.clientY - drag.current.y);
      drag.current.dy = dy;
      panelRef.current.style.transition = 'none';
      panelRef.current.style.transform = `translateY(${dy}px)`;
    };
    const onPointerUp = () => {
      if (!drag.current || !panelRef.current) return;
      const { dy, t } = drag.current;
      const velocity = dy / Math.max(1, performance.now() - t);
      drag.current = null;
      const panel = panelRef.current;
      panel.style.transition = '';
      if (dy > DISMISS_DISTANCE || (dy > 24 && velocity > DISMISS_VELOCITY)) {
        panel.style.transform = 'translateY(100%)';
        closeRef.current?.click();
      } else {
        panel.style.transform = '';
      }
    };

    // Radix låter bara översta lagret ta emot Escape, och en toast räknas som
    // ett lager. Stäng arket även då, men inte om en bekräftelsedialog är öppen.
    React.useEffect(() => {
      const onKey = (e) => {
        if (e.key !== 'Escape') return;
        if (panelRef.current?.dataset.state !== 'open') return;
        if (document.querySelector('[role="alertdialog"][data-state="open"]')) return;
        if (document.querySelector('[role="menu"][data-state="open"]')) return;
        closeRef.current?.click();
      };
      document.addEventListener('keydown', onKey);
      return () => document.removeEventListener('keydown', onKey);
    }, []);

    const dragHandlers = {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    };

    return (
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="sheet-overlay" />
        <DialogPrimitive.Content
          ref={setRefs}
          className={cn('sheet-panel', className)}
          {...props}
        >
          <div className="sheet-grab" {...dragHandlers} aria-hidden="true">
            <span className="sheet-grab-bar" />
          </div>
          {(title || showClose) && (
            <div className={cn('sheet-header', hideTitle && 'sheet-header--bare')} {...dragHandlers}>
              {title ? (
                <DialogPrimitive.Title className={cn('sheet-title', hideTitle && 'sr-only')}>
                  {title}
                </DialogPrimitive.Title>
              ) : (
                <DialogPrimitive.Title className="sr-only">Panel</DialogPrimitive.Title>
              )}
              {showClose && (
                <DialogPrimitive.Close
                  className="sheet-close"
                  aria-label="Stäng"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <X size={18} />
                </DialogPrimitive.Close>
              )}
            </div>
          )}
          {description ? (
            <DialogPrimitive.Description className="sheet-description">{description}</DialogPrimitive.Description>
          ) : (
            <DialogPrimitive.Description className="sr-only">{title || 'Panel'}</DialogPrimitive.Description>
          )}
          <div className="sheet-body">{children}</div>
          {footer && <div className="sheet-footer">{footer}</div>}
          <DialogPrimitive.Close ref={closeRef} className="sr-only" tabIndex={-1} aria-hidden="true" />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  }
);
SheetContent.displayName = 'SheetContent';

export { Sheet, SheetTrigger, SheetClose, SheetContent };
