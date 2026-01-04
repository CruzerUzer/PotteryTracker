import React, { useEffect } from 'react';
import { imagesAPI } from '../services/api';

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
    document.body.style.overflow = 'hidden'; // Prevent scrolling

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [currentIndex, images.length, onClose]);

  if (!currentImage) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer'
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: 'relative',
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '-40px',
            right: 0,
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '32px',
            cursor: 'pointer',
            padding: '5px 15px'
          }}
        >
          ×
        </button>
        <img
          src={imagesAPI.getFileUrl(currentImage.id)}
          alt={currentImage.original_filename || 'Piece image'}
          style={{
            maxWidth: '100%',
            maxHeight: '80vh',
            objectFit: 'contain'
          }}
        />
        <div style={{ color: 'white', marginTop: '15px', textAlign: 'center' }}>
          <div>{currentImage.phase_name || 'Unknown phase'}</div>
          <div style={{ fontSize: '0.875rem', opacity: 0.8 }}>
            {new Date(currentImage.created_at).toLocaleDateString()}
          </div>
          {onDelete && (
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this image?')) {
                  onDelete(currentImage.id);
                }
              }}
              className="btn btn-danger"
              style={{ marginTop: '10px' }}
            >
              Delete Image
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImageLightbox;






