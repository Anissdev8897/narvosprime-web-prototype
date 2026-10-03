import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const dir = 'c:/mes_projets/narvosprime-web-prototype/public/textures/personnage';

async function check() {
    const factions = ['akarlys', 'zayan', 'mezalayis'];
    for (const faction of factions) {
        const factionPath = path.join(dir, faction);
        if (!fs.existsSync(factionPath)) continue;
        const files = fs.readdirSync(factionPath).filter(f => f.endsWith('.png'));
        for (const file of files) {
            const metadata = await sharp(path.join(factionPath, file)).metadata();
            console.log(`[ORIGINAL] ${faction}/${file} | ${metadata.width}x${metadata.height}`);
        }
    }
}

check();
