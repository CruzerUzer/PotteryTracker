import React, { useState } from 'react';
import { adminAPI } from '../services/api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Copy, Check } from 'lucide-react';

function PasswordResetDialog({ user, onClose }) {
  const [method, setMethod] = useState('temporary'); // 'temporary' or 'link'
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleReset = async () => {
    try {
      setLoading(true);
      const data = await adminAPI.resetPassword(user.id, method);
      setResult(data);
    } catch (error) {
      setResult({ error: error.message || 'Kunde inte återställa lösenordet' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Återställ lösenord för {user.username}</DialogTitle>
          <DialogDescription>
            Välj hur lösenordet ska återställas.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Metod</Label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="method"
                      value="temporary"
                      checked={method === 'temporary'}
                      onChange={(e) => setMethod(e.target.value)}
                    />
                    <span>Skapa tillfälligt lösenord</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="method"
                      value="link"
                      checked={method === 'link'}
                      onChange={(e) => setMethod(e.target.value)}
                    />
                    <span>Skapa återställningslänk</span>
                  </label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Avbryt
              </Button>
              <Button onClick={handleReset} disabled={loading}>
                {loading ? 'Skapar…' : 'Skapa'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {result.error ? (
              <div className="py-4">
                <div className="p-3 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 text-sm">
                  {result.error}
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                {method === 'temporary' && result.password && (
                  <div className="space-y-2">
                    <Label>Tillfälligt lösenord</Label>
                    <div className="flex gap-2">
                      <Input
                        value={result.password}
                        readOnly
                        className="font-mono"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(result.password)}
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Användaren måste byta lösenord vid nästa inloggning.
                    </p>
                  </div>
                )}

                {method === 'link' && result.link && (
                  <div className="space-y-2">
                    <Label>Återställningslänk</Label>
                    <div className="flex gap-2">
                      <Input
                        value={result.link}
                        readOnly
                        className="text-xs"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(result.link)}
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Länken gäller till: {new Date(result.expiresAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button onClick={onClose}>
                Stäng
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default PasswordResetDialog;




