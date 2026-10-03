import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_ROOT = path.join(__dirname, '../public/textures/spells_anim');
const OUTPUT_ROOT = path.join(__dirname, '../public/textures/processed/spells');

const TARGET_SIZE = 256;
const PADDING = 10;

async function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

async function getImageHash(buffer) {
    try {
        const resized = await sharp(buffer)
            .resize(32, 32, { fit: 'fill' })
            .grayscale()
            .raw()
            .toBuffer();
        return crypto.createHash('md5').update(resized).digest('hex');
    } catch (e) {
        return Math.random().toString();
    }
}

/**
 * Détecte les boîtes englobantes des effets de sorts
 */
async function findSpritesInImage(imageBuffer) {
    const image = sharp(imageBuffer);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;

    const bgR = data[0];
    const bgG = data[1];
    const bgB = data[2];

    const visited = new Uint8Array(width * height);
    const sprites = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (visited[idx]) continue;

            const pIdx = idx * channels;
            const r = data[pIdx];
            const g = data[pIdx + 1];
            const b = data[pIdx + 2];

            const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
            const isContent = diff > 30;

            if (isContent) {
                let minX = x, maxX = x, minY = y, maxY = y;
                const queue = [[x, y]];
                visited[idx] = 1;

                while (queue.length > 0) {
                    const [currX, currY] = queue.shift();

                    if (currX < minX) minX = currX;
                    if (currX > maxX) maxX = currX;
                    if (currY < minY) minY = currY;
                    if (currY > maxY) maxY = currY;

                    const neighbors = [
                        [currX + 1, currY], [currX - 1, currY],
                        [currX, currY + 1], [currX, currY - 1]
                    ];

                    for (const [nx, ny] of neighbors) {
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const nIdx = ny * width + nx;
                            if (!visited[nIdx]) {
                                const npIdx = nIdx * channels;
                                const nDiff = Math.abs(data[npIdx] - bgR) + Math.abs(data[npIdx + 1] - bgG) + Math.abs(data[npIdx + 2] - bgB);
                                if (nDiff > 30) {
                                    visited[nIdx] = 1;
                                    queue.push([nx, ny]);
                                }
                            }
                        }
                    }
                }

                const spriteW = maxX - minX + 1;
                const spriteH = maxY - minY + 1;
                if (spriteW > 10 && spriteH > 10) {
                    sprites.push({ x: minX, y: minY, w: spriteW, h: spriteH });
                }
            }
        }
    }
    return sprites;
}

async function processSpellSheet(sheetPath, faction, subPath = '') {
    const baseName = path.basename(sheetPath, '.png');
    const outputDir = path.join(OUTPUT_ROOT, faction, subPath, baseName);
    ensureDir(outputDir);

    console.log(`\n✨ Analyse du sort : ${faction}/${subPath ? subPath + '/' : ''}${baseName}`);

    const fullBuffer = await fs.promises.readFile(sheetPath);
    const spriteBoxes = await findSpritesInImage(fullBuffer);
    console.log(`   🔸 ${spriteBoxes.length} étapes d'animation détectées.`);

    const seenHashes = new Set();
    let savedCount = 0;

    for (let i = 0; i < spriteBoxes.length; i++) {
        const box = spriteBoxes[i];

        try {
            const spriteBuffer = await sharp(fullBuffer)
                .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
                .toBuffer();

            const maxDim = TARGET_SIZE - PADDING * 2;
            const finalImage = await sharp({
                create: {
                    width: TARGET_SIZE,
                    height: TARGET_SIZE,
                    channels: 4,
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                }
            })
                .composite([{
                    input: await sharp(spriteBuffer)
                        .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
                        .toBuffer(),
                    gravity: 'center'
                }])
                .png()
                .toBuffer();

            const finalProcessed = await removeSpellBackground(finalImage);

            const hash = await getImageHash(finalProcessed);
            if (seenHashes.has(hash)) continue;
            seenHashes.add(hash);

            const outputName = `${baseName}_anim_${savedCount.toString().padStart(3, '0')}.png`;
            await fs.promises.writeFile(path.join(outputDir, outputName), finalProcessed);
            savedCount++;
        } catch (err) {
            console.error(`   ⚠️ Erreur anim ${i}: ${err.message}`);
        }
    }
    console.log(`   ✅ ${savedCount} animations uniques sauvegardées.`);
}

async function removeSpellBackground(buffer) {
    const image = sharp(buffer);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    const outBuffer = Buffer.alloc(data.length);

    const bgR = data[0];
    const bgG = data[1];
    const bgB = data[2];

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);

        if (diff < 40) {
            outBuffer[i] = 0; outBuffer[i + 1] = 0; outBuffer[i + 2] = 0; outBuffer[i + 3] = 0;
        } else {
            outBuffer[i] = r; outBuffer[i + 1] = g; outBuffer[i + 2] = b; outBuffer[i + 3] = 255;
        }
    }

    return await sharp(outBuffer, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function main() {
    console.log('--- NARVOS PRIME - SPELL ANIMATION PROCESSOR ---');

    if (!fs.existsSync(INPUT_ROOT)) {
        console.log('❌ Aucun dossier "spells_anim" trouvé.');
        return;
    }

    if (fs.existsSync(OUTPUT_ROOT)) {
        fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true });
    }
    ensureDir(OUTPUT_ROOT);

    async function walk(dir, faction, sub = '') {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            const full = path.join(dir, item);
            if (fs.statSync(full).isDirectory()) {
                await walk(full, faction, path.join(sub, item));
            } else if (item.endsWith('.png')) {
                await processSpellSheet(full, faction, sub);
            }
        }
    }

    const factions = fs.readdirSync(INPUT_ROOT).filter(f => fs.statSync(path.join(INPUT_ROOT, f)).isDirectory());

    for (const faction of factions) {
        await walk(path.join(INPUT_ROOT, faction), faction);
    }

    console.log('\n✨ Traitement des sorts terminé !');
}

main().catch(console.error);
