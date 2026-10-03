/**
 * 🎮 NARVOS PRIME - COMPLETE ASSET GENERATOR
 * Génère TOUS les assets manquants : Maps, Donjons, Villes, Zones, Station
 * 
 * Usage: node scripts/generateAllAssets.mjs
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================================================
// 🔐 CONFIGURATION
// =====================================================

const NANOBANANA_API_KEY = '78b6d9ece3ee4deedce978cf5b58eb80';
const API_HOST = 'api.nanobananaapi.ai';
const GENERATE_PATH = '/api/v1/nanobanana/generate';
const RECORD_INFO_PATH = '/api/v1/nanobanana/record-info';

const BASE_OUTPUT_DIR = path.join(__dirname, '../public/textures');
const REQUEST_DELAY_MS = 5000;
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 40;

// =====================================================
// 🎨 ARTISTIC MANIFESTO (Dofus Style Strict)
// =====================
const DOFUS_STYLE_MAP_EXT = "2D pure vector art tactical map, Dofus 2.0 flash-animation style, clean thick black ink outlines, vibrant flat colors, 2-stage flat cel-shading, isometric 2:1 perspective, orthographic view. Defined levels with flat walkways and sharp cliff edges. High contrast, no gradients.";
const DOFUS_STYLE_MAP_INT = "2D pure vector art room, clean thick black ink outlines, vibrant flat colors with sharp cel-shading, isometric 2:1 perspective, grid-aligned, crisp lineart. Futuristic UI elements as decor.";
const DOFUS_STYLE_NEG = "text, labels, UI, watermark, blurry, gradient backgrounds, realistic, 3D render, photorealistic, messy lines, noisy textures, soft shadows, digital painting brushstrokes, airbrushed, depth blur, motion blur.";

const ASSET_STYLE_MAP = `${DOFUS_STYLE_MAP_EXT} Empty environment. No characters. No monsters.`;
const ASSET_STYLE_SPELL = "2D Dofus-style pure vector spell VFX, thick black outlines, vibrant flat colors, 2-stage cel-shading, isolated on transparent background.";
const ASSET_STYLE_DECOR = "2D Dofus-style isometric vector asset, thick black outlines, vibrant flat color blocks, sharp cel-shading, isolated on plain white background.";
const ASSET_STYLE_MONSTER = "2D Dofus-style monster sprite, thick black outlines, vibrant flat colors, sharp cel-shading, isolated on white background, sharp lineart.";
const ASSET_STYLE_ITEM = "2D Dofus-style game icon, thick black outlines, vibrant flat colors, sharp cel-shading, isolated on white background, professional vector icon.";

// =====================================================
// 📁 STRUCTURE DES DOSSIERS
// =====================================================

const FOLDER_STRUCTURE = {
    // Sprites de sorts par faction
    'spells/akarlys': [],
    'spells/zayan': [],
    'spells/mezalayis': [],
    'spells/monsters': [],

    // Personnages par faction
    'personnage/akarlys': [],
    'personnage/zayan': [],
    'personnage/mezalayis': [],

    // Maps AQUARYS (Humains - Aquatique)
    'dofus_maps/AQUARYS/ville': [],
    'dofus_maps/AQUARYS/exterieur_ville': [],
    'dofus_maps/AQUARYS/donjon': [],

    // Maps FUNGARIA (Aliens - Fongique)
    'dofus_maps/FUNGARIA/ville': [],
    'dofus_maps/FUNGARIA/exterieur_ville': [],
    'dofus_maps/FUNGARIA/donjon': [],

    // Maps DÉSERTICA (Mercenaires - Désert)
    'dofus_maps/DÉSERTICA/ville': [],
    'dofus_maps/DÉSERTICA/exterieur_ville': [],
    'dofus_maps/DÉSERTICA/donjon': [],

    // Station Spatiale
    'dofus_maps/Station_Spatiale/station': [],
    'dofus_maps/Station_Spatiale/interieur': [],
    'house_interieur/Station_Spatiale': [],

    // Décors par biome
    'decor/AQUARYS': [],
    'decor/FUNGARIA': [],
    'decor/DÉSERTICA': [],
    'decor/Station_Spatiale': [],

    // Objets d'inventaire
    'items/AQUARYS': [],
    'items/FUNGARIA': [],
    'items/DÉSERTICA': [],
    'items/Station_Spatiale': [],

    // Monstres
    'monstres/AQUARYS': [],
    'monstres/FUNGARIA': [],
    'monstres/DÉSERTICA': [],
    'monstres/Station_Spatiale': []
};

// =====================================================
// 🎨 DÉFINITIONS DES ASSETS À GÉNÉRER
// =====================================================

const ASSETS_TO_GENERATE = [
    // ========== ARKHALYS (ex-Aquarys) - FORÊT AQUATIQUE VILLE (10 instances) ==========
    ...Array.from({ length: 10 }, (_, i) => ({
        id: `aquarys_ville_${i + 1}`,
        name: `Arkhalys Forêt Ville ${i + 1}`,
        folder: 'dofus_maps/AQUARYS/ville',
        prompt: `${ASSET_STYLE_MAP} Arkhalys aquatic forest city. Giant kelp trunks as architectural pillars, flat coral platforms, tactical paths with bright neon blue moss. Futuristic pods with circular glass windows rendered as flat white highlights. Vibrant Teal and Dark Blue.`
    })),

    // ========== ARKHALYS - EXTÉRIEUR FORÊT (10 zones) ==========
    ...Array.from({ length: 10 }, (_, i) => ({
        id: `aquarys_exterior_${i + 1}`,
        name: `Arkhalys Forêt Extérieur ${i + 1}`,
        folder: 'dofus_maps/AQUARYS/exterieur_ville',
        prompt: `${ASSET_STYLE_MAP} Deep aquatic forest wilderness. Massive kelp stalks, underwater cliffs, rocky tactical terrain, bioluminescent algae paths. Deep ocean blue and lush cyan.`
    })),

    // ========== ARKHALYS - DONJON (5 salles) ==========
    ...Array.from({ length: 5 }, (_, i) => ({
        id: `aquarys_donjon_${i + 1}`,
        name: `Arkhalys Donjon Salle ${i + 1}`,
        folder: 'dofus_maps/AQUARYS/donjon',
        prompt: `${DOFUS_STYLE_MAP_INT} Sunken ruin within kelp roots. Ancient stone platforms, glowing organic vines, tactical pillars, empty ritual chamber. Dark navy and bioluminescent green.`
    })),

    // ========== FUNGARIA - VILLE (10 instances) ==========
    ...Array.from({ length: 10 }, (_, i) => ({
        id: `fungaria_ville_${i + 1}`,
        name: `Fungaria Ville ${i + 1}`,
        folder: 'dofus_maps/FUNGARIA/ville',
        prompt: `${ASSET_STYLE_MAP} Alien fungal city Fungaria. Buildings built into giant mushroom caps, suspended spore-bridges, layered mushroom shelves as platforms. Purple and neon green. No text.`
    })),

    // ========== FUNGARIA - EXTÉRIEUR VILLE (10 zones) ==========
    ...Array.from({ length: 10 }, (_, i) => ({
        id: `fungaria_exterior_${i + 1}`,
        name: `Fungaria Extérieur ${i + 1}`,
        folder: 'dofus_maps/FUNGARIA/exterieur_ville',
        prompt: `${ASSET_STYLE_MAP} Toxic fungal wilderness. Acid rivers with organic bone bridges, tiered mushroom fields, cliff-like giant stalks. Bioluminescent hazards, purple palette.`
    })),

    // ========== FUNGARIA - DONJON (5 salles) ==========
    ...Array.from({ length: 5 }, (_, i) => ({
        id: `fungaria_donjon_${i + 1}`,
        name: `Fungaria Donjon Salle ${i + 1}`,
        folder: 'dofus_maps/FUNGARIA/donjon',
        prompt: `${DOFUS_STYLE_MAP_INT} Organic alien hive chamber. Tiered circular platforms, pulsating egg sacs as obstacles, toxic slime falls, empty tactical room. Purple and light green.`
    })),

    // ========== DÉSERTICA - VILLE (10 instances) ==========
    ...Array.from({ length: 10 }, (_, i) => ({
        id: `desertica_ville_${i + 1}`,
        name: `Désertica Ville ${i + 1}`,
        folder: 'dofus_maps/DÉSERTICA/ville',
        prompt: `${ASSET_STYLE_MAP} Desert mercenary scrap town. Tiered flat metallic balconies, rusted iron mesas as cliffs, flat solar panels with sharp white highlights, catwalks. Industrial orange and charcoal gray. Sharp outlines.`
    })),

    // ========== DÉSERTICA - EXTÉRIEUR VILLE (10 zones) ==========
    ...Array.from({ length: 10 }, (_, i) => ({
        id: `desertica_exterior_${i + 1}`,
        name: `Désertica Extérieur ${i + 1}`,
        folder: 'dofus_maps/DÉSERTICA/exterieur_ville',
        prompt: `${ASSET_STYLE_MAP} Sandy wasteland. Rock mesas with natural staircases, dry canyons, tactical sand dunes, fossil bone obstacles. Vibrant orange and gold.`
    })),

    // ========== DÉSERTICA - DONJON (5 salles) ==========
    ...Array.from({ length: 5 }, (_, i) => ({
        id: `desertica_donjon_${i + 1}`,
        name: `Désertica Donjon Salle ${i + 1}`,
        folder: 'dofus_maps/DÉSERTICA/donjon',
        prompt: `${DOFUS_STYLE_MAP_INT} Buried sand temple. Tiered sandstone alters, crumbling columns as obstacles, torch-lit tactical paths, empty treasure chamber. Gold and brown.`
    })),

    // ========== STATION SPATIALE (5 instances) ==========
    ...Array.from({ length: 5 }, (_, i) => ({
        id: `station_spatiale_${i + 1}`,
        name: `Station Spatiale ${i + 1}`,
        folder: 'dofus_maps/Station_Spatiale/station',
        prompt: `${DOFUS_STYLE_MAP_INT} Sci-fi space station interior. Multi-level metallic grates, glowing holographic computer consoles as obstacles, futuristic airlocks, tactical floor mapping. Deep blue and steel gray.`
    })),

    // ========== SORTS MANQUANTS (de la liste originale) ==========
    {
        id: 'hydro_kinetic_wake',
        name: 'Sillage Hydro-Cinétique',
        folder: 'spells/akarlys',
        prompt: `${ASSET_STYLE_SPELL} Hydro-Kinetic Wake movement trail. Electrified water splash. 8 frames horizontal. Colors: water blue #0891b2, golden electricity.`
    },
    {
        id: 'bio_regen',
        name: 'Bio-Régénération',
        folder: 'spells/zayan',
        prompt: `${ASSET_STYLE_SPELL} Bio-Regeneration cellular heal pulse. Growing green spores. 6 frames horizontal. Colors: vibrant green #22c55e.`
    },
    {
        id: 'mycelium_trap',
        name: 'Piège Mycélien',
        folder: 'spells/zayan',
        prompt: `${ASSET_STYLE_SPELL} Mycelium Trap poison snare. Purple roots exploding. 8 frames horizontal. Colors: toxic purple #581c87, acid green.`
    },
    {
        id: 'combat_recycling',
        name: 'Recyclage de Combat',
        folder: 'spells/mezalayis',
        prompt: `${ASSET_STYLE_SPELL} Combat Recycling tool creation. Scanning cyan rays. 6 frames horizontal. Colors: industrial cyan #22d3ee, golden sparks.`
    },
    {
        id: 'sand_cloak',
        name: 'Cape de Sable',
        folder: 'spells/mezalayis',
        prompt: `${ASSET_STYLE_SPELL} Sand Cloak evasion aura. Swirling orange sand cloak. 6 frames horizontal. Colors: desert orange #fde68a.`
    },

    // ========== ATTAQUES MONSTRES MANQUANTES ==========
    {
        id: 'monster_spawn_minions',
        name: 'Spawn Minions Boss',
        folder: 'spells/monsters',
        prompt: `${ASSET_STYLE_SPELL} Boss minion spawn portal. Dark purple energy. 8 frames horizontal. Colors: void purple #7c3aed.`
    },
    {
        id: 'monster_quick_strikes',
        name: 'Coups Rapides Serpent',
        folder: 'spells/monsters',
        prompt: `${ASSET_STYLE_SPELL} Quick Strikes slash effect. Triple cyan claw arcs. 8 frames horizontal. Colors: bright cyan #0891b2.`
    },
    {
        id: 'monster_toxic_vomit',
        name: 'Vomissement Toxique',
        folder: 'spells/monsters',
        prompt: `${ASSET_STYLE_SPELL} Toxic Vomit splash hazard. Liquid green spray. 8 frames horizontal. Colors: lime green #a3e635.`
    },
    {
        id: 'monster_double_sting',
        name: 'Piqûres Doubles Scorpion',
        folder: 'spells/monsters',
        prompt: `${ASSET_STYLE_SPELL} Double Sting tail impact. Twin purple venom drops. 6 frames horizontal. Colors: venom purple #a855f7.`
    },
    {
        id: 'monster_tail_sweep',
        name: 'Balayage Queue Scorpion',
        folder: 'spells/monsters',
        prompt: `${ASSET_STYLE_SPELL} Tail Sweep circular impact. Dust explosion arc. 6 frames horizontal. Colors: sand brown #d97706.`
    },

    // ========== DÉCORS (ASSETS MODULAIRES) ==========
    {
        id: 'aquarys_crystal_spire',
        name: 'Pointe de Cristal Aqua',
        folder: 'decor/AQUARYS',
        prompt: `${ASSET_STYLE_DECOR} Large luminescent aqua crystal spire. Ancient technological markings. Blue and cyan.`
    },
    {
        id: 'fungaria_giant_mushroom',
        name: 'Champignon Géant Violet',
        folder: 'decor/FUNGARIA',
        prompt: `${ASSET_STYLE_DECOR} Towering alien mushroom tree. Glowing purple cap, thick organic stem. Purple and green.`
    },
    {
        id: 'desertica_scrap_barricade',
        name: 'Barricade de Récupération',
        folder: 'decor/DÉSERTICA',
        prompt: `${ASSET_STYLE_DECOR} Heavy metal barricade made of salvaged sci-fi plating. Rusted, yellow hazard stripes. Industrial gray.`
    },

    // ========== OBJETS D'INVENTAIRE (32x32) ==========
    {
        id: 'item_aqua_processor',
        name: 'Processeur Aqua',
        folder: 'items/AQUARYS',
        prompt: `${ASSET_STYLE_DECOR} Sci-fi underwater CPU unit. Hexagonal shape, glowing cyan lines. Inventory icon style.`
    },
    {
        id: 'item_fossil_spore',
        name: 'Spore Fossilisée',
        folder: 'items/FUNGARIA',
        prompt: `${ASSET_STYLE_ITEM} Rare crystallized fungal spore icon. Purple gem-like core.`
    },

    // ========== 🚀 EXPANSION : STATION SPATIALE (MISSING) ==========
    ...Array.from({ length: 3 }, (_, i) => ({
        id: `station_interieur_${i + 1}`,
        name: `Station Interieur Labo ${i + 1}`,
        folder: 'house_interieur/Station_Spatiale',
        prompt: `${DOFUS_STYLE_MAP_INT} High-tech laboratory module. Circular plasma tubes as walls, holographic floating desks, robotic arms on ceiling, tactical floor tiling. Sterile white and neon blue.`
    })),
    {
        id: 'station_decor_cryopod',
        name: 'Cryo-Pod de Survie',
        folder: 'decor/Station_Spatiale',
        prompt: `${ASSET_STYLE_DECOR} Sleek vertical cryogenic stasis pod. Frosty glass pane, glowing blue temperature display, mechanical pipes from back. White and cyan.`
    },
    {
        id: 'station_decor_plasma_reactor',
        name: 'Réacteur à Plasma',
        folder: 'decor/Station_Spatiale',
        prompt: `${ASSET_STYLE_DECOR} Core plasma generator. Large glass sphere filled with swirling light blue electricity, metallic hexagonal base. High-tech futuristic.`
    },
    {
        id: 'station_item_nano_medkit',
        name: 'Nano-Medkit',
        folder: 'items/Station_Spatiale',
        prompt: `${ASSET_STYLE_ITEM} Sci-fi medical kit. Modern white case with a glowing green cross symbol. Sleek futuristic design.`
    },
    {
        id: 'station_item_quantum_keycard',
        name: 'Passe Quantique',
        folder: 'items/Station_Spatiale',
        prompt: `${ASSET_STYLE_ITEM} Translucent glass security card. Floating data bits inside, holographic chip. Cyan and white.`
    },

    // ========== 👾 EXPANSION : MONSTRES (ORIGINAL IDEAS) ==========
    // --- ARKHALYS (Aquatic) ---
    {
        id: 'monster_aqua_squidbot',
        name: 'Squid-Bot Néon',
        folder: 'monstres/AQUARYS',
        prompt: `${ASSET_STYLE_MONSTER} Mechanical cyber-squid. Fiber-optic tentacles glowing bright blue, round central sensor eye. Floating in dynamic pose. Bioluminescent teal.`
    },
    {
        id: 'monster_aqua_coral_golem',
        name: 'Golem de Corail',
        folder: 'monstres/AQUARYS',
        prompt: `${ASSET_STYLE_MONSTER} Massive golem made of rocky coral and ancient machinery. Kelp-vines as hair, glowing cyan cores in chest. Earthy tones and bright blue.`
    },
    // --- FUNGARIA (Fungal) ---
    {
        id: 'monster_fungus_mantis',
        name: 'Mante Sporeuse',
        folder: 'monstres/FUNGARIA',
        prompt: `${ASSET_STYLE_MONSTER} Insectoid preying mantis with mushroom-cap armor. Toxic green spores leaking from joints, purple chitin shell. Aggressive dynamic pose.`
    },
    {
        id: 'monster_fungus_spore_beholder',
        name: 'Oeil Fongique',
        folder: 'monstres/FUNGARIA',
        prompt: `${ASSET_STYLE_MONSTER} Floating alien eye surrounded by pulsating mushroom growths. Toxic purple fumes, multiple tiny stalks. Vibrant purple and lime green.`
    },
    // --- DÉSERTICA (Sand) ---
    {
        id: 'monster_desert_scrap_scorpion',
        name: 'Scorpion de Feraille',
        folder: 'monstres/DÉSERTICA',
        prompt: `${ASSET_STYLE_MONSTER} Gigantic mechanical scorpion built from rusty spaceship parts. Orange solar-panel tail, obsidian crystal sting. Industrial orange and black.`
    },
    {
        id: 'monster_desert_rust_vulture',
        name: 'Vautour de Rouille',
        folder: 'monstres/DÉSERTICA',
        prompt: `${ASSET_STYLE_MONSTER} Cybernetic bird of prey. Metallic wings with sharp edges, camera lens as eye, rusted plating. Menacing flying pose. Dark brown and orange.`
    },
    // --- STATION SPATIALE ---
    {
        id: 'monster_station_security_bot',
        name: 'Dofus-Droid de Sécurité',
        folder: 'monstres/Station_Spatiale',
        prompt: `${ASSET_STYLE_MONSTER} Bipedal guard robot. Spherical head, chunky armor plating, electric baton in hand. White and red color scheme. Guarding pose.`
    },
    {
        id: 'monster_station_glitch_wraith',
        name: 'Spectre de Code',
        folder: 'monstres/Station_Spatiale',
        prompt: `${ASSET_STYLE_MONSTER} Ethereal ghost-like being made of glitchy blue plasma. Floating digital artifacts around it, faceless. Neon blue and deep black.`
    },

    // ========== 🏠 EXPANSION : INTÉRIEURS & DÉCORS ORIGINAUX ==========
    {
        id: 'arkhalys_interior_library',
        name: 'Bibliothèque de Corail',
        folder: 'house_interieur/AQUARYS',
        prompt: `${DOFUS_STYLE_MAP_INT} Underwater library. Bookcases carved from massive white coral, floating scrolls in stasis bubbles, soft bioluminescent desk lamps. Peaceful atmosphere.`
    },
    {
        id: 'fungaria_decor_radio_mushroom',
        name: 'Antenne Champignon',
        folder: 'decor/FUNGARIA',
        prompt: `${ASSET_STYLE_DECOR} High-tech fungal antenna. Giant mushroom cap with metallic discs and glowing purple wires. Communication device for aliens.`
    },
    {
        id: 'desertica_decor_solar_forja',
        name: 'Forge Solaire',
        folder: 'decor/DÉSERTICA',
        prompt: `${ASSET_STYLE_DECOR} Massive parabolic mirror focusing light onto a black anvil. Rusted scrap structure, orange glowing metal. Industrial desert style.`
    }
];

// =====================================================
// 🔧 FONCTIONS API
// =====================================================

async function submitGenerationTask(prompt) {
    return new Promise((resolve, reject) => {
        const requestBody = JSON.stringify({
            prompt: `${prompt} Negative prompt: ${DOFUS_STYLE_NEG}`,
            numImages: 1,
            type: 'TEXTTOIAMGE',
            image_size: '1:1',
            callBackUrl: 'https://example.com/callback'
        });

        const options = {
            hostname: API_HOST,
            port: 443,
            path: GENERATE_PATH,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${NANOBANANA_API_KEY}`,
                'Content-Length': Buffer.byteLength(requestBody)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.code === 200 && response.data?.taskId) {
                        resolve(response.data.taskId);
                    } else {
                        reject(new Error(response.msg || `Code ${response.code}`));
                    }
                } catch (e) {
                    reject(new Error(`Parse: ${e.message}`));
                }
            });
        });

        req.on('error', e => reject(new Error(`Network: ${e.message}`)));
        req.write(requestBody);
        req.end();
    });
}

async function getTaskStatus(taskId) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_HOST,
            port: 443,
            path: `${RECORD_INFO_PATH}?taskId=${taskId}`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${NANOBANANA_API_KEY}` }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Parse: ${e.message}`));
                }
            });
        });

        req.on('error', e => reject(new Error(`Network: ${e.message}`)));
        req.end();
    });
}

async function waitForTaskCompletion(taskId) {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        await sleep(POLL_INTERVAL_MS);

        try {
            const response = await getTaskStatus(taskId);

            if (response.code === 200 && response.data) {
                const { successFlag, response: taskResponse, errorMessage } = response.data;

                if (successFlag === 1) {
                    const imageUrl = taskResponse?.resultImageUrl || taskResponse?.originImageUrl;
                    if (imageUrl) return imageUrl;
                    throw new Error('Pas d\'URL image');
                }

                if (successFlag === 2 || successFlag === 3) {
                    throw new Error(errorMessage || `Échec (${successFlag})`);
                }

                process.stdout.write(`\r   ⏳ (${attempt + 1}/${MAX_POLL_ATTEMPTS})  `);
            }
        } catch (e) {
            if (e.message.includes('Échec') || e.message.includes('URL')) throw e;
        }
    }

    throw new Error('Timeout');
}

function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const makeRequest = (urlString, redirectCount = 0) => {
            if (redirectCount > 5) { reject(new Error('Trop de redirections')); return; }

            const urlObj = new URL(urlString);
            const protocol = urlObj.protocol === 'https:' ? https : require('http');

            protocol.get(urlString, (response) => {
                if ([301, 302, 307].includes(response.statusCode)) {
                    makeRequest(response.headers.location, redirectCount + 1);
                    return;
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }

                const file = fs.createWriteStream(filepath);
                response.pipe(file);
                file.on('finish', () => { file.close(); resolve(filepath); });
                file.on('error', (err) => { fs.unlink(filepath, () => { }); reject(err); });
            }).on('error', reject);
        };

        makeRequest(url);
    });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// =====================================================
// 🚀 GÉNÉRATION PRINCIPALE
// =====================================================

async function main() {
    console.log('\n🎮 ═══════════════════════════════════════════════════════');
    console.log('   NARVOS PRIME - COMPLETE ASSET GENERATOR');
    console.log('   Maps, Donjons, Villes, Zones, Station + Sorts');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Créer tous les dossiers
    console.log('📁 Création de la structure de dossiers...\n');
    for (const folder of Object.keys(FOLDER_STRUCTURE)) {
        const fullPath = path.join(BASE_OUTPUT_DIR, folder);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
            console.log(`   ✓ ${folder}`);
        }
    }
    console.log('\n');

    const results = { success: [], failed: [], skipped: [] };
    console.log(`📊 Total assets à générer: ${ASSETS_TO_GENERATE.length}\n`);
    console.log('─'.repeat(60) + '\n');

    for (let i = 0; i < ASSETS_TO_GENERATE.length; i++) {
        const asset = ASSETS_TO_GENERATE[i];
        const filename = `${asset.id}.png`;
        const folderPath = path.join(BASE_OUTPUT_DIR, asset.folder);
        const filepath = path.join(folderPath, filename);

        // Vérifier si le fichier existe déjà
        if (fs.existsSync(filepath)) {
            console.log(`[${i + 1}/${ASSETS_TO_GENERATE.length}] ⏭️ ${asset.name} (existe déjà)`);
            results.skipped.push({ id: asset.id, name: asset.name });
            continue;
        }

        console.log(`\n[${i + 1}/${ASSETS_TO_GENERATE.length}] 🔄 ${asset.name}`);
        console.log(`   📂 ${asset.folder}`);

        try {
            const taskId = await submitGenerationTask(asset.prompt);
            console.log(`   🎫 Task: ${taskId.substring(0, 20)}...`);

            const imageUrl = await waitForTaskCompletion(taskId);
            console.log(`\n   ✓ Génération OK`);

            await downloadImage(imageUrl, filepath);
            const stats = fs.statSync(filepath);
            console.log(`   💾 ${filename} (${(stats.size / 1024).toFixed(1)} KB)`);

            results.success.push({ id: asset.id, name: asset.name, file: filepath });
            console.log(`   ✅ SUCCÈS!`);

        } catch (error) {
            console.log(`\n   ❌ ${error.message}`);
            results.failed.push({ id: asset.id, name: asset.name, error: error.message });
        }

        if (i < ASSETS_TO_GENERATE.length - 1) {
            await sleep(REQUEST_DELAY_MS);
        }
    }

    // Rapport final
    console.log('\n\n' + '═'.repeat(60));
    console.log('   📊 RAPPORT FINAL');
    console.log('═'.repeat(60) + '\n');
    console.log(`✅ Succès:  ${results.success.length}`);
    console.log(`⏭️ Déjà existants: ${results.skipped.length}`);
    console.log(`❌ Échecs:  ${results.failed.length}`);
    console.log(`📊 Total:   ${ASSETS_TO_GENERATE.length}\n`);

    // Sauvegarder rapport
    const reportPath = path.join(BASE_OUTPUT_DIR, 'complete_generation_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`📄 Rapport: ${reportPath}`);

    console.log('\n🎮 Génération terminée!\n');
}

main().catch(console.error);
