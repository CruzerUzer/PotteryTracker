import PDFDocument from 'pdfkit';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { existsSync, readFileSync } from 'fs';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Generate a PDF report for a user's pottery pieces
 * @param {number} userId - The user ID
 * @param {object} db - Database connection
 * @param {string} uploadsDir - Uploads directory path
 * @returns {Promise<Buffer>} - PDF buffer
 */
export async function generatePdfReport(userId, db, uploadsDir) {
  // Get user info first
  const user = await db.get('SELECT username, created_at FROM users WHERE id = ?', [userId]);
  if (!user) {
    throw new Error('User not found');
  }

  // Get all data first
  const pieces = await db.all(`
    SELECT 
      p.id,
      p.name,
      p.description,
      p.done,
      p.created_at,
      p.updated_at,
      ph.name as phase_name,
      ph.display_order as phase_order
    FROM ceramic_pieces p
    LEFT JOIN phases ph ON p.current_phase_id = ph.id AND ph.user_id = p.user_id
    WHERE p.user_id = ?
    ORDER BY p.created_at DESC
  `, [userId]);

  const pieceMaterials = await db.all(`
    SELECT 
      pm.piece_id,
      m.name as material_name,
      m.type as material_type
    FROM piece_materials pm
    INNER JOIN materials m ON pm.material_id = m.id AND m.user_id = ?
    WHERE pm.piece_id IN (SELECT id FROM ceramic_pieces WHERE user_id = ?)
    ORDER BY pm.piece_id, m.type, m.name
  `, [userId, userId]);

  const pieceImages = await db.all(`
    SELECT 
      pi.piece_id,
      pi.filename,
      pi.original_filename,
      pi.created_at,
      ph.name as phase_name
    FROM piece_images pi
    INNER JOIN phases ph ON pi.phase_id = ph.id AND ph.user_id = ?
    WHERE pi.piece_id IN (SELECT id FROM ceramic_pieces WHERE user_id = ?)
    ORDER BY pi.piece_id, pi.created_at
  `, [userId, userId]);

  const stats = await db.get(`
    SELECT 
      COUNT(*) as total_pieces,
      SUM(CASE WHEN done = 1 THEN 1 ELSE 0 END) as done_pieces,
      SUM(CASE WHEN done = 0 THEN 1 ELSE 0 END) as in_progress_pieces,
      COUNT(DISTINCT pi.id) as total_images
    FROM ceramic_pieces p
    LEFT JOIN piece_images pi ON p.id = pi.piece_id
    WHERE p.user_id = ?
  `, [userId]);

  // Group materials and images by piece_id
  const materialsByPiece = {};
  pieceMaterials.forEach(pm => {
    if (!materialsByPiece[pm.piece_id]) {
      materialsByPiece[pm.piece_id] = [];
    }
    materialsByPiece[pm.piece_id].push(pm);
  });

  const imagesByPiece = {};
  pieceImages.forEach(pi => {
    if (!imagesByPiece[pi.piece_id]) {
      imagesByPiece[pi.piece_id] = [];
    }
    imagesByPiece[pi.piece_id].push(pi);
  });

  // Now create PDF document
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];
      let hasError = false;
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        if (!hasError) {
          const buffer = Buffer.concat(chunks);
          if (buffer.length === 0) {
            reject(new Error('PDF generation produced empty buffer'));
            return;
          }
          // Validate PDF header
          if (buffer.slice(0, 4).toString() !== '%PDF') {
            reject(new Error('PDF buffer does not have valid PDF header'));
            return;
          }
          resolve(buffer);
        }
      });
      doc.on('error', (error) => {
        hasError = true;
        logger.error('PDFKit error during generation', { error: error.message, userId });
        reject(error);
      });

      // Title page
      doc.fontSize(24).text('PotteryTracker Report', { align: 'center' });
      doc.moveDown(2);
      doc.fontSize(16).text(`User: ${user.username}`, { align: 'center' });
      doc.fontSize(12).text(`Export Date: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Account Created: ${new Date(user.created_at).toLocaleDateString()}`, { align: 'center' });
      doc.addPage();

      // Statistics section
      doc.fontSize(18).text('Statistics', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text(`Total Pieces: ${stats.total_pieces || 0}`);
      doc.text(`Completed: ${stats.done_pieces || 0}`);
      doc.text(`In Progress: ${stats.in_progress_pieces || 0}`);
      doc.text(`Total Images: ${stats.total_images || 0}`);
      doc.addPage();

      // Pieces section
      doc.fontSize(18).text('Pieces', { underline: true });
      doc.moveDown();

      for (const piece of pieces) {
        // Check if we need a new page
        if (doc.y > 700) {
          doc.addPage();
        }

        doc.fontSize(14).fillColor('black').text(piece.name, { underline: true });
        doc.moveDown(0.3);
        
        if (piece.description) {
          doc.fontSize(10).fillColor('black').text(`Description: ${piece.description}`);
        }
        
        doc.fontSize(10);
        doc.text(`Status: ${piece.done ? 'Completed' : 'In Progress'}`);
        if (piece.phase_name) {
          doc.text(`Phase: ${piece.phase_name}`);
        }
        
        // Materials
        if (materialsByPiece[piece.id] && materialsByPiece[piece.id].length > 0) {
          const materials = materialsByPiece[piece.id];
          const materialsText = materials.map(m => `${m.material_name} (${m.material_type})`).join(', ');
          doc.text(`Materials: ${materialsText}`);
        }
        
        doc.text(`Created: ${new Date(piece.created_at).toLocaleDateString()}`);
        doc.text(`Last Updated: ${new Date(piece.updated_at).toLocaleDateString()}`);
        
        // Images
        if (imagesByPiece[piece.id] && imagesByPiece[piece.id].length > 0) {
          doc.moveDown(0.3);
          doc.fontSize(10).text('Images:', { underline: true });
          
          const thumbnailDir = resolve(uploadsDir, 'thumbnails');
          let imageY = doc.y;
          
          for (const img of imagesByPiece[piece.id]) {
            const thumbnailPath = resolve(thumbnailDir, img.filename.replace(/\.[^/.]+$/, '.jpg'));
            
            if (existsSync(thumbnailPath)) {
              try {
                // Check if we need a new page for image
                if (imageY > 650) {
                  doc.addPage();
                  imageY = doc.y;
                }
                
                doc.text(`  - ${img.original_filename || img.filename} (${img.phase_name})`, { indent: 10 });
                
                const imageData = readFileSync(thumbnailPath);
                const imageWidth = 150;
                const imageHeight = 150;
                
                // Check if image fits on current page
                if (imageY + imageHeight > 750) {
                  doc.addPage();
                  imageY = doc.y;
                }
                
                doc.image(imageData, doc.x + 20, imageY, {
                  width: imageWidth,
                  height: imageHeight,
                  fit: [imageWidth, imageHeight]
                });
                
                imageY += imageHeight + 10;
                doc.y = imageY;
              } catch (error) {
                logger.error('Error adding image to PDF', { error: error.message, filename: img.filename });
                doc.text(`  - ${img.original_filename || img.filename} (image unavailable)`, { indent: 10 });
              }
            } else {
              doc.text(`  - ${img.original_filename || img.filename} (thumbnail not found)`, { indent: 10 });
            }
          }
        }
        
      doc.moveDown(1);
        doc.addPage();
      }

      // Ensure PDF is properly finalized
      if (pieces.length === 0) {
        doc.fontSize(12).text('No pieces found.', { align: 'center' });
      }
      
      // Finalize PDF - this triggers the 'end' event
      doc.end();
      
      // Note: logger.debug call removed - it was after doc.end() which is async
      // The 'end' event handler will resolve the promise with the PDF buffer
    } catch (error) {
      reject(error);
    }
  });
}

