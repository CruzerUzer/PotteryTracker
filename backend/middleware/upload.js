import multer from 'multer';
import sharp from 'sharp';
import { existsSync, unlinkSync } from 'fs';
import logger from '../utils/logger.js';
import { uploadsDir, thumbnailDir, ensureDirectoriesExist } from '../utils/paths.js';

// Configuration from environment variables
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
const imageMaxWidth = parseInt(process.env.IMAGE_MAX_WIDTH) || 2048;
const imageMaxHeight = parseInt(process.env.IMAGE_MAX_HEIGHT) || 2048;
const thumbnailWidth = parseInt(process.env.THUMBNAIL_WIDTH) || 400;
const thumbnailHeight = parseInt(process.env.THUMBNAIL_HEIGHT) || 400;
const imageQuality = parseInt(process.env.IMAGE_QUALITY) || 85;

// Ensure uploads and thumbnails directories exist
ensureDirectoriesExist();

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

// File filter - only images (including HEIC/HEIF from iOS devices)
// Mobile browsers often send generic or incorrect MIME types, so we check extension OR mimetype
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|heic|heif/;
  const allowedMimeTypes = /^image\/(jpeg|jpg|png|gif|webp|heic|heif|x-png|pjpeg)$/i;
  const extname = allowedTypes.test(file.originalname.toLowerCase());
  // Accept standard MIME types OR if extension matches and MIME type starts with "image/"
  // This handles mobile browsers that may send generic "image/" MIME types
  const mimetype = allowedMimeTypes.test(file.mimetype) || 
                   (file.mimetype && file.mimetype.startsWith('image/') && extname);

  logger.debug('File filter check', {
    filename: file.originalname,
    mimetype: file.mimetype,
    extname,
    mimetypeMatch: allowedMimeTypes.test(file.mimetype || ''),
    willAccept: extname || mimetype
  });

  // Accept if extension matches OR mimetype is valid
  // Mobile browsers often send generic MIME types, but we still check extension
  if (extname || mimetype) {
    logger.debug('File accepted by filter', { filename: file.originalname, mimetype: file.mimetype });
    return cb(null, true);
  } else {
    logger.warn('File upload rejected', {
      filename: file.originalname,
      mimetype: file.mimetype,
      reason: 'File type not allowed'
    });
    cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP, HEIC)!'));
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
    let filePath = req.file.path;
    let filename = req.file.filename;
    const fileExt = filePath.split('.').pop().toLowerCase();
    const originalExt = req.file.originalname.split('.').pop().toLowerCase();
    
    // Convert HEIC/HEIF files to JPEG (check both saved extension and original extension)
    // rotate() auto-orients based on EXIF data (fixes iPhone photo rotation)
    if (fileExt === 'heic' || fileExt === 'heif' || originalExt === 'heic' || originalExt === 'heif') {
      const jpegPath = filePath.replace(/\.(heic|heif)$/i, '.jpg');
      filename = filename.replace(/\.(heic|heif)$/i, '.jpg');
      await sharp(filePath).rotate().jpeg({ quality: imageQuality, mozjpeg: true }).toFile(jpegPath);
      unlinkSync(filePath); // Remove original HEIC file
      filePath = jpegPath;
      req.file.path = jpegPath; // Update req.file.path for later use
      req.file.filename = filename; // Update filename
      logger.info('Converted HEIC/HEIF to JPEG', { originalFilename: req.file.originalname, newFilename: filename });
    }
    
    const thumbnailPath = `${thumbnailDir}/${filename}`;

    // Get image metadata
    const metadata = await sharp(filePath).metadata();
    
    // Determine if image needs resizing
    const needsResize = metadata.width > imageMaxWidth || metadata.height > imageMaxHeight;

    if (needsResize) {
      // Resize and optimize main image (preserve original format)
      // autoOrient() reads EXIF orientation data and applies correct rotation (fixes iPhone photos)
      const sharpInstance = sharp(filePath)
        .rotate() // Auto-rotate based on EXIF orientation data
        .resize(imageMaxWidth, imageMaxHeight, {
          fit: 'inside',
          withoutEnlargement: true
        });
      
      // Apply format-specific optimizations based on file extension
      // Convert HEIC/HEIF to JPEG for better compatibility
      const ext = filePath.split('.').pop().toLowerCase();
      if (ext === 'heic' || ext === 'heif') {
        // Convert HEIC/HEIF to JPEG
        sharpInstance.jpeg({ quality: imageQuality, mozjpeg: true });
      } else if (ext === 'jpg' || ext === 'jpeg') {
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
      // Convert HEIC/HEIF to JPEG for better compatibility
      // autoOrient() reads EXIF orientation data and applies correct rotation (fixes iPhone photos)
      const ext = filePath.split('.').pop().toLowerCase();
      const sharpInstance = sharp(filePath).rotate(); // Auto-rotate based on EXIF orientation data
      
      // Apply format-specific optimizations
      if (ext === 'heic' || ext === 'heif') {
        // Convert HEIC/HEIF to JPEG (this shouldn't happen since we convert in filename, but handle it anyway)
        sharpInstance.jpeg({ quality: imageQuality, mozjpeg: true });
      } else if (ext === 'jpg' || ext === 'jpeg') {
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
    // rotate() auto-orients based on EXIF data (fixes iPhone photo rotation)
    await sharp(filePath)
      .rotate() // Auto-rotate based on EXIF orientation data
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



