/**
 * 🔪 NARVOS PRIME - SPRITE CUTTER & ANALYZER
 * Découpe les sprite sheets en frames individuels
 * Détecte et supprime les doublons
 * Analyse la cohérence des maps
 * 
 * Usage: node scripts/spriteCutterAnalyzer.mjs
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.join(__dirname, '../public/textures');
const OUTPUT_DIR = path.join(__dirname, '../public/textures/processed');

// =====================================================
// 🔧 CONFIGURATION
// =====================================================

const CONFIG = {
    // Taille des frames pour les sorts (carrés)
    spellFrameSize: 128,
    // Nombre de frames attendues par ligne
    framesPerRow: 8,
    // Seuil de similarité (0-1, 1 = identique)
    similarityThreshold: 0.95,
    // Taille minimale d'un sprite valide (pixels)
    minSpriteSize: 32
};

// =====================================================
// 📊 STATISTIQUES
// =====================================================

const stats = {
    totalSpritesAnalyzed: 0,
    spritesExtracted: 0,
    duplicatesRemoved: 0,
    uniqueSprites: 0,
    mapsAnalyzed: 0,
    mapsValid: 0,
    mapsNeedsFix: 0
};

// =====================================================
// 🔧 FONCTIONS UTILITAIRES
// =====================================================

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

async function getImageHash(buffer) {
    // Créer un hash basé sur les pixels de l'image
    const resized = await sharp(buffer)
        .resize(32, 32, { fit: 'fill' })
        .grayscale()
        .raw()
        .toBuffer();

    return crypto.createHash('md5').update(resized).digest('hex');
}

async function compareImages(buffer1, buffer2) {
    try {
        // Redimensionner les deux images
        const img1 = await sharp(buffer1).resize(64, 64, { fit: 'fill' }).grayscale().raw().toBuffer();
        const img2 = await sharp(buffer2).resize(64, 64, { fit: 'fill' }).grayscale().raw().toBuffer();

        // Calculer la différence moyenne
        let diff = 0;
        for (let i = 0; i < img1.length; i++) {
            diff += Math.abs(img1[i] - img2[i]);
        }

        const avgDiff = diff / img1.length / 255;
        return 1 - avgDiff; // Retourne la similarité (0-1)
    } catch (e) {
        return 0;
    }
}

async function isEmptyOrTransparent(buffer) {
    try {
        const { data, info } = await sharp(buffer)
            .raw()
            .toBuffer({ resolveWithObject: true });

        if (info.channels < 4) return false; // Pas de canal alpha

        let transparentPixels = 0;
        let totalPixels = info.width * info.height;

        for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 10) transparentPixels++;
        }

        return (transparentPixels / totalPixels) > 0.95;
    } catch (e) {
        return true;
    }
}

async function hasContent(buffer) {
    try {
        const stats = await sharp(buffer).stats();
        // Vérifier si l'image a du contenu (variance dans les pixels)
        const hasVariance = stats.channels.some(c => c.stdev > 10);
        return hasVariance;
    } catch (e) {
        return false;
    }
}

// =====================================================
// ✂️ DÉCOUPE DES SPRITE SHEETS
// =====================================================

async function cutSpriteSheet(imagePath, outputFolder, baseName) {
    console.log(`\n   ✂️ Découpe: ${path.basename(imagePath)}`);

    const metadata = await sharp(imagePath).metadata();
    const { width, height } = metadata;

    console.log(`      Dimensions: ${width}x${height}`);

    // Détecter automatiquement la taille des frames
    let frameWidth, frameHeight, cols, rows;

    if (width > height * 2) {
        // Sprite sheet horizontal (strip)
        frameHeight = height;
        cols = Math.round(width / height);
        frameWidth = Math.floor(width / cols);
        rows = 1;
    } else if (height > width * 2) {
        // Sprite sheet vertical
        frameWidth = width;
        rows = Math.round(height / width);
        frameHeight = Math.floor(height / rows);
        cols = 1;
    } else {
        // Carré ou proche - essayer de détecter une grille
        const possibleSizes = [256, 192, 128, 96, 64, 48, 32];

        for (const size of possibleSizes) {
            if (width % size === 0 && height % size === 0) {
                frameWidth = size;
                frameHeight = size;
                cols = width / size;
                rows = height / size;
                break;
            }
        }

        // Fallback si pas de taille exacte
        if (!frameWidth) {
            frameWidth = Math.min(width, height);
            frameHeight = frameWidth;
            cols = Math.floor(width / frameWidth);
            rows = Math.floor(height / frameHeight);
        }
    }

    console.log(`      Grille détectée: ${cols}x${rows} frames de ${frameWidth}x${frameHeight}`);

    const frames = [];
    const frameBuffers = [];

    // Extraire chaque frame
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = col * frameWidth;
            const y = row * frameHeight;

            try {
                const frameBuffer = await sharp(imagePath)
                    .extract({ left: x, top: y, width: frameWidth, height: frameHeight })
                    .png()
                    .toBuffer();

                // Vérifier si le frame a du contenu
                const hasContentFlag = await hasContent(frameBuffer);
                const isEmpty = await isEmptyOrTransparent(frameBuffer);

                if (hasContentFlag && !isEmpty) {
                    const frameIndex = row * cols + col;
                    frames.push({
                        index: frameIndex,
                        buffer: frameBuffer,
                        row,
                        col
                    });
                    frameBuffers.push(frameBuffer);
                }
            } catch (e) {
                console.log(`      ⚠️ Erreur frame ${row},${col}: ${e.message}`);
            }
        }
    }

    console.log(`      Frames avec contenu: ${frames.length}`);
    stats.spritesExtracted += frames.length;

    // Détecter les doublons
    const uniqueFrames = [];
    const hashes = new Map();

    for (const frame of frames) {
        const hash = await getImageHash(frame.buffer);

        if (!hashes.has(hash)) {
            // Vérifier aussi par similarité visuelle
            let isDuplicate = false;

            for (const unique of uniqueFrames) {
                const similarity = await compareImages(frame.buffer, unique.buffer);
                if (similarity > CONFIG.similarityThreshold) {
                    isDuplicate = true;
                    stats.duplicatesRemoved++;
                    break;
                }
            }

            if (!isDuplicate) {
                hashes.set(hash, true);
                uniqueFrames.push(frame);
            }
        } else {
            stats.duplicatesRemoved++;
        }
    }

    console.log(`      Frames uniques: ${uniqueFrames.length} (${frames.length - uniqueFrames.length} doublons supprimés)`);
    stats.uniqueSprites += uniqueFrames.length;

    // Sauvegarder les frames uniques
    ensureDir(outputFolder);

    for (let i = 0; i < uniqueFrames.length; i++) {
        const frame = uniqueFrames[i];
        const framePath = path.join(outputFolder, `${baseName}_frame_${i.toString().padStart(2, '0')}.png`);

        await sharp(frame.buffer).toFile(framePath);
    }

    console.log(`      ✓ Sauvegardé ${uniqueFrames.length} frames dans ${path.basename(outputFolder)}/`);

    return uniqueFrames.length;
}

// =====================================================
// 🗺️ ANALYSE DES MAPS
// =====================================================

async function analyzeMap(imagePath) {
    const filename = path.basename(imagePath);
    console.log(`\n   🗺️ Analyse: ${filename}`);

    try {
        const metadata = await sharp(imagePath).metadata();
        const { width, height, channels } = metadata;

        const stats = await sharp(imagePath).stats();

        // Critères de qualité pour une map
        const issues = [];

        // 1. Vérifier les dimensions
        if (width < 512 || height < 512) {
            issues.push(`Taille trop petite (${width}x${height})`);
        }

        // 2. Vérifier le ratio
        const ratio = width / height;
        if (ratio < 0.5 || ratio > 2) {
            issues.push(`Ratio inhabituel (${ratio.toFixed(2)})`);
        }

        // 3. Vérifier la variété des couleurs
        const avgStdDev = stats.channels.reduce((sum, c) => sum + c.stdev, 0) / stats.channels.length;
        if (avgStdDev < 20) {
            issues.push('Peu de variation de couleurs');
        }

        // 4. Vérifier si l'image est trop sombre ou claire
        const avgMean = stats.channels.slice(0, 3).reduce((sum, c) => sum + c.mean, 0) / 3;
        if (avgMean < 30) {
            issues.push('Image trop sombre');
        } else if (avgMean > 240) {
            issues.push('Image trop claire');
        }

        // 5. Vérifier si l'image est isométrique (pour les jeux tactiques)
        // Cela nécessiterait une analyse plus complexe, on fait une vérification basique

        const isValid = issues.length === 0;

        console.log(`      Dimensions: ${width}x${height}`);
        console.log(`      Canaux: ${channels}`);
        console.log(`      Variation couleurs: ${avgStdDev.toFixed(1)}`);
        console.log(`      Luminosité moyenne: ${avgMean.toFixed(1)}`);

        if (isValid) {
            console.log(`      ✅ Map valide pour implémentation`);
            return { valid: true, issues: [] };
        } else {
            console.log(`      ⚠️ Problèmes détectés:`);
            issues.forEach(issue => console.log(`         - ${issue}`));
            return { valid: false, issues };
        }
    } catch (e) {
        console.log(`      ❌ Erreur: ${e.message}`);
        return { valid: false, issues: [e.message] };
    }
}

// =====================================================
// 🚀 EXÉCUTION PRINCIPALE
// =====================================================

async function main() {
    console.log('\n🔪 ═══════════════════════════════════════════════════════');
    console.log('   NARVOS PRIME - SPRITE CUTTER & ANALYZER');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Créer le dossier de sortie
    ensureDir(OUTPUT_DIR);

    // 1. TRAITEMENT DES SORTS
    console.log('\n📦 PHASE 1: Découpe des sprite sheets de sorts');
    console.log('─'.repeat(50));

    const spellsDir = path.join(BASE_DIR, 'spells');

    if (fs.existsSync(spellsDir)) {
        const processSpellFolder = async (folderPath, folderName) => {
            const outputBase = path.join(OUTPUT_DIR, 'spells', folderName);

            const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.png'));

            for (const file of files) {
                const filePath = path.join(folderPath, file);
                const baseName = path.basename(file, '.png');
                const outputFolder = path.join(outputBase, baseName);

                stats.totalSpritesAnalyzed++;

                try {
                    await cutSpriteSheet(filePath, outputFolder, baseName);
                } catch (e) {
                    console.log(`   ❌ Erreur: ${e.message}`);
                }
            }
        };

        // Traiter les sous-dossiers (akarlys, zayan, mezalayis, monsters)
        const subfolders = fs.readdirSync(spellsDir);

        for (const subfolder of subfolders) {
            const subPath = path.join(spellsDir, subfolder);

            if (fs.statSync(subPath).isDirectory()) {
                console.log(`\n   📂 Dossier: ${subfolder}`);
                await processSpellFolder(subPath, subfolder);
            } else if (subfolder.endsWith('.png')) {
                // Fichiers PNG directement dans spells/
                console.log(`\n   📂 Dossier racine`);
                await processSpellFolder(spellsDir, 'general');
                break;
            }
        }
    }

    // 2. TRAITEMENT DES PERSONNAGES
    console.log('\n\n📦 PHASE 2: Découpe des sprites de personnages');
    console.log('─'.repeat(50));

    const personnageDir = path.join(BASE_DIR, 'personnage');

    if (fs.existsSync(personnageDir)) {
        const files = fs.readdirSync(personnageDir).filter(f => f.endsWith('.png'));

        for (const file of files) {
            const filePath = path.join(personnageDir, file);
            const baseName = path.basename(file, '.png');
            const outputFolder = path.join(OUTPUT_DIR, 'personnage', baseName);

            stats.totalSpritesAnalyzed++;

            try {
                await cutSpriteSheet(filePath, outputFolder, baseName);
            } catch (e) {
                console.log(`   ❌ Erreur: ${e.message}`);
            }
        }
    }

    // 3. ANALYSE DES MAPS
    console.log('\n\n📦 PHASE 3: Analyse de cohérence des maps');
    console.log('─'.repeat(50));

    const mapsDir = path.join(BASE_DIR, 'dofus_maps');
    const mapReport = {
        valid: [],
        invalid: []
    };

    if (fs.existsSync(mapsDir)) {
        const processMapFolder = async (folderPath) => {
            const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.png'));

            for (const file of files) {
                const filePath = path.join(folderPath, file);
                stats.mapsAnalyzed++;

                const result = await analyzeMap(filePath);

                if (result.valid) {
                    stats.mapsValid++;
                    mapReport.valid.push(file);
                } else {
                    stats.mapsNeedsFix++;
                    mapReport.invalid.push({ file, issues: result.issues });
                }
            }
        };

        // Parcourir récursivement
        const walkDir = async (dir) => {
            const items = fs.readdirSync(dir);

            for (const item of items) {
                const itemPath = path.join(dir, item);

                if (fs.statSync(itemPath).isDirectory()) {
                    await walkDir(itemPath);
                } else if (item.endsWith('.png')) {
                    stats.mapsAnalyzed++;
                    const result = await analyzeMap(itemPath);

                    if (result.valid) {
                        stats.mapsValid++;
                        mapReport.valid.push(path.relative(mapsDir, itemPath));
                    } else {
                        stats.mapsNeedsFix++;
                        mapReport.invalid.push({
                            file: path.relative(mapsDir, itemPath),
                            issues: result.issues
                        });
                    }
                }
            }
        };

        await walkDir(mapsDir);
    }

    // 4. RAPPORT FINAL
    console.log('\n\n' + '═'.repeat(60));
    console.log('   📊 RAPPORT FINAL');
    console.log('═'.repeat(60) + '\n');

    console.log('🔮 SPRITES:');
    console.log(`   • Sprite sheets analysés: ${stats.totalSpritesAnalyzed}`);
    console.log(`   • Frames extraits: ${stats.spritesExtracted}`);
    console.log(`   • Doublons supprimés: ${stats.duplicatesRemoved}`);
    console.log(`   • Sprites uniques conservés: ${stats.uniqueSprites}`);

    console.log('\n🗺️ MAPS:');
    console.log(`   • Maps analysées: ${stats.mapsAnalyzed}`);
    console.log(`   • Maps valides: ${stats.mapsValid}`);
    console.log(`   • Maps à corriger: ${stats.mapsNeedsFix}`);

    if (mapReport.invalid.length > 0) {
        console.log('\n   ⚠️ Maps nécessitant attention:');
        mapReport.invalid.forEach(m => {
            console.log(`      • ${m.file}: ${m.issues.join(', ')}`);
        });
    }

    // Sauvegarder le rapport
    const reportPath = path.join(OUTPUT_DIR, 'analysis_report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        stats,
        mapReport,
        timestamp: new Date().toISOString()
    }, null, 2));

    console.log(`\n📄 Rapport détaillé: ${reportPath}`);
    console.log(`📂 Sprites découpés: ${OUTPUT_DIR}`);

    console.log('\n✅ Analyse terminée!\n');
}

main().catch(console.error);
