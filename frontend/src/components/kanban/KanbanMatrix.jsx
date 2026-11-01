import React, { useRef, useState } from 'react';
import { ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import { MatrixCard } from './PieceCard';
import { phaseColor } from './phaseColors';

function useStoredSet(key) {
  const [set, setSet] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const toggle = (value) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      try {
        localStorage.setItem(key, JSON.stringify([...next]));
      } catch {
        /* ignorera */
      }
      return next;
    });
  };
  return [set, toggle];
}

/**
 * Desktop-Kanban: matris plats × fas med drag-and-drop.
 * Sidan scrollar vertikalt; rubrikraden fäster under headern och
 * följer matrisen i sidled om den är bredare än skärmen.
 */
function KanbanMatrix({ phases, locations, pieces, onMove, onOpenImages }) {
  const [collapsedLanes, toggleLane] = useStoredSet('kanban-collapsed-lanes');
  const [collapsedColumns, toggleColumn] = useStoredSet('kanban-collapsed-columns');
  const [dragged, setDragged] = useState(null);
  const [overCell, setOverCell] = useState(null);
  const headRef = useRef(null);

  const syncScroll = (e) => {
    if (headRef.current) headRef.current.scrollLeft = e.currentTarget.scrollLeft;
  };

  const colStyle = (phaseId) =>
    collapsedColumns.has(phaseId) ? { flex: '0 0 40px' } : { flex: '1 1 0', minWidth: 168 };

  const onDragStart = (e, piece) => {
    setDragged(piece);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(piece.id));
  };
  const onDragEnd = () => {
    setDragged(null);
    setOverCell(null);
  };
  const onDrop = async (e, phaseId, locationId) => {
    e.preventDefault();
    const piece = dragged;
    setOverCell(null);
    setDragged(null);
    if (!piece) return;
    const patch = {};
    if (piece.current_phase_id !== phaseId) patch.phaseId = phaseId;
    if ((piece.current_location_id ?? null) !== locationId) patch.locationId = locationId;
    if (Object.keys(patch).length) await onMove(piece, patch);
  };

  const lanes = [...locations.map((l) => ({ id: l.id, name: l.name })), { id: null, name: 'Ingen plats' }];

  return (
    <div className="kanban-matrix">
      <div className="matrix-head" ref={headRef} aria-hidden="false">
        <div className="matrix-row">
          {phases.map((phase, i) => {
            const c = phaseColor(i);
            const collapsed = collapsedColumns.has(phase.id);
            const count = pieces.filter((p) => p.current_phase_id === phase.id).length;
            return (
              <div key={phase.id} style={colStyle(phase.id)}>
                <button
                  type="button"
                  className="matrix-phase"
                  style={{ background: c.bg, borderColor: c.border, color: c.accent }}
                  onClick={() => toggleColumn(phase.id)}
                  title={collapsed ? `Visa ${phase.name}` : `Fäll ihop ${phase.name}`}
                  aria-expanded={!collapsed}
                >
                  {collapsed ? (
                    <ChevronRight size={16} className="mx-auto" />
                  ) : (
                    <>
                      <span className="matrix-phase-name">{phase.name}</span>
                      <span className="matrix-phase-count">{count}</span>
                      <ChevronDown size={13} className="opacity-70" />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="matrix-body" onScroll={syncScroll}>
        {lanes.map((lane) => {
          const laneKey = lane.id === null ? 'no-location' : lane.id;
          const collapsed = collapsedLanes.has(laneKey);
          const laneCount = pieces.filter((p) => (p.current_location_id ?? null) === lane.id).length;
          return (
            <div key={laneKey} className="matrix-lane">
              <button
                type="button"
                className="matrix-lane-head"
                onClick={() => toggleLane(laneKey)}
                aria-expanded={!collapsed}
              >
                {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                <MapPin size={15} />
                <span className="matrix-lane-name">{lane.name}</span>
                <span className="kanban-count">{laneCount}</span>
              </button>
              {!collapsed && (
                <div className="matrix-row matrix-cells">
                  {phases.map((phase, i) => {
                    const c = phaseColor(i);
                    if (collapsedColumns.has(phase.id)) {
                      return <div key={phase.id} style={colStyle(phase.id)} />;
                    }
                    const cell = pieces.filter(
                      (p) => p.current_phase_id === phase.id && (p.current_location_id ?? null) === lane.id
                    );
                    const over = overCell === `${phase.id}-${lane.id}`;
                    return (
                      <div
                        key={phase.id}
                        style={{
                          ...colStyle(phase.id),
                          '--cell-bg': c.bg,
                          '--cell-accent': c.accent,
                        }}
                        className={`matrix-cell${over ? ' matrix-cell--over' : ''}`}
                        data-cell-id={`${phase.id}-${lane.id}`}
                        onDragOver={(e) => {
                          if (!dragged) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (overCell !== `${phase.id}-${lane.id}`) setOverCell(`${phase.id}-${lane.id}`);
                        }}
                        onDragLeave={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget)) setOverCell(null);
                        }}
                        onDrop={(e) => onDrop(e, phase.id, lane.id)}
                      >
                        {cell.map((piece) => (
                          <MatrixCard
                            key={piece.id}
                            piece={piece}
                            dragging={dragged?.id === piece.id}
                            onDragStart={onDragStart}
                            onDragEnd={onDragEnd}
                            onOpenImages={onOpenImages}
                          />
                        ))}
                        {cell.length === 0 && <div className="matrix-empty">Tom</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default KanbanMatrix;
