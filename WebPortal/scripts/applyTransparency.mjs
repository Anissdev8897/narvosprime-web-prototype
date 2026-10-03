import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEXTURES_ROOT = path.join(__dirname, '../public/textures');
const DIRS_TO_PROCESS = ['decor', 'items'];

/**
 * Supprime le fond blanc et rend l'image transparente
 */
async function makeTransparent(buffer) {
    const image = sharp(buffer);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

    // Échantillonner le pixel haut-gauche pour le fond
    const bgR = data[0];
    const bgG = data[1];
    const bgB = data[2];

    const outBuffer = Buffer.alloc(info.width * info.height * 4);

    for (let i = 0; i < info.width * info.height; i++) {
        const r = data[i * info.channels];
        const g = data[i * info.channels + 1];
        const b = data[i * info.channels + 2];
        const a = info.channels === 4 ? data[i * info.channels + 3] : 255;

        const diff = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);

        // Seuil pour le fond blanc/clair
        const isBackground = diff < 40 || (r > 245 && g > 245 && b > 245);

        if (isBackground) {
            outBuffer[i * 4] = 0;
            outBuffer[i * 4 + 1] = 0;
            outBuffer[i * 4 + 2] = 0;
            outBuffer[i * 4 + 3] = 0;
        } else {
            outBuffer[i * 4] = r;
            outBuffer[i * 4 + 1] = g;
            outBuffer[i * 4 + 2] = b;
            outBuffer[i * 4 + 3] = a;
        }
    }

    return await sharp(outBuffer, { raw: { width: info.width, height: info.height, channels: 4 } })
        .png()
        .toBuffer();
}

async function walkDir(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory()) {
            await walkDir(fullPath);
        } else if (item.endsWith('.png')) {
            console.log(`   ✨ Traitement transparence: ${path.relative(TEXTURES_ROOT, fullPath)}`);
            try {
                const buffer = await fs.promises.readFile(fullPath);
                const transparentBuffer = await makeTransparent(buffer);
                await fs.promises.writeFile(fullPath, transparentBuffer);
            } catch (err) {
                console.error(`   ❌ Erreur sur ${item}: ${err.message}`);
            }
        }
    }
}

async function main() {
    console.log('--- NARVOS PRIME - GLOBAL TRANSPARENCY PROCESSOR ---');

    for (const targetDir of DIRS_TO_PROCESS) {
        const fullTargetDir = path.join(TEXTURES_ROOT, targetDir);
        if (fs.existsSync(fullTargetDir)) {
            console.log(`\n📂 Traitement du dossier: ${targetDir}`);
            await walkDir(fullTargetDir);
        }
    }

    console.log('\n✅ Transparence appliquée sur tous les assets !');
}

main().catch(console.error);
