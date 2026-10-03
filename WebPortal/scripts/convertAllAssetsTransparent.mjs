/**
 * 🔄 NARVOS PRIME - BATCH TRANSPARENCY CONVERTER
 * Convertit TOUS les assets (personnages, sorts) en PNG transparent
 * EXCLUT les maps (dofus_maps)
 * 
 * Usage: node scripts/convertAllAssetsTransparent.mjs
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.join(__dirname, '../public/textures');

// Dossiers à traiter (sprites, personnages, sorts)
const FOLDERS_TO_PROCESS = [
    'personnage',
    'spells',
    'launcher/ui',
    'processed/personnage',
    'processed/spells'
];

// Dossiers à EXCLURE
const FOLDERS_TO_EXCLUDE = [
    'dofus_maps',
    'launcher/uploaded' // Images de fond
];

// Couleurs de fond à rendre transparentes
const BACKGROUND_COLORS = [
    // Gris du damier transparent
    { r: 102, g: 102, b: 102 },
    { r: 153, g: 153, b: 153 },
    { r: 128, g: 128, b: 128 },
    { r: 64, g: 64, b: 64 },
    { r: 48, g: 48, b: 48 },
    { r: 51, g: 51, b: 51 },
    // Noir/Gris foncé
    { r: 0, g: 0, b: 0 },
    { r: 32, g: 32, b: 32 },
    { r: 16, g: 16, b: 16 },
];

const COLOR_TOLERANCE = 30;

function isBackgroundColor(r, g, b) {
    // Gris pur (r ≈ g ≈ b) et sombre
    const isGray = Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && Math.abs(r - b) < 20;
    const isDark = r < 180 && g < 180 && b < 180;

    if (isGray && isDark && r < 160) {
        return true;
    }

    for (const bg of BACKGROUND_COLORS) {
        if (Math.abs(r - bg.r) < COLOR_TOLERANCE &&
            Math.abs(g - bg.g) < COLOR_TOLERANCE &&
            Math.abs(b - bg.b) < COLOR_TOLERANCE) {
            return true;
        }
    }

    return false;
}

async function convertToTransparent(inputPath) {
    try {
        const image = sharp(inputPath);
        const metadata = await image.metadata();

        // Ignorer les fichiers trop petits ou non-images
        if (!metadata.width || !metadata.height) {
            return { success: false, reason: 'Invalid image' };
        }

        const { data, info } = await image
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const channels = info.channels;
        const pixelCount = info.width * info.height;
        let transparentPixels = 0;

        for (let i = 0; i < pixelCount; i++) {
            const offset = i * channels;
            const r = data[offset];
            const g = data[offset + 1];
            const b = data[offset + 2];

            if (isBackgroundColor(r, g, b)) {
                data[offset + 3] = 0;
                transparentPixels++;
            }
        }

        // Sauvegarder en remplaçant l'original
        const tempPath = inputPath + '.tmp.png';

        await sharp(data, {
            raw: {
                width: info.width,
                height: info.height,
                channels: channels
            }
        })
            .png()
            .toFile(tempPath);

        // Remplacer l'original
        fs.unlinkSync(inputPath);
        fs.renameSync(tempPath, inputPath.replace(/\.(jpg|jpeg|png)$/i, '.png'));

        const percent = ((transparentPixels / pixelCount) * 100).toFixed(1);
        return { success: true, transparent: percent };

    } catch (error) {
        return { success: false, reason: error.message };
    }
}

async function processDirectory(dir, stats) {
    if (!fs.existsSync(dir)) {
        return;
    }

    const items = fs.readdirSync(dir);

    for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
            // Vérifier si c'est un dossier exclu
            const relativePath = path.relative(BASE_DIR, itemPath);
            const isExcluded = FOLDERS_TO_EXCLUDE.some(ex => relativePath.startsWith(ex));

            if (!isExcluded) {
                await processDirectory(itemPath, stats);
            }
        } else if (item.match(/\.(png|jpg|jpeg)$/i)) {
            stats.total++;
            process.stdout.write(`\r   🔄 Traitement: ${stats.total} fichiers...`);

            const result = await convertToTransparent(itemPath);

            if (result.success) {
                stats.success++;
            } else {
                stats.failed++;
            }
        }
    }
}

async function main() {
    console.log('\n🔄 ═══════════════════════════════════════════════════════');
    console.log('   NARVOS PRIME - BATCH TRANSPARENCY CONVERTER');
    console.log('   Convertit tous les assets (sauf maps) en transparent');
    console.log('═══════════════════════════════════════════════════════════\n');

    const stats = { total: 0, success: 0, failed: 0 };

    console.log('📂 Dossiers à traiter:');
    for (const folder of FOLDERS_TO_PROCESS) {
        const fullPath = path.join(BASE_DIR, folder);
        if (fs.existsSync(fullPath)) {
            console.log(`   ✓ ${folder}`);
        } else {
            console.log(`   ⚠ ${folder} (n'existe pas)`);
        }
    }

    console.log('\n🚫 Dossiers exclus:');
    for (const folder of FOLDERS_TO_EXCLUDE) {
        console.log(`   ✗ ${folder}`);
    }

    console.log('\n🔄 Conversion en cours...\n');

    for (const folder of FOLDERS_TO_PROCESS) {
        const fullPath = path.join(BASE_DIR, folder);
        if (fs.existsSync(fullPath)) {
            console.log(`\n📁 ${folder}:`);
            const beforeCount = stats.total;
            await processDirectory(fullPath, stats);
            const processed = stats.total - beforeCount;
            console.log(`\n   ✅ ${processed} fichiers traités`);
        }
    }

    console.log('\n\n' + '═'.repeat(60));
    console.log('   📊 RAPPORT FINAL');
    console.log('═'.repeat(60) + '\n');
    console.log(`📦 Total fichiers traités: ${stats.total}`);
    console.log(`✅ Succès: ${stats.success}`);
    console.log(`❌ Échecs: ${stats.failed}`);

    console.log('\n✅ Conversion terminée!\n');
}

main().catch(console.error);
