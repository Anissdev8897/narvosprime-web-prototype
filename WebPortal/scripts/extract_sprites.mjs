
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_ROOT = path.join(__dirname, '../public/textures/personnage');
const OUTPUT_ROOT = path.join(__dirname, '../public/textures/personnage_extracted');

const TARGET_SIZE = 256;
const PADDING = 20;

async function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

async function findSpritesInImage(imageBuffer) {
    const image = sharp(imageBuffer);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;

    // Background color detection (top-left pixel)
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

            // Distance from bg or white
            const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
            const isWhite = r > 245 && g > 245 && b > 245;
            const isContent = diff > 30 && !isWhite;

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

                    const neighbors = [[currX + 1, currY], [currX - 1, currY], [currX, currY + 1], [currX, currY - 1]];
                    for (const [nx, ny] of neighbors) {
                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const nIdx = ny * width + nx;
                            if (!visited[nIdx]) {
                                const npIdx = nIdx * channels;
                                const nDiff = Math.abs(data[npIdx] - bgR) + Math.abs(data[npIdx + 1] - bgG) + Math.abs(data[npIdx + 2] - bgB);
                                const nIsWhite = data[npIdx] > 245 && data[npIdx + 1] > 245 && data[npIdx + 2] > 245;
                                if (nDiff > 30 && !nIsWhite) {
                                    visited[nIdx] = 1;
                                    queue.push([nx, ny]);
                                }
                            }
                        }
                    }
                }
                const spriteW = maxX - minX + 1;
                const spriteH = maxY - minY + 1;
                if (spriteW > 15 && spriteH > 15) {
                    sprites.push({ x: minX, y: minY, w: spriteW, h: spriteH });
                }
            }
        }
    }
    return sprites;
}

async function processFullSheet(sheetPath, className) {
    const outputDir = path.join(OUTPUT_ROOT, className);
    await ensureDir(outputDir);

    console.log(`Processing sheet: ${sheetPath}`);
    const fullBuffer = await fs.promises.readFile(sheetPath);
    const spriteBoxes = await findSpritesInImage(fullBuffer);

    // Sort by grid (top to bottom, left to right)
    // We assume 8 rows and 4 cols
    spriteBoxes.sort((a, b) => {
        const rowA = Math.floor(a.y / (fullBuffer.height / 8));
        const rowB = Math.floor(b.y / (fullBuffer.height / 8));
        if (Math.abs(a.y - b.y) > 50) return a.y - b.y;
        return a.x - b.x;
    });

    console.log(`Extracted ${spriteBoxes.length} sprites for ${className}`);

    for (let i = 0; i < Math.min(spriteBoxes.length, 32); i++) {
        const box = spriteBoxes[i];
        const spriteBuffer = await sharp(fullBuffer)
            .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
            .toBuffer();

        const finalImage = await sharp({
            create: { width: TARGET_SIZE, height: TARGET_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }
        })
            .composite([{
                input: await sharp(spriteBuffer).resize(TARGET_SIZE - PADDING * 2, TARGET_SIZE - PADDING * 2, { fit: 'inside' }).toBuffer(),
                gravity: 'center'
            }])
            .png()
            .toBuffer();

        const outputName = `s${i.toString().padStart(3, '0')}.png`;
        await fs.promises.writeFile(path.join(outputDir, outputName), finalImage);
    }
}

async function main() {
    console.log('--- STARTING EXTRACTION ---');
    await ensureDir(OUTPUT_ROOT);

    const factions = ['akarlys', 'zayan', 'mezalayis'];
    for (const faction of factions) {
        const factionDir = path.join(INPUT_ROOT, faction);
        if (!fs.existsSync(factionDir)) continue;

        const files = fs.readdirSync(factionDir).filter(f => f.endsWith('_sheet.png'));
        for (const file of files) {
            const className = file.replace('_sheet.png', '');
            await processFullSheet(path.join(factionDir, file), className);
        }
    }
    console.log('--- EXTRACTION DONE ---');
}

main().catch(console.error);
