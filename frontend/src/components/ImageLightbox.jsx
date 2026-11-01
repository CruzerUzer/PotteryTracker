import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { imagesAPI } from '../services/api';
import { Button } from './ui/button';
import { X, Trash2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useConfirm } from './ui/confirm-dialog';

function ImageLightbox({
  images,
  currentIndex,
  onClose,
  onDelete,
  onNavigate,
  pieceName,
  showDelete = true
}) {
  const [internalIndex, setInternalIndex] = useState(currentIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const confirm = useConfirm();
  const swipe = useRef(null);
  const [dragX, setDragX] = useState(0);

  // Use internal state for navigation if no external handler
  const actualIndex = onNavigate ? currentIndex : internalIndex;
  const currentImage = images[actualIndex];

  const navigate = useCallback((newIndex) => {
    if (newIndex >= 0 && newIndex < images.length) {
      if (onNavigate) {
        onNavigate(newIndex);
      } else {
        setInternalIndex(newIndex);
      }
    }
  }, [images.length, onNavigate]);

  const handlePrev = useCallback((e) => {
    e?.stopPropagation();
    navigate(actualIndex - 1);
  }, [actualIndex, navigate]);

  const handleNext = useCallback((e) => {
    e?.stopPropagation();
    navigate(actualIndex + 1);
  }, [actualIndex, navigate]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Låt en öppen bekräftelsedialog ta tangenterna
      if (document.querySelector('[role="alertdialog"][data-state="open"]')) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && actualIndex > 0) {
        handlePrev();
      } else if (e.key === 'ArrowRight' && actualIndex < images.length - 1) {
        handleNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [actualIndex, images.length, onClose, handlePrev, handleNext]);

  // Sync internal index with prop when it changes externally
  useEffect(() => {
    setInternalIndex(currentIndex);
  }, [currentIndex]);

  // Swipe: i sidled byter bild, nedåt stänger. Av när bilden är inzoomad.
  const onTouchStart = (e) => {
    if (isZoomed || e.touches.length !== 1) {
      swipe.current = null;
      return;
    }
    swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, multi: false };
  };
  const onTouchMove = (e) => {
    if (!swipe.current) return;
    if (e.touches.length > 1 || isZoomed) {
      swipe.current = null;
      setDragX(0);
      return;
    }
    const dx = e.touches[0].clientX - swipe.current.x;
    const dy = e.touches[0].clientY - swipe.current.y;
    if (Math.abs(dx) > Math.abs(dy)) setDragX(dx);
  };
  const onTouchEnd = (e) => {
    const start = swipe.current;
    swipe.current = null;
    setDragX(0);
    if (!start || isZoomed) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx < 0 && actualIndex < images.length - 1) navigate(actualIndex + 1);
      else if (dx > 0 && actualIndex > 0) navigate(actualIndex - 1);
    } else if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.5) {
      onClose();
    }
  };

  if (!currentImage) return null;

  const hasPrev = actualIndex > 0;
  const hasNext = actualIndex < images.length - 1;

  return createPortal(
    <div
      className="lightbox fixed inset-0 bg-black bg-opacity-95 z-[9999] flex items-center justify-center"
      onClick={onClose}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-label={pieceName ? `Bilder: ${pieceName}` : 'Bildvisning'}
    >
      {/* Close button */}
      <Button
        onClick={onClose}
        variant="ghost"
        size="icon"
        className="lightbox-close absolute right-4 text-white hover:bg-white/20 z-10"
        aria-label="Stäng"
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Previous button */}
      {hasPrev && (
        <Button
          onClick={handlePrev}
          variant="ghost"
          size="icon"
          className="lightbox-nav absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10 h-12 w-12"
          aria-label="Föregående bild"
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}

      {/* Next button */}
      {hasNext && (
        <Button
          onClick={handleNext}
          variant="ghost"
          size="icon"
          className="lightbox-nav absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10 h-12 w-12"
          aria-label="Nästa bild"
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}

      {/* Main content */}
      <div
        className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Zoom wrapper */}
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={4}
          centerOnInit={true}
          doubleClick={{ mode: 'toggle', step: 2 }}
          wheel={{ step: 2, smoothStep: 0.01 }}
          onTransformed={(ref, state) => {
            setIsZoomed(state.scale > 1.1);
          }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <TransformComponent
                wrapperStyle={{
                  maxWidth: '90vw',
                  maxHeight: '70vh',
                }}
                contentStyle={{
                  cursor: isZoomed ? 'grab' : 'zoom-in',
                }}
              >
                <img
                  key={currentImage.id}
                  style={{
                    transform: dragX ? `translateX(${dragX * 0.6}px)` : undefined,
                    transition: dragX ? 'none' : 'transform 200ms ease-out',
                  }}
                  src={imagesAPI.getFileUrl(currentImage.id)}
                  alt={currentImage.original_filename || 'Bild på pjäs'}
                  className="max-w-full max-h-[70vh] object-contain select-none"
                  draggable={false}
                />
              </TransformComponent>

              {/* Zoom controls */}
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={() => zoomIn()}
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  title="Zooma in"
                >
                  <ZoomIn className="h-5 w-5" />
                </Button>
                <Button
                  onClick={() => zoomOut()}
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  title="Zooma ut"
                >
                  <ZoomOut className="h-5 w-5" />
                </Button>
                <Button
                  onClick={() => resetTransform()}
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  title="Återställ zoom"
                >
                  <RotateCcw className="h-5 w-5" />
                </Button>
              </div>
            </>
          )}
        </TransformWrapper>

        {/* Metadata */}
        <div className="text-white mt-4 text-center">
          {pieceName && (
            <div className="font-semibold text-lg">{pieceName}</div>
          )}
          <div className="font-medium text-sm opacity-90">
            {currentImage.phase_name || 'Okänd fas'}
          </div>
          <div className="text-sm opacity-70 mt-1">
            {new Date(currentImage.created_at).toLocaleDateString()}
          </div>

          {/* Image counter */}
          {images.length > 1 && (
            <div className="text-sm opacity-60 mt-2">
              {actualIndex + 1} / {images.length}
            </div>
          )}

          {/* Delete button */}
          {showDelete && onDelete && (
            <Button
              onClick={async () => {
                const ok = await confirm({
                  title: 'Ta bort bilden?',
                  description: 'Bilden raderas permanent.',
                  confirmLabel: 'Ta bort',
                  destructive: true,
                });
                if (ok) onDelete(currentImage.id);
              }}
              variant="ghost"
              size="icon"
              className="mt-4 text-white hover:bg-white/20"
              title="Ta bort bild"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ImageLightbox;
