/**
 * 🔄 NARVOS PRIME - IMAGE TRANSPARENCY CONVERTER
 * Convertit les images UI en PNG avec fond transparent
 * 
 * Usage: node scripts/convertToTransparent.mjs
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_DIR = path.join(__dirname, '../public/textures/launcher/ui');
const OUTPUT_DIR = path.join(__dirname, '../public/textures/launcher/ui_transparent');

// Couleurs de fond à rendre transparentes (avec tolérance)
// Le fond de l'image source est un damier gris
const BACKGROUND_COLORS = [
    { r: 102, g: 102, b: 102 }, // Gris foncé du damier
    { r: 153, g: 153, b: 153 }, // Gris clair du damier
    { r: 128, g: 128, b: 128 }, // Gris moyen
    { r: 64, g: 64, b: 64 },    // Gris très foncé
    { r: 48, g: 48, b: 48 },    // Quasi noir
    { r: 51, g: 51, b: 51 },    // Autre gris
];

const COLOR_TOLERANCE = 25; // Tolérance pour la détection de couleur

/**
 * Vérifie si une couleur correspond au fond
 */
function isBackgroundColor(r, g, b) {
    // Vérifier si c'est proche d'un gris pur (r ≈ g ≈ b)
    const isGray = Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && Math.abs(r - b) < 15;
    const isDark = r < 180 && g < 180 && b < 180;

    if (isGray && isDark) {
        return true;
    }

    // Vérifier contre les couleurs de fond connues
    for (const bg of BACKGROUND_COLORS) {
        if (Math.abs(r - bg.r) < COLOR_TOLERANCE &&
            Math.abs(g - bg.g) < COLOR_TOLERANCE &&
            Math.abs(b - bg.b) < COLOR_TOLERANCE) {
            return true;
        }
    }

    return false;
}

async function convertToTransparent(inputPath, outputPath) {
    const filename = path.basename(inputPath);
    console.log(`\n🔄 Conversion: ${filename}`);

    try {
        // Charger l'image
        const image = sharp(inputPath);
        const metadata = await image.metadata();

        console.log(`   📐 Dimensions: ${metadata.width}x${metadata.height}`);

        // Obtenir les données brutes
        const { data, info } = await image
            .ensureAlpha() // S'assurer qu'il y a un canal alpha
            .raw()
            .toBuffer({ resolveWithObject: true });

        const channels = info.channels;
        const pixelCount = info.width * info.height;
        let transparentPixels = 0;

        // Parcourir chaque pixel et rendre transparent si c'est un fond
        for (let i = 0; i < pixelCount; i++) {
            const offset = i * channels;
            const r = data[offset];
            const g = data[offset + 1];
            const b = data[offset + 2];

            if (isBackgroundColor(r, g, b)) {
                // Rendre transparent
                data[offset + 3] = 0; // Canal alpha = 0
                transparentPixels++;
            }
        }

        // Recréer l'image avec les modifications
        await sharp(data, {
            raw: {
                width: info.width,
                height: info.height,
                channels: channels
            }
        })
            .png()
            .toFile(outputPath);

        const stats = fs.statSync(outputPath);
        const transparentPercent = ((transparentPixels / pixelCount) * 100).toFixed(1);

        console.log(`   ✅ Converti: ${transparentPercent}% transparent`);
        console.log(`   💾 Sauvé: ${(stats.size / 1024).toFixed(1)} KB`);

        return true;
    } catch (error) {
        console.log(`   ❌ Erreur: ${error.message}`);
        return false;
    }
}

async function main() {
    console.log('\n🔄 ═══════════════════════════════════════════════════════');
    console.log('   NARVOS PRIME - TRANSPARENCY CONVERTER');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Créer le dossier de sortie
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`📁 Dossier créé: ${OUTPUT_DIR}\n`);
    }

    // Lister les fichiers PNG à convertir
    const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.png'));
    console.log(`📊 ${files.length} fichiers à convertir\n`);

    const results = { success: 0, failed: 0 };

    for (const file of files) {
        const inputPath = path.join(INPUT_DIR, file);
        const outputPath = path.join(OUTPUT_DIR, file);

        const success = await convertToTransparent(inputPath, outputPath);
        if (success) {
            results.success++;
        } else {
            results.failed++;
        }
    }

    // Copier les fichiers convertis vers le dossier original
    console.log('\n📦 Remplacement des fichiers originaux...');
    for (const file of files) {
        const srcPath = path.join(OUTPUT_DIR, file);
        const destPath = path.join(INPUT_DIR, file);

        if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`   ✓ ${file}`);
        }
    }

    // Rapport final
    console.log('\n' + '═'.repeat(60));
    console.log('   📊 RAPPORT');
    console.log('═'.repeat(60) + '\n');
    console.log(`✅ Succès: ${results.success}/${files.length}`);
    console.log(`❌ Échecs: ${results.failed}/${files.length}`);
    console.log(`\n📂 Fichiers mis à jour dans: ${INPUT_DIR}`);
    console.log('\n✅ Terminé!\n');
}

main().catch(console.error);
