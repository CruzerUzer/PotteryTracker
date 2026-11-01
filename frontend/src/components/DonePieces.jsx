import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { piecesAPI } from '../services/api';
import { Button } from './ui/button';
import { PieceLinkTile } from './kanban/PieceCard';
import EmptyState from './EmptyState';

/** Färdiga pjäser som ett galleri. */
function DonePieces() {
  const [pieces, setPieces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    piecesAPI
      .getAll()
      .then((data) => alive && setPieces(data.filter((piece) => piece.done === 1)))
      .catch((err) => alive && setError(err.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="skeleton h-8 w-48" />
        <div className="tile-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton tile-skeleton" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="done-view">
      <div className="actions-row">
        <div>
          <h2 className="page-title">Färdiga pjäser</h2>
          <p className="page-subtitle">
            {pieces.length === 0 ? 'Samlingen väntar' : `${pieces.length} ${pieces.length === 1 ? 'pjäs' : 'pjäser'} i samlingen`}
          </p>
        </div>
        <Button asChild className="hide-below-lg">
          <Link to="/pieces/new">
            <Plus className="mr-2 h-4 w-4" />
            Ny pjäs
          </Link>
        </Button>
      </div>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      {pieces.length === 0 ? (
        <EmptyState
          title="Inga färdiga pjäser ännu"
          text="När en pjäs når sista fasen hamnar den här. Din samling växer med varje bränning."
          actionLabel="Till Kanban"
          actionTo="/"
          plus={false}
        />
      ) : (
        <div className="tile-grid tile-grid--gallery">
          {pieces.map((piece) => (
            <PieceLinkTile key={piece.id} piece={piece} showDone={false} showPhase={false} />
          ))}
        </div>
      )}
    </div>
  );
}

export default DonePieces;
