import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_ROOT = path.join(__dirname, '../public/textures/personnage');
const OUTPUT_ROOT = path.join(__dirname, '../public/textures/personnage/personnage');

const TARGET_SIZE = 256;
const PADDING = 20;

async function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Détecte les boîtes englobantes des sprites individuels en cherchant les "îlots" de pixels
 */
async function findSpritesInImage(imageBuffer) {
    const image = sharp(imageBuffer);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;

    // Détecter la couleur du fond (pixel haut-gauche)
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
            const isContent = diff > 40 && !(r > 245 && g > 245 && b > 245);

            if (isContent) {
                // Début d'un nouvel îlot (sprite)
                let minX = x, maxX = x, minY = y, maxY = y;
                const queue = [[x, y]];
                visited[idx] = 1;

                while (queue.length > 0) {
                    const [currX, currY] = queue.shift();

                    if (currX < minX) minX = currX;
                    if (currX > maxX) maxX = currX;
                    if (currY < minY) minY = currY;
                    if (currY > maxY) maxY = currY;

                    // Voisins (4-connexité ou 8-connexité, ici 4 suffit souvent mais 8 est plus sûr)
                    const neighbors = [
                        [currX + 1, currY], [currX - 1, currY],
                        [currX, currY + 1], [currX, currY - 1]
                    ];

                    for (const [nx, ny] of neighbors) {
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const nIdx = ny * width + nx;
                            if (!visited[nIdx]) {
                                const npIdx = nIdx * channels;
                                const nr = data[npIdx];
                                const ng = data[npIdx + 1];
                                const nb = data[npIdx + 2];
                                const nDiff = Math.abs(nr - bgR) + Math.abs(ng - bgG) + Math.abs(nb - bgB);
                                const nIsContent = nDiff > 40 && !(nr > 245 && ng > 245 && nb > 245);

                                if (nIsContent) {
                                    visited[nIdx] = 1;
                                    queue.push([nx, ny]);
                                }
                            }
                        }
                    }
                }

                // Si l'îlot est assez grand pour être un sprite
                const spriteW = maxX - minX + 1;
                const spriteH = maxY - minY + 1;
                if (spriteW > 20 && spriteH > 20) {
                    sprites.push({ x: minX, y: minY, w: spriteW, h: spriteH });
                }
            }
        }
    }
    return sprites;
}

async function processFullSheet(sheetPath, faction) {
    const baseName = path.basename(sheetPath, '.png');
    const outputDir = path.join(OUTPUT_ROOT, faction, baseName);
    ensureDir(outputDir);

    console.log(`\n🔍 Analyse de la planche : ${faction}/${baseName}`);

    // 1. Lire l'image complète
    const fullBuffer = await fs.promises.readFile(sheetPath);

    // 2. Trouver les sprites individuels (bounding boxes)
    const spriteBoxes = await findSpritesInImage(fullBuffer);
    console.log(`   ✨ ${spriteBoxes.length} sprites individuels détectés.`);

    // 3. Extraire et traiter chaque sprite
    for (let i = 0; i < spriteBoxes.length; i++) {
        const box = spriteBoxes[i];

        try {
            // Extraire le sprite avec un peu de marge si possible ou juste la box
            const spriteBuffer = await sharp(fullBuffer)
                .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
                .toBuffer();

            // Créer le sprite final sur fond transparent centré
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
                        .removeAlpha() // Nettoyer si l'AI a mis de l'alpha bizarre
                        // Redétourer au cas où le fond a été extrait
                        // (On peut refaire un removeBackground sur le petit buffer pour la précision)
                        .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: true })
                        .toBuffer(),
                    gravity: 'center'
                }])
                .png()
                .toBuffer();

            // Deuxième passe de transparence sur le sprite final (pour enlever le blanc résiduel)
            const finalProcessed = await removeFinalBackground(finalImage);

            const outputName = `${baseName}_s${i.toString().padStart(3, '0')}.png`;
            await fs.promises.writeFile(path.join(outputDir, outputName), finalProcessed);
        } catch (err) {
            console.error(`   ⚠️ Erreur sprite ${i}: ${err.message}`);
        }
    }
}

async function removeFinalBackground(buffer) {
    const image = sharp(buffer);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    const outBuffer = Buffer.alloc(data.length);

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Seuil pour le blanc restants autour du sprite
        const isWhite = r > 240 && g > 240 && b > 240;

        if (isWhite) {
            outBuffer[i] = 0;
            outBuffer[i + 1] = 0;
            outBuffer[i + 2] = 0;
            outBuffer[i + 3] = 0;
        } else {
            outBuffer[i] = r;
            outBuffer[i + 1] = g;
            outBuffer[i + 2] = b;
            outBuffer[i + 3] = a;
        }
    }

    return await sharp(outBuffer, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

async function main() {
    console.log('--- NARVOS PRIME - PRECISION SPRITE CUTTER ---');

    // Nettoyer le dossier de sortie pour éviter les mélanges
    if (fs.existsSync(OUTPUT_ROOT)) {
        fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true });
    }
    ensureDir(OUTPUT_ROOT);

    const factions = ['akarlys', 'zayan', 'mezalayis'];

    for (const faction of factions) {
        const factionDir = path.join(INPUT_ROOT, faction);
        if (!fs.existsSync(factionDir)) continue;

        const sheets = fs.readdirSync(factionDir).filter(f => f.endsWith('.png'));
        for (const sheet of sheets) {
            await processFullSheet(path.join(factionDir, sheet), faction);
        }
    }

    console.log('\n✨ Découpe de précision terminée !');
}

main().catch(console.error);
