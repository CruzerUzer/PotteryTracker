#!/usr/bin/env node
/**
 * Kopiera all keramikdata från en användare till en annan.
 *
 * Skapar/synkar t.ex. testkontot `stitchbot` från `Adam` för screenshot-
 * harnessen och Stitch-redesignen — utan att röra källkontot.
 *
 * Användning (kör från backend/):
 *   node tools/copy-user.mjs <källanvändare> <målanvändare> [--wipe] [--yes]
 *
 * Exempel:
 *   node tools/copy-user.mjs Adam stitchbot            # kräver tomt mål
 *   node tools/copy-user.mjs Adam stitchbot --wipe     # rensa målets data först (re-sync)
 *
 * Flaggor:
 *   --wipe   Radera målanvändarens befintliga pjäser/faser/platser/material först.
 *   --yes    Hoppa över bekräftelsefrågan (för icke-interaktiv körning).
 *
 * Noter:
 *   - BildFILER på disk delas (raderna pekar på samma filnamn). Ta aldrig bort
 *     bildfiler för att "städa" ett mål — det slår mot källan också.
 *   - Appen kör med foreign_keys AV; scriptet gör detsamma och remappar alla
 *     främmande nycklar (fas/plats/material/default_image_id) till målets nya id:n.
 *   - Föräldralösa bilder (phase_id saknas hos källan) mappas till målets första fas.
 *   - Sätt DB_PATH för att peka på en annan databas än backend/database/database.db.
 */
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || join(__dirname, '..', 'database', 'database.db');

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const [sourceName, targetName] = args.filter((a) => !a.startsWith('--'));
const doWipe = flags.has('--wipe');
const skipConfirm = flags.has('--yes');

if (!sourceName || !targetName) {
  console.error('Användning: node tools/copy-user.mjs <källanvändare> <målanvändare> [--wipe] [--yes]');
  process.exit(1);
}
if (sourceName === targetName) {
  console.error('Källa och mål kan inte vara samma användare.');
  process.exit(1);
}

function confirm(question) {
  if (skipConfirm) return Promise.resolve(true);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(/^(j|y)/i.test(answer.trim()));
    });
  });
}

async function main() {
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  const source = await db.get('SELECT id, username FROM users WHERE username = ?', sourceName);
  const target = await db.get('SELECT id, username FROM users WHERE username = ?', targetName);
  if (!source) throw new Error(`Källanvändare "${sourceName}" hittades inte.`);
  if (!target) throw new Error(`Målanvändare "${targetName}" hittades inte. Skapa kontot först (via registrering).`);

  const targetPieces = await db.get(
    'SELECT COUNT(*) AS n FROM ceramic_pieces WHERE user_id = ?', target.id
  );
  if (targetPieces.n > 0 && !doWipe) {
    throw new Error(
      `Målanvändaren "${targetName}" har redan ${targetPieces.n} pjäser. ` +
      'Kör med --wipe för att rensa och synka om, eller välj ett tomt konto.'
    );
  }

  console.log(`Kopierar från "${source.username}" (id ${source.id}) → "${target.username}" (id ${target.id})`);
  if (doWipe && targetPieces.n > 0) {
    const ok = await confirm(
      `Detta RADERAR målets ${targetPieces.n} pjäser + faser/platser/material innan kopiering. Fortsätt? (j/N) `
    );
    if (!ok) { console.log('Avbrutet.'); await db.close(); return; }
  }

  await db.exec('BEGIN');
  try {
    if (doWipe) {
      // ceramic_pieces-radering tar bort piece_images/piece_materials via app-logik,
      // men FK är av här — radera junction/bild-rader explicit i beroendeordning.
      await db.run(
        `DELETE FROM piece_materials WHERE piece_id IN
           (SELECT id FROM ceramic_pieces WHERE user_id = ?)`, target.id);
      await db.run(
        `DELETE FROM piece_images WHERE piece_id IN
           (SELECT id FROM ceramic_pieces WHERE user_id = ?)`, target.id);
      await db.run('DELETE FROM ceramic_pieces WHERE user_id = ?', target.id);
      await db.run('DELETE FROM materials WHERE user_id = ?', target.id);
      await db.run('DELETE FROM locations WHERE user_id = ?', target.id);
      await db.run('DELETE FROM phases WHERE user_id = ?', target.id);
    }

    // 1. Faser
    const phaseMap = new Map();
    const phases = await db.all(
      'SELECT * FROM phases WHERE user_id = ? ORDER BY id', source.id);
    for (const p of phases) {
      const r = await db.run(
        'INSERT INTO phases (user_id, name, display_order, created_at) VALUES (?,?,?,?)',
        target.id, p.name, p.display_order, p.created_at);
      phaseMap.set(p.id, r.lastID);
    }
    const firstPhaseId = phases.length ? phaseMap.get(phases[0].id) : null;

    // 2. Platser
    const locationMap = new Map();
    const locations = await db.all(
      'SELECT * FROM locations WHERE user_id = ? ORDER BY id', source.id);
    for (const l of locations) {
      const r = await db.run(
        'INSERT INTO locations (user_id, name, display_order, created_at) VALUES (?,?,?,?)',
        target.id, l.name, l.display_order, l.created_at);
      locationMap.set(l.id, r.lastID);
    }

    // 3. Material
    const materialMap = new Map();
    const materials = await db.all(
      'SELECT * FROM materials WHERE user_id = ? ORDER BY id', source.id);
    for (const m of materials) {
      const r = await db.run(
        'INSERT INTO materials (user_id, name, type, description, created_at) VALUES (?,?,?,?,?)',
        target.id, m.name, m.type, m.description, m.created_at);
      materialMap.set(m.id, r.lastID);
    }

    // 4. Pjäser (default_image_id sätts i steg 6 när bilderna finns)
    const pieceMap = new Map();
    const pieces = await db.all(
      'SELECT * FROM ceramic_pieces WHERE user_id = ? ORDER BY id', source.id);
    for (const p of pieces) {
      const r = await db.run(
        `INSERT INTO ceramic_pieces
           (user_id, name, description, current_phase_id, current_location_id,
            default_image_id, done, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        target.id, p.name, p.description,
        p.current_phase_id != null ? (phaseMap.get(p.current_phase_id) ?? firstPhaseId) : null,
        p.current_location_id != null ? (locationMap.get(p.current_location_id) ?? null) : null,
        null, p.done, p.created_at, p.updated_at);
      pieceMap.set(p.id, r.lastID);
    }

    // 5. Bilder (föräldralös phase_id → målets första fas)
    const imageMap = new Map();
    const images = await db.all(
      `SELECT * FROM piece_images WHERE piece_id IN
         (SELECT id FROM ceramic_pieces WHERE user_id = ?) ORDER BY id`, source.id);
    let orphanImages = 0;
    for (const img of images) {
      const newPieceId = pieceMap.get(img.piece_id);
      if (!newPieceId) continue; // bild utan känd pjäs — hoppa
      let newPhaseId = phaseMap.get(img.phase_id);
      if (!newPhaseId) { newPhaseId = firstPhaseId; orphanImages++; }
      const r = await db.run(
        `INSERT INTO piece_images (piece_id, phase_id, filename, original_filename, created_at)
         VALUES (?,?,?,?,?)`,
        newPieceId, newPhaseId, img.filename, img.original_filename, img.created_at);
      imageMap.set(img.id, r.lastID);
    }

    // 6. Fixa default_image_id nu när bild-id:n finns
    let defaultsFixed = 0;
    for (const p of pieces) {
      if (p.default_image_id == null) continue;
      const newImgId = imageMap.get(p.default_image_id);
      if (newImgId) {
        await db.run('UPDATE ceramic_pieces SET default_image_id = ? WHERE id = ?',
          newImgId, pieceMap.get(p.id));
        defaultsFixed++;
      }
    }

    // 7. Pjäs↔material-kopplingar
    let links = 0;
    const pieceMaterials = await db.all(
      `SELECT * FROM piece_materials WHERE piece_id IN
         (SELECT id FROM ceramic_pieces WHERE user_id = ?)`, source.id);
    for (const pm of pieceMaterials) {
      const newPieceId = pieceMap.get(pm.piece_id);
      const newMaterialId = materialMap.get(pm.material_id);
      if (!newPieceId || !newMaterialId) continue;
      await db.run(
        'INSERT OR IGNORE INTO piece_materials (piece_id, material_id) VALUES (?,?)',
        newPieceId, newMaterialId);
      links++;
    }

    await db.exec('COMMIT');
    console.log('Klart. Kopierat:');
    console.log(`  faser: ${phaseMap.size}`);
    console.log(`  platser: ${locationMap.size}`);
    console.log(`  material: ${materialMap.size}`);
    console.log(`  pjäser: ${pieceMap.size}`);
    console.log(`  bilder: ${imageMap.size}${orphanImages ? ` (varav ${orphanImages} föräldralösa → första fasen)` : ''}`);
    console.log(`  default-bilder satta: ${defaultsFixed}`);
    console.log(`  material-kopplingar: ${links}`);
  } catch (err) {
    await db.exec('ROLLBACK');
    throw err;
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error('Fel:', err.message);
  process.exit(1);
});
