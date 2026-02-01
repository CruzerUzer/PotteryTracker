import React, { useState, useEffect, useCallback } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { imagesAPI } from '../services/api';
import { Button } from './ui/button';
import { X, Trash2, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

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

  if (!currentImage) return null;

  const hasPrev = actualIndex > 0;
  const hasNext = actualIndex < images.length - 1;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-95 z-[9999] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <Button
        onClick={onClose}
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Previous button */}
      {hasPrev && (
        <Button
          onClick={handlePrev}
          variant="ghost"
          size="icon"
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10 h-12 w-12"
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
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 z-10 h-12 w-12"
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
                  src={imagesAPI.getFileUrl(currentImage.id)}
                  alt={currentImage.original_filename || 'Piece image'}
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
                  title="Zoom in"
                >
                  <ZoomIn className="h-5 w-5" />
                </Button>
                <Button
                  onClick={() => zoomOut()}
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  title="Zoom out"
                >
                  <ZoomOut className="h-5 w-5" />
                </Button>
                <Button
                  onClick={() => resetTransform()}
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  title="Reset zoom"
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
            {currentImage.phase_name || 'Unknown phase'}
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
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this image?')) {
                  onDelete(currentImage.id);
                }
              }}
              variant="ghost"
              size="icon"
              className="mt-4 text-white hover:bg-white/20"
              title="Delete image"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImageLightbox;
