import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const dir = 'c:/mes_projets/narvosprime-web-prototype/public/textures/personnage/personnage';

async function check() {
    const folders = fs.readdirSync(dir).filter(f => fs.statSync(path.join(dir, f)).isDirectory());
    for (const folder of folders) {
        const folderPath = path.join(dir, folder);
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.png'));
        if (files.length > 0) {
            const metadata = await sharp(path.join(folderPath, files[0])).metadata();
            console.log(`[DIM] ${folder} | ${metadata.width}x${metadata.height}`);
        }
    }
}

check();
