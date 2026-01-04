import React, { useEffect } from 'react';
import { imagesAPI } from '../services/api';
import { Button } from './ui/button';
import { X, Trash2 } from 'lucide-react';

function ImageLightbox({ images, currentIndex, onClose, onDelete }) {
  const currentImage = images[currentIndex];

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        // Could add navigation here
      } else if (e.key === 'ArrowRight' && currentIndex < images.length - 1) {
        // Could add navigation here
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [currentIndex, images.length, onClose]);

  if (!currentImage) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-95 z-[9999] flex items-center justify-center cursor-pointer"
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          onClick={onClose}
          variant="ghost"
          size="icon"
          className="absolute -top-10 right-0 text-white hover:bg-white/20"
        >
          <X className="h-6 w-6" />
        </Button>
        <img
          src={imagesAPI.getFileUrl(currentImage.id)}
          alt={currentImage.original_filename || 'Piece image'}
          className="max-w-full max-h-[80vh] object-contain"
        />
        <div className="text-white mt-4 text-center">
          <div className="font-medium">{currentImage.phase_name || 'Unknown phase'}</div>
          <div className="text-sm opacity-80 mt-1">
            {new Date(currentImage.created_at).toLocaleDateString()}
          </div>
          {onDelete && (
            <Button
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this image?')) {
                  onDelete(currentImage.id);
                }
              }}
              variant="destructive"
              className="mt-4"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Image
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImageLightbox;
