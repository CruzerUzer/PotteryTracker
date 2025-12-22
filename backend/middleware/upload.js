import multer from 'multer';
import sharp from 'sharp';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration from environment variables
const uploadsDir = process.env.UPLOADS_DIR || join(__dirname, '..', 'uploads');
const thumbnailDir = join(uploadsDir, 'thumbnails');
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
const imageMaxWidth = parseInt(process.env.IMAGE_MAX_WIDTH) || 2048;
const imageMaxHeight = parseInt(process.env.IMAGE_MAX_HEIGHT) || 2048;
const thumbnailWidth = parseInt(process.env.THUMBNAIL_WIDTH) || 400;
const thumbnailHeight = parseInt(process.env.THUMBNAIL_HEIGHT) || 400;
const imageQuality = parseInt(process.env.IMAGE_QUALITY) || 85;

// Ensure uploads and thumbnails directories exist
if (!existsSync(uploadsDir)) {
  mkdirSync(uploadsDir, { recursive: true });
}
if (!existsSync(thumbnailDir)) {
  mkdirSync(thumbnailDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = file.originalname.split('.').pop().toLowerCase();
    cb(null, `${uniqueSuffix}.${ext}`);
  }
});

// File filter - only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(file.originalname.toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: maxFileSize
  },
  fileFilter: fileFilter
});

// Image optimization middleware
export const optimizeImage = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    const filePath = req.file.path;
    const filename = req.file.filename;
    const thumbnailPath = resolve(thumbnailDir, filename);

    // Get image metadata
    const metadata = await sharp(filePath).metadata();
    
    // Determine if image needs resizing
    const needsResize = metadata.width > imageMaxWidth || metadata.height > imageMaxHeight;

    if (needsResize) {
      // Resize and optimize main image (preserve original format)
      const sharpInstance = sharp(filePath)
        .resize(imageMaxWidth, imageMaxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      
      // Apply format-specific optimizations based on file extension
      const ext = filePath.split('.').pop().toLowerCase();
      if (ext === 'jpg' || ext === 'jpeg') {
        sharpInstance.jpeg({ quality: imageQuality, mozjpeg: true });
      } else if (ext === 'png') {
        sharpInstance.png({ quality: Math.round(imageQuality / 100 * 9), compressionLevel: 9 });
      } else if (ext === 'webp') {
        sharpInstance.webp({ quality: imageQuality });
      }
      
      await sharpInstance.toFile(filePath + '.tmp');

      // Replace original with optimized version
      unlinkSync(filePath);
      const fs = await import('fs/promises');
      await fs.rename(filePath + '.tmp', filePath);
      
      logger.info('Image optimized', {
        originalSize: metadata.width + 'x' + metadata.height,
        filename: filename
      });
    } else {
      // Still optimize compression without resizing (preserve original format)
      const ext = filePath.split('.').pop().toLowerCase();
      const sharpInstance = sharp(filePath);
      
      // Apply format-specific optimizations
      if (ext === 'jpg' || ext === 'jpeg') {
        sharpInstance.jpeg({ quality: imageQuality, mozjpeg: true });
      } else if (ext === 'png') {
        sharpInstance.png({ quality: Math.round(imageQuality / 100 * 9), compressionLevel: 9 });
      } else if (ext === 'webp') {
        sharpInstance.webp({ quality: imageQuality });
      }
      
      await sharpInstance.toFile(filePath + '.tmp');

      unlinkSync(filePath);
      const fs = await import('fs/promises');
      await fs.rename(filePath + '.tmp', filePath);
      
      logger.debug('Image compressed', { filename: filename });
    }

    // Generate thumbnail (always as JPEG for consistency)
    await sharp(filePath)
      .resize(thumbnailWidth, thumbnailHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(thumbnailPath.replace(/\.[^/.]+$/, '.jpg'));
    
    // Update thumbnail filename to reflect JPEG extension
    const thumbnailFilename = filename.replace(/\.[^/.]+$/, '.jpg');
    req.file.thumbnailFilename = thumbnailFilename;

    logger.debug('Thumbnail generated', { filename: filename });

    // Store thumbnail path in request for later use
    req.file.thumbnailPath = thumbnailPath;
    req.file.thumbnailFilename = filename;

    next();
  } catch (error) {
    logger.error('Image optimization failed', {
      error: error.message,
      filename: req.file?.filename,
      stack: error.stack
    });
    
    // Clean up on error
    if (req.file && existsSync(req.file.path)) {
      try {
        unlinkSync(req.file.path);
      } catch (e) {
        logger.error('Failed to cleanup file on error', { error: e.message });
      }
    }
    
    next(error);
  }
};

export default upload;



