import React from 'react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Share, Plus } from 'lucide-react';

// iOS/Safari kan inte installera programmatiskt – visa steg-för-steg.
// Delas av install-bannern och knappen i Inställningar.
function IOSInstallHelp({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Lägg till på hemskärmen</DialogTitle>
          <DialogDescription>
            Så här installerar du PotteryTracker som app på din iPhone eller iPad.
          </DialogDescription>
        </DialogHeader>
        <ol style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0', margin: 0, listStyle: 'none' }}>
          <li style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Share size={20} color="var(--color-primary)" style={{ flexShrink: 0 }} />
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
              Tryck på <strong>Dela</strong>-ikonen i verktygsfältet.
            </span>
          </li>
          <li style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Plus size={20} color="var(--color-primary)" style={{ flexShrink: 0 }} />
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
              Välj <strong>Lägg till på hemskärmen</strong> i listan.
            </span>
          </li>
          <li style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 20,
                height: 20,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                color: 'var(--color-primary)',
              }}
            >
              ✓
            </span>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
              Tryck på <strong>Lägg till</strong> – klart!
            </span>
          </li>
        </ol>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Stäng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default IOSInstallHelp;
