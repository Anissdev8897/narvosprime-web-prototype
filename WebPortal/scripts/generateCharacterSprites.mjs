
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NANOBANANA_API_KEY = '78b6d9ece3ee4deedce978cf5b58eb80';
const API_HOST = 'api.nanobananaapi.ai';
const GENERATE_PATH = '/api/v1/nanobanana/generate';
const RECORD_INFO_PATH = '/api/v1/nanobanana/record-info';

const OUTPUT_BASE = path.join(__dirname, '../public/textures/personnage');
const DELAY = 2000;

const CLASSES = [
    { id: 'PRESSURE_MANIPULATOR', name: 'Rempart', faction: 'akarlys', desc: 'Heavy cybernetic armor for deep sea exploration, massive glowing energy shield, sleek and powerful silhouette. Bioluminescent cyan lights.' },
    { id: 'BIO_SCOUT', name: 'Éclaireur', faction: 'akarlys', desc: 'Sleek bioluminescent suit, healer gadgets, glowing canisters, light armor for mobility.' },
    { id: 'CURRENT_BREAKER', name: 'Briseur', faction: 'akarlys', desc: 'Aerodynamic suit with hydro-jets, lightning conductors, high-speed combat gear.' },
    { id: 'AQUARYS_SHADOW', name: 'Ombre', faction: 'akarlys', desc: 'Stealth aquatic suit, dark translucent fabrics, twin energy daggers, masked face.' },
    { id: 'PARASITE_SOWER', name: 'Semeur', faction: 'zayan', desc: 'Alien biological armor with chitin plates, pulsing organic sacs, toxic green bioluminescence.' },
    { id: 'CANOPY_PROPHET', name: 'Prophète', faction: 'zayan', desc: 'Graceful alien robes with moving fungal patterns, staff of the Great Mycelium, meditative pose.' },
    { id: 'MYCELIUM_HOST', name: 'Hôte', faction: 'zayan', desc: 'Bulky organic tank, fused with giant mushroom structures, impenetrable fungal skin.' },
    { id: 'VENOM_STALKER', name: 'Traqueur', faction: 'zayan', desc: 'Four-legged arachnoid alien, venomous stingers, dark chitin, fast predatory silhouette.' },
    { id: 'PYRO_ALCHEMIST', name: 'Alchimiste', faction: 'mezalayis', desc: 'Mercenary with heat-resistant scrap armor, portable furnace, glowing jars of molten glass.' },
    { id: 'FLUX_SCAVENGER', name: 'Charognard', faction: 'mezalayis', desc: 'Junk-mech suit, multiple robotic arms for salvaging, glowing hazard stripes, industrial look.' },
    { id: 'DESERT_MIRAGE', name: 'Mirage', faction: 'mezalayis', desc: 'Lightweight desert cloak with integrated cloaking tech, shifting heat-haze effects, slender silhouette.' },
    { id: 'DUST_JUGGERNAUT', name: 'Juggernaut', faction: 'mezalayis', desc: 'Massive brick-like scrap armor, magnetic plating with attached metal debris, yellow hazard stripes.' }
];

const getPrompt = (cls, gender) => `
2D Dofus-style character sprite sheet for a ${gender} ${cls.name}. 
Thick black vector outlines, vibrant flat colors with sharp 2-stage cel-shading. 
${cls.desc}. 
Clean lineart, professional game asset.
Isolated on plain white background.
Planche of 32 sprites arranged on a 4x8 grid.
Rows represent 8 isometric directions: N, NE, E, SE, S, SW, W, NW.
Columns represent 4 frames of an Idle breathing animation.
Consistent proportions and centering for all 32 frames.
No text, no watermark, no blur, no background.
`;

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
            path: GENERATE_PATH,
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
                const r = JSON.parse(d);
                if (r.code === 200) resolve(r.data.taskId);
                else reject(r.msg);
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

async function waitTask(taskId) {
    for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const res = await new Promise((resolve, reject) => {
            https.get({
                hostname: API_HOST,
                path: `${RECORD_INFO_PATH}?taskId=${taskId}`,
                headers: { 'Authorization': `Bearer ${NANOBANANA_API_KEY}` }
            }, res => {
                let d = '';
                res.on('data', chunk => d += chunk);
                res.on('end', () => resolve(JSON.parse(d)));
            }).on('error', reject);
        });
        if (res.code === 200 && res.data?.successFlag === 1) {
            return res.data.response.resultImageUrl || res.data.response.originImageUrl;
        }
        if (res.data?.successFlag > 1) throw new Error("Task failed");
        process.stdout.write('.');
    }
    throw new Error("Timeout");
}

async function download(url, dest) {
    return new Promise((resolve, reject) => {
        https.get(url, res => {
            const file = fs.createWriteStream(dest);
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
        }).on('error', reject);
    });
}

async function run() {
    for (const cls of CLASSES) {
        for (const gender of ['Male', 'Female']) {
            const folder = path.join(OUTPUT_BASE, cls.faction);
            if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

            const fileName = `${cls.id.toLowerCase()}_${gender.toLowerCase()}_sheet.png`;
            const dest = path.join(folder, fileName);

            if (fs.existsSync(dest)) {
                console.log(`Skipping ${cls.name} ${gender} (exists)`);
                continue;
            }

            console.log(`Generating ${cls.name} ${gender}...`);
            try {
                const tid = await submitTask(getPrompt(cls, gender));
                const url = await waitTask(tid);
                await download(url, dest);
                console.log(` Done: ${fileName}`);
            } catch (e) {
                console.error(` Error: ${e}`);
            }
            await new Promise(r => setTimeout(r, DELAY));
        }
    }
}

run();
