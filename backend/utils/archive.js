import archiver from 'archiver';
import { createReadStream, createWriteStream, existsSync, mkdirSync, copyFileSync, unlinkSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import unzipper from 'unzipper';
import { encryptData, decryptData } from './encryption.js';
import { generatePdfReport } from './pdfGenerator.js';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Create a user archive (encrypted or unencrypted)
 * @param {number} userId - The user ID
 * @param {string|null} password - Password for encryption (null/empty for unencrypted)
 * @param {object} db - Database connection
 * @param {string} uploadsDir - Uploads directory path
 * @returns {Promise<object>} - Archive metadata {filename, size, path, is_encrypted}
 */
export async function createUserArchive(userId, password, db, uploadsDir) {
  const archivesDir = process.env.ARCHIVES_DIR || resolve(__dirname, '..', 'archives');
  
  // Ensure archives directory exists
  if (!existsSync(archivesDir)) {
    mkdirSync(archivesDir, { recursive: true });
  }

  // Get user info
  const user = await db.get('SELECT username FROM users WHERE id = ?', [userId]);
  if (!user) {
    throw new Error('User not found');
  }

  const timestamp = Date.now();
  const isEncrypted = password && password.length > 0;
  const extension = isEncrypted ? '.encrypted.zip' : '.zip';
  const tempZipFilename = `user_${userId}_${timestamp}${extension}`;
  const tempZipPath = resolve(archivesDir, `temp_${tempZipFilename}`);
  const finalPath = resolve(archivesDir, tempZipFilename);

  try {
    // Get all user data first
    const pieces = await db.all('SELECT * FROM ceramic_pieces WHERE user_id = ? ORDER BY id', [userId]);
    const materials = await db.all('SELECT * FROM materials WHERE user_id = ? ORDER BY id', [userId]);
    const phases = await db.all('SELECT * FROM phases WHERE user_id = ? ORDER BY display_order, id', [userId]);
    const pieceMaterials = await db.all(`
      SELECT pm.* FROM piece_materials pm
      INNER JOIN ceramic_pieces p ON pm.piece_id = p.id
      WHERE p.user_id = ?
      ORDER BY pm.piece_id, pm.material_id
    `, [userId]);
    const pieceImages = await db.all(`
      SELECT pi.* FROM piece_images pi
      INNER JOIN ceramic_pieces p ON pi.piece_id = p.id
      WHERE p.user_id = ?
      ORDER BY pi.piece_id, pi.created_at
    `, [userId]);

    // Generate PDF report
    let pdfBuffer = null;
    try {
      pdfBuffer = await generatePdfReport(userId, db, uploadsDir);
    } catch (error) {
      logger.error('Error generating PDF report for archive', { error: error.message, userId });
      // Continue without PDF if generation fails
    }

    // Create ZIP archive
    return new Promise((resolvePromise, reject) => {
      const output = createWriteStream(tempZipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', async () => {
        try {
          let finalBuffer = readFileSync(tempZipPath);
          
          // Encrypt if password provided
          if (isEncrypted) {
            finalBuffer = encryptData(finalBuffer, password);
            writeFileSync(finalPath, finalBuffer);
            unlinkSync(tempZipPath);
          } else {
            // Just rename/move
            copyFileSync(tempZipPath, finalPath);
            unlinkSync(tempZipPath);
          }

          const stats = statSync(finalPath);
          
          resolvePromise({
            filename: tempZipFilename,
            size: stats.size,
            path: finalPath,
            is_encrypted: isEncrypted ? 1 : 0
          });
        } catch (error) {
          reject(error);
        }
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      // Add JSON files to archive
      archive.append(JSON.stringify(pieces, null, 2), { name: 'data/pieces.json' });
      archive.append(JSON.stringify(materials, null, 2), { name: 'data/materials.json' });
      archive.append(JSON.stringify(phases, null, 2), { name: 'data/phases.json' });
      archive.append(JSON.stringify(pieceMaterials, null, 2), { name: 'data/piece_materials.json' });

      // Add PDF report if generated
      if (pdfBuffer) {
        archive.append(pdfBuffer, { name: 'report.pdf' });
      }

      // Add images and thumbnails
      const thumbnailDir = resolve(uploadsDir, 'thumbnails');
      const imageFiles = new Set();
      
      pieceImages.forEach(img => {
        imageFiles.add(img.filename);
      });

      // Add images
      for (const filename of imageFiles) {
        const imagePath = resolve(uploadsDir, filename);
        const thumbnailPath = resolve(thumbnailDir, filename.replace(/\.[^/.]+$/, '.jpg'));
        
        if (existsSync(imagePath)) {
          archive.file(imagePath, { name: `images/${filename}` });
        }
        
        if (existsSync(thumbnailPath)) {
          archive.file(thumbnailPath, { name: `thumbnails/${filename.replace(/\.[^/.]+$/, '.jpg')}` });
        }
      }

      archive.finalize();
    });
  } catch (error) {
    // Cleanup on error
    if (existsSync(tempZipPath)) {
      unlinkSync(tempZipPath);
    }
    throw error;
  }
}

/**
 * Import a user archive
 * @param {string} archivePath - Path to the archive file
 * @param {string|null} password - Password for decryption (null if unencrypted)
 * @param {number} targetUserId - Target user ID to import into
 * @param {object} db - Database connection
 * @param {string} uploadsDir - Uploads directory path
 * @returns {Promise<object>} - Import statistics
 */
export async function importUserArchive(archivePath, password, targetUserId, db, uploadsDir) {
  // Check if file exists
  if (!existsSync(archivePath)) {
    throw new Error('Archive file not found');
  }

  // Read and decrypt if needed
  const fileBuffer = readFileSync(archivePath);
  const filename = archivePath.split(/[/\\]/).pop();
  const isEncrypted = filename.endsWith('.encrypted.zip');

  let zipBuffer;
  if (isEncrypted) {
    if (!password || password.length === 0) {
      throw new Error('Password required for encrypted archive');
    }
    try {
      zipBuffer = decryptData(fileBuffer, password);
    } catch (decryptError) {
      // Provide more helpful error message for decryption failures
      if (decryptError.message.includes('auth') || decryptError.message.includes('tag')) {
        throw new Error('Invalid password. The password provided is incorrect or the archive is corrupted.');
      }
      throw new Error(`Decryption failed: ${decryptError.message}`);
    }
  } else {
    zipBuffer = fileBuffer;
  }

  // Validate that decrypted data looks like a ZIP file (starts with ZIP signature)
  if (zipBuffer.length < 4 || zipBuffer[0] !== 0x50 || zipBuffer[1] !== 0x4B) {
    throw new Error('Invalid archive format. The file may be corrupted or the password is incorrect.');
  }

  // Write temporary ZIP file
  const tempZipPath = resolve(dirname(archivePath), `temp_import_${Date.now()}.zip`);
  writeFileSync(tempZipPath, zipBuffer);

  try {
    const thumbnailDir = resolve(uploadsDir, 'thumbnails');
    
    // Ensure directories exist
    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true });
    }
    if (!existsSync(thumbnailDir)) {
      mkdirSync(thumbnailDir, { recursive: true });
    }

    // Extract and process ZIP
    let directory;
    try {
      directory = await unzipper.Open.file(tempZipPath);
    } catch (unzipError) {
      // If unzipper fails, provide a helpful error message
      if (unzipError.message && unzipError.message.toLowerCase().includes('not') && unzipError.message.toLowerCase().includes('archive')) {
        throw new Error('Invalid archive format. The file may be corrupted, the password is incorrect, or the file is not a valid ZIP archive.');
      }
      throw new Error(`Failed to open archive: ${unzipError.message}`);
    }
    
    // Read JSON files
    let pieces = [];
    let materials = [];
    let phases = [];
    let pieceMaterials = [];
    
    for (const file of directory.files) {
      const content = await file.buffer();
      
      if (file.path === 'data/pieces.json') {
        pieces = JSON.parse(content.toString());
      } else if (file.path === 'data/materials.json') {
        materials = JSON.parse(content.toString());
      } else if (file.path === 'data/phases.json') {
        phases = JSON.parse(content.toString());
      } else if (file.path === 'data/piece_materials.json') {
        pieceMaterials = JSON.parse(content.toString());
      }
    }

    // Import data in order: phases, materials, pieces, relationships, images
    const phaseIdMap = {}; // old_id -> new_id
    const materialIdMap = {}; // old_id -> new_id
    const pieceIdMap = {}; // old_id -> new_id

    // Import phases - check if they already exist to avoid UNIQUE constraint errors
    for (const phase of phases) {
      // Check if phase already exists for this user
      const existingPhase = await db.get(
        'SELECT id FROM phases WHERE user_id = ? AND name = ?',
        [targetUserId, phase.name]
      );
      
      if (existingPhase) {
        // Phase already exists, use existing ID
        phaseIdMap[phase.id] = existingPhase.id;
      } else {
        // Phase doesn't exist, insert it
        const result = await db.run(
          'INSERT INTO phases (user_id, name, display_order, created_at) VALUES (?, ?, ?, ?)',
          [targetUserId, phase.name, phase.display_order, phase.created_at]
        );
        phaseIdMap[phase.id] = result.lastID;
      }
    }

    // Import materials - check if they already exist to avoid duplicates (though materials don't have UNIQUE constraint)
    for (const material of materials) {
      // Check if material already exists for this user with same name and type
      const existingMaterial = await db.get(
        'SELECT id FROM materials WHERE user_id = ? AND name = ? AND type = ?',
        [targetUserId, material.name, material.type]
      );
      
      if (existingMaterial) {
        // Material already exists, use existing ID
        materialIdMap[material.id] = existingMaterial.id;
      } else {
        // Material doesn't exist, insert it
        const result = await db.run(
          'INSERT INTO materials (user_id, name, type, created_at) VALUES (?, ?, ?, ?)',
          [targetUserId, material.name, material.type, material.created_at]
        );
        materialIdMap[material.id] = result.lastID;
      }
    }

    // Import pieces
    for (const piece of pieces) {
      const newPhaseId = piece.current_phase_id ? phaseIdMap[piece.current_phase_id] : null;
      const result = await db.run(
        'INSERT INTO ceramic_pieces (user_id, name, description, current_phase_id, done, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [targetUserId, piece.name, piece.description, newPhaseId, piece.done, piece.created_at, piece.updated_at]
      );
      pieceIdMap[piece.id] = result.lastID;
    }

    // Import piece_materials relationships
    for (const pm of pieceMaterials) {
      const newPieceId = pieceIdMap[pm.piece_id];
      const newMaterialId = materialIdMap[pm.material_id];
      if (newPieceId && newMaterialId) {
        await db.run(
          'INSERT OR IGNORE INTO piece_materials (piece_id, material_id) VALUES (?, ?)',
          [newPieceId, newMaterialId]
        );
      }
    }

    // Extract and copy images
    let imagesImported = 0;
    for (const file of directory.files) {
      if (file.path.startsWith('images/') && !file.path.endsWith('/')) {
        const filename = file.path.replace('images/', '');
        const imageBuffer = await file.buffer();
        const imagePath = resolve(uploadsDir, filename);
        
        writeFileSync(imagePath, imageBuffer);
        
        // Try to find corresponding thumbnail
        const thumbnailName = filename.replace(/\.[^/.]+$/, '.jpg');
        const thumbnailEntry = directory.files.find(f => f.path === `thumbnails/${thumbnailName}`);
        if (thumbnailEntry) {
          const thumbnailBuffer = await thumbnailEntry.buffer();
          const thumbnailPath = resolve(thumbnailDir, thumbnailName);
          writeFileSync(thumbnailPath, thumbnailBuffer);
        }
        
        imagesImported++;
      }
    }

    // Note: We don't import piece_images table data because we need to map old piece IDs
    // Images are copied but not linked to pieces. This could be enhanced later.

    // Cleanup temp file
    unlinkSync(tempZipPath);

    return {
      phases: phases.length,
      materials: materials.length,
      pieces: pieces.length,
      relationships: pieceMaterials.length,
      images: imagesImported
    };
  } catch (error) {
    // Cleanup temp file on error
    if (existsSync(tempZipPath)) {
      unlinkSync(tempZipPath);
    }
    throw error;
  }
}
