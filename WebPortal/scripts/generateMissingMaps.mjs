
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NANOBANANA_API_KEY = '78b6d9ece3ee4deedce978cf5b58eb80';
const API_HOST = 'api.nanobananaapi.ai';

const OUTPUT_BASE = path.join(__dirname, '../public/textures/dofus_maps');

const CATEGORIES = ['ville', 'exterieur_ville', 'donjon'];

const FACTIONS = [
    {
        id: 'AQUARYS',
        name: 'Arkhalys',
        style: 'High-end 2D hand-drawn vector art tactical map, Dofus 2.0 style. Underwater futuristic gothic city. Deep oceanic cyan and bioluminescent blue. Intricate stone architecture with arched glowing windows, shell-shaped stone benches, bubbling aquatic fountains. Glowing floating jellyfish and colorful coral reefs as decor. Isometric 2:1 perspective, tactical grid-aligned stone walkways, crisp thick black ink outlines, 2-stage cel-shading. No characters. No text.'
    },
    {
        id: 'FUNGARIA',
        name: 'Zayan',
        style: 'High-end 2D hand-drawn vector art tactical map, Dofus 2.0 style. Alien bacterial swamp. Vibrant toxic purple and neon green. Buildings grown from giant porous mushroom caps, suspended spore-bridges, bubbling organic slime ponds. Bioluminescent fungal trees and pulsing egg sacs as decor. Isometric 2:1 perspective, tactical organic mushroom platforms, crisp thick black ink outlines, 2-stage cel-shading. No characters. No text.'
    },
    {
        id: 'DÉSERTICA',
        name: 'Mezalayis',
        style: 'High-end 2D hand-drawn vector art tactical map, Dofus 2.0 style. Desert junk-mech oasis. Scorched orange sands and industrial charcoal. Buildings made of tiered scrap metal and rusted mesas, solar panels with glowing blue veins, metallic pipes and valve wheels. Cacti-bots and iron skeletons as decor. Isometric 2:1 perspective, tactical scrap-metal catwalks and sand dunes, crisp thick black ink outlines, 2-stage cel-shading. No characters. No text.'
    },
    {
        id: 'Station_Spatiale',
        name: 'Station Spatiale',
        style: 'High-end 2D hand-drawn vector art tactical map, Dofus 2.0 style. Sci-fi orbital station. Deep space black and cold steel gray. High-tech corridors with holographic consoles, massive glass windows showing distant stars and nebulae, octagonal sliding doors. Robotic sensors and glowing cable bundles as decor. Isometric 2:1 perspective, tactical metallic grates and carbon-fiber floors, crisp thick black ink outlines, 2-stage cel-shading. No characters. No text.'
    }
];

async function submitTask(prompt) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({
            prompt: prompt,
            numImages: 1,
            type: 'TEXTTOIAMGE',
            image_size: '1:1'
        });
        const options = {
            hostname: API_HOST,
            path: '/api/v1/nanobanana/generate',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${NANOBANANA_API_KEY}`
            }
        };
        const req = https.request(options, res => {
            let d = '';
            res.on('data', chunk => d += chunk);
            res.on('end', () => {
                try {
                    const r = JSON.parse(d);
                    if (r.code === 200) resolve(r.data.taskId);
                    else reject(r.msg);
                } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function waitTask(taskId) {
    for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 8000));
        const res = await new Promise((resolve, reject) => {
            https.get({
                hostname: API_HOST,
                path: `/api/v1/nanobanana/record-info?taskId=${taskId}`,
                headers: { 'Authorization': `Bearer ${NANOBANANA_API_KEY}` }
            }, res => {
                let d = '';
                res.on('data', chunk => d += chunk);
                res.on('end', () => {
                    try { resolve(JSON.parse(d)); }
                    catch (e) { reject(e); }
                });
            }).on('error', reject);
        });
        if (res.code === 200 && res.data?.successFlag === 1) {
            return res.data.response.resultImageUrl || res.data.response.originImageUrl;
        }
        if (res.data?.successFlag > 1) throw new Error("Task failed");
    }
    throw new Error("Timeout");
}

async function download(url, dest) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            if (res.statusCode !== 200) return reject(`Status ${res.statusCode}`);
            const file = fs.createWriteStream(dest);
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
    });
}

async function run() {
    for (const faction of FACTIONS) {
        for (const cat of CATEGORIES) {
            const folder = path.join(OUTPUT_BASE, faction.id, cat);
            if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

            // Generate 8 maps per category
            for (let i = 1; i <= 8; i++) {
                const fileName = `${faction.id}_${cat.toUpperCase()}_${i.toString().padStart(2, '0')}.png`;
                const dest = path.join(folder, fileName);

                if (fs.existsSync(dest)) continue;

                console.log(`Generating ${faction.name} - ${cat} - Map ${i}...`);
                try {
                    const tid = await submitTask(faction.style);
                    const url = await waitTask(tid);
                    await download(url, dest);
                    console.log(` ✅ Done: ${fileName}`);
                } catch (e) {
                    console.error(` ❌ Error for ${fileName}: ${e}`);
                }
                await new Promise(r => setTimeout(r, 3000));
            }
        }
    }
}

run();
