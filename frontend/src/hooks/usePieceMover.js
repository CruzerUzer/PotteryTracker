import { useCallback, useRef } from 'react';
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
  const seq = useRef(new Map()); // senaste anrop per pjäs, så gamla svar inte skriver över nya

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
      const ticket = (seq.current.get(piece.id) || 0) + 1;
      seq.current.set(piece.id, ticket);
      const isLatest = () => seq.current.get(piece.id) === ticket;

      const [phaseRes, locationRes] = await Promise.allSettled([
        phaseId !== undefined ? piecesAPI.updatePhase(piece.id, phaseId) : Promise.resolve(null),
        locationId !== undefined ? piecesAPI.updateLocation(piece.id, locationId || null) : Promise.resolve(null),
      ]);

      // Rulla bara tillbaka det fält som misslyckades, och bara om inget nyare anrop gjorts
      const failed = [phaseRes, locationRes].find((r) => r.status === 'rejected');
      if (isLatest()) {
        const rollback = {};
        if (phaseRes.status === 'rejected') {
          rollback.current_phase_id = before.current_phase_id;
          rollback.phase_name = before.phase_name;
          rollback.done = before.done;
        } else if (phaseRes.value && typeof phaseRes.value.done !== 'undefined') {
          rollback.done = phaseRes.value.done ? 1 : 0;
        }
        if (locationRes.status === 'rejected') {
          rollback.current_location_id = before.current_location_id;
          rollback.location_name = before.location_name;
        }
        if (Object.keys(rollback).length) onPatch(piece.id, rollback);
      }

      if (failed) {
        toast.error('Kunde inte flytta pjäsen', failed.reason?.message);
        return;
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
    },
    [phases, locations, onPatch, toast]
  );

  return move;
}

export default usePieceMover;
