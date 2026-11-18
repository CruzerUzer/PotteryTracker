import React, { useEffect, useState } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { Sheet, SheetContent } from '../ui/sheet';
import { useToast } from '../ui/toast';
import { useConfirm } from '../ui/confirm-dialog';
import { studyAPI } from '../../services/api';

const numbering = (series, count) => {
  const first = `S${series.number}-${series.count + 1}`;
  const last = `S${series.number}-${series.count + count}`;
  if (count === 1) return first;
  return count === 2 ? `${first} och ${last}` : `${first} till ${last}`;
};

/**
 * En serie i passet: fyll på med fler alster eller ta bort en felaktig serie.
 * Nya alster numreras vidare (S1-5, S1-6 …) och hamnar där seriens första alster är.
 */
function SeriesSheet({ series, sessionId, onOpenChange, onChange }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const open = !!series;
  const pieces = series?.piece_count ?? series?.count ?? 0;

  useEffect(() => {
    if (open) setCount(1);
  }, [open, series?.id]);

  const add = async (e) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const res = await studyAPI.addSeriesPieces(sessionId, series.id, count);
      toast.success(`${count} alster till i S${series.number}`, `Märk foten med S${series.number}.`);
      onChange(res.session);
      onOpenChange(false);
    } catch (err) {
      toast.error('Kunde inte lägga till alster', err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Ta bort serien S${series.number}?`,
      description: pieces
        ? `Serien och dess ${pieces} alster tas bort permanent, även från Kanban, med foton och anteckningar.`
        : 'Serien tas bort. Den har inga alster kvar.',
      confirmLabel: 'Ta bort',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const session = await studyAPI.deleteSeries(sessionId, series.id);
      toast.success(`Serien S${series.number} är borttagen`);
      onChange(session);
      onOpenChange(false);
    } catch (err) {
      toast.error('Kunde inte ta bort serien', err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        title={series ? `Serie S${series.number}` : 'Serie'}
        description={series ? `${series.name}${series.weight_grams ? ` ${series.weight_grams} g` : ''} · ${pieces} alster` : ''}
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => onOpenChange(false)} disabled={busy}>
              Stäng
            </button>
            <button type="submit" form="series-add-form" className="btn btn-primary" disabled={busy}>
              {busy ? 'Sparar…' : `Lägg till ${count} alster`}
            </button>
          </>
        }
      >
        {series && (
          <form id="series-add-form" className="study-form" onSubmit={add}>
            <div className="field">
              <span className="field-sublabel">Fler alster i serien</span>
              <div className="stepper">
                <button type="button" className="stepper-btn" onClick={() => setCount((c) => Math.max(1, c - 1))} aria-label="Färre">
                  <Minus size={22} />
                </button>
                <span className="stepper-value" aria-live="polite">{count}</span>
                <button type="button" className="stepper-btn" onClick={() => setCount((c) => Math.min(40, c + 1))} aria-label="Fler">
                  <Plus size={22} />
                </button>
              </div>
              <span className="field-hint">Numreras {numbering(series, count)}, med samma lera och vikt.</span>
            </div>

            <button type="button" className="series-delete" onClick={remove} disabled={busy}>
              <Trash2 size={16} /> Ta bort serien
            </button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default SeriesSheet;
