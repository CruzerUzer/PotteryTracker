import { useCallback } from 'react';
import { piecesAPI } from '../services/api';
import { useToast } from '../components/ui/toast';

/**
 * Flyttar en pjäs till ny fas och/eller plats, optimistiskt och med ångra.
 *
 *   const move = usePieceMover({ phases, locations, onPatch: (id, patch) => … });
 *   await move(piece, { phaseId: 3 });
 *
 * onPatch får lokala fält (current_phase_id, current_location_id, done,
 * phase_name, location_name) så vyn kan uppdatera sig utan omladdning.
 */
export function usePieceMover({ phases, locations, onPatch }) {
  const toast = useToast();

  const move = useCallback(
    async (piece, { phaseId, locationId }, { silent = false } = {}) => {
      const before = {
        current_phase_id: piece.current_phase_id,
        current_location_id: piece.current_location_id ?? null,
        phase_name: piece.phase_name,
        location_name: piece.location_name,
        done: piece.done,
      };
      const patch = {};
      if (phaseId !== undefined) {
        patch.current_phase_id = phaseId;
        patch.phase_name = phases.find((p) => p.id === phaseId)?.name || null;
      }
      if (locationId !== undefined) {
        patch.current_location_id = locationId;
        patch.location_name = locations.find((l) => l.id === locationId)?.name || null;
      }
      onPatch(piece.id, patch);

      try {
        const phaseCall = phaseId !== undefined ? piecesAPI.updatePhase(piece.id, phaseId) : null;
        const locationCall = locationId !== undefined ? piecesAPI.updateLocation(piece.id, locationId || null) : null;
        const [phaseResult] = await Promise.all([phaseCall, locationCall]);
        if (phaseResult && typeof phaseResult.done !== 'undefined') {
          onPatch(piece.id, { done: phaseResult.done ? 1 : 0 });
        }

        if (!silent) {
          const target = phaseId !== undefined ? patch.phase_name : patch.location_name || 'Ingen plats';
          const undo = {};
          if (phaseId !== undefined && before.current_phase_id) undo.phaseId = before.current_phase_id;
          if (locationId !== undefined) undo.locationId = before.current_location_id;
          toast.success(`${piece.name} flyttad`, target ? `Till ${target}` : undefined, {
            action: Object.keys(undo).length
              ? { label: 'Ångra', onClick: () => move({ ...piece, ...patch }, undo, { silent: true }) }
              : undefined,
          });
        }
      } catch (err) {
        onPatch(piece.id, before);
        toast.error('Kunde inte flytta pjäsen', err.message);
      }
    },
    [phases, locations, onPatch, toast]
  );

  return move;
}

export default usePieceMover;
