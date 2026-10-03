/**
 * 🎨 NARVOS PRIME - SPELL SPRITE GENERATOR v2
 * Génère automatiquement tous les sprites de sorts via l'API NanoBanana
 * 
 * Documentation API: https://docs.nanobananaapi.ai/nanobanana-api/generate-or-edit-image
 * 
 * Usage: node scripts/generateSpellSprites-nanobanana.mjs
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================================================
// 🔐 CONFIGURATION API NANOBANANA
// =====================================================

const NANOBANANA_API_KEY = '78b6d9ece3ee4deedce978cf5b58eb80';
const API_HOST = 'api.nanobananaapi.ai';
const GENERATE_PATH = '/api/v1/nanobanana/generate';
const RECORD_INFO_PATH = '/api/v1/nanobanana/record-info';

const OUTPUT_DIR = path.join(__dirname, '../public/textures/spells');
const REQUEST_DELAY_MS = 5000;
const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 40; // ~3 minutes max

// =====================================================
// 🎯 DÉFINITIONS DES SPRITES DE SORTS
// =====================================================

const SPELL_SPRITES = [
    // ========== FACTION AKARLYS ==========
    {
        id: 'compression_sphere',
        name: 'Sphère de Compression',
        prompt: `2D Dofus-style spell sprite sheet, isometric tactical RPG. Compression Sphere water spell. 8 frames horizontal, 256x256 each. Cyan energy gathers, water sphere forms and expands. Colors: cyan #0891b2, aqua #22d3ee. Dofus cartoon style, transparent background PNG.`
    },
    {
        id: 'aqua_bolt',
        name: 'Aqua Bolt',
        prompt: `2D Dofus-style projectile sprite sheet. Aqua Bolt electric water projectile. 6 frames horizontal, 128x128 each. Water bolt forms, launches with particles, impact explosion. Colors: blue #3b82f6, cyan #06b6d4. Dofus cartoon, transparent PNG.`
    },
    {
        id: 'restoration_flash',
        name: 'Flash de Restauration',
        prompt: `2D Dofus-style healing spell sprite sheet. Restoration Flash bioluminescent burst. 6 frames horizontal, 256x256 each. Body glows, bright flash, healing orbs scatter. Colors: cyan #67e8f9, green #4ade80. Dofus support magic, transparent PNG.`
    },
    {
        id: 'hydro_shield',
        name: 'Bouclier Hydro',
        prompt: `2D Dofus-style shield spell sprite sheet. Hydro Shield water dome barrier. 6 frames horizontal, 192x192 each. Water rises, forms dome, hexagonal pattern. Colors: aqua #22d3ee, blue #0ea5e9. Dofus barrier magic, transparent PNG.`
    },

    // ========== FACTION ZAYAN ==========
    {
        id: 'infestation',
        name: 'Infestation',
        prompt: `2D Dofus-style parasitic spell sprite sheet. Infestation spore attack. 8 frames horizontal, 192x192 each. Pod forms, launches spores, impacts spreading veins, bugs emerge. Colors: purple #7c3aed, green #4ade80. Dofus alien style, transparent PNG.`
    },
    {
        id: 'fungal_spore',
        name: 'Spore Putride',
        prompt: `2D Dofus-style poison cloud sprite sheet. Fungal Spore toxin AOE. 6 frames horizontal, 256x256 each. Mushroom bursts, spore cloud expands, particles swirl. Colors: purple #a855f7, green #84cc16. Dofus poison magic, transparent PNG.`
    },
    {
        id: 'nervous_symbiosis',
        name: 'Symbiose Nerveuse',
        prompt: `2D Dofus-style link spell sprite sheet. Nervous Symbiosis neural connection. 8 frames horizontal, 320x192 each. Tendrils extend, travel to ally, link established with pulses. Colors: purple #c084fc, green #4ade80. Dofus support link, transparent PNG.`
    },
    {
        id: 'transplantation',
        name: 'Transplantation',
        prompt: `2D Dofus-style burrow spell sprite sheet. Transplantation underground attack. 8 frames horizontal, 256x256 each. Caster sinks into ground, dust on surface, roots emerge at target. Colors: brown #78350f, purple #7c3aed. Dofus earth magic, transparent PNG.`
    },

    // ========== FACTION MEZALAYIS ==========
    {
        id: 'glass_storm',
        name: 'Tempête de Verre',
        prompt: `2D Dofus-style elemental storm sprite sheet. Glass Storm sand to glass attack. 8 frames horizontal, 320x320 each. Sand rises glowing, transforms to glass, shards swirl and fly. Colors: orange #f97316, cream #fef3c7. Dofus fire magic, transparent PNG.`
    },
    {
        id: 'scrap_shot',
        name: 'Tir de Ferraille',
        prompt: `2D Dofus-style projectile sprite sheet. Scrap Shot metal debris blast. 6 frames horizontal, 192x128 each. Scraps gather, compress, fire with trail, shrapnel impact. Colors: rust #b45309, blue #3b82f6. Dofus industrial attack, transparent PNG.`
    },
    {
        id: 'thermal_distortion',
        name: 'Distorsion Thermique',
        prompt: `2D Dofus-style clone spell sprite sheet. Thermal Distortion heat clones. 8 frames horizontal, 256x256 each. Heat waves, image splits into three, clones solidify, original fades. Colors: yellow #fbbf24, orange #f97316. Dofus illusion magic, transparent PNG.`
    },
    {
        id: 'magnetite_plating',
        name: 'Blindage de Magnétite',
        prompt: `2D Dofus-style armor spell sprite sheet. Magnetite Plating metal armor buff. 8 frames horizontal, 256x256 each. Magnetic pulse, scraps fly to caster, form armor plates. Colors: gray #71717a, blue #3b82f6. Dofus tank buff, transparent PNG.`
    },

    // ========== MONSTRES ==========
    {
        id: 'monster_toxic_ray',
        name: 'Rayon Toxique Boss',
        prompt: `2D Dofus-style boss attack sprite sheet. Toxic Ray mushroom boss beam. 8 frames horizontal, 384x384 each. Giant mushroom glows, beam charges, fires wide toxic ray. Colors: purple #7c3aed, green #84cc16. Dofus boss attack, transparent PNG.`
    },
    {
        id: 'monster_massive_leap',
        name: 'Saut Massif Boss',
        prompt: `2D Dofus-style boss attack sprite sheet. Massive Leap toad ground pound. 8 frames horizontal, 384x384 each. Toad crouches, jumps high, crashes down with shockwave. Colors: amber #f59e0b, brown #d97706. Dofus heavy attack, transparent PNG.`
    }
];

// =====================================================
// 🔧 FONCTIONS API NANOBANANA
// =====================================================

/**
 * Soumet une tâche de génération d'image
 */
async function submitGenerationTask(prompt) {
    return new Promise((resolve, reject) => {
        const requestBody = JSON.stringify({
            prompt: prompt,
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

        console.log('   📡 Soumission tâche...');

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`   📥 HTTP ${res.statusCode}`);

                try {
                    const response = JSON.parse(data);
                    console.log(`   📋 Response:`, JSON.stringify(response).substring(0, 150));

                    if (response.code === 200 && response.data?.taskId) {
                        console.log(`   🎫 TaskID: ${response.data.taskId}`);
                        resolve(response.data.taskId);
                    } else {
                        reject(new Error(response.msg || `Code ${response.code}`));
                    }
                } catch (e) {
                    console.log('   ⚠️ Raw:', data.substring(0, 300));
                    reject(new Error(`Parse: ${e.message}`));
                }
            });
        });

        req.on('error', e => reject(new Error(`Network: ${e.message}`)));
        req.write(requestBody);
        req.end();
    });
}

/**
 * Vérifie le statut d'une tâche via record-info
 */
async function getTaskStatus(taskId) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_HOST,
            port: 443,
            path: `${RECORD_INFO_PATH}?taskId=${taskId}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${NANOBANANA_API_KEY}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve(response);
                } catch (e) {
                    reject(new Error(`Parse: ${e.message}`));
                }
            });
        });

        req.on('error', e => reject(new Error(`Network: ${e.message}`)));
        req.end();
    });
}

/**
 * Attend qu'une tâche soit terminée
 * successFlag: 0=GENERATING, 1=SUCCESS, 2=CREATE_FAILED, 3=GENERATE_FAILED
 */
async function waitForTaskCompletion(taskId) {
    console.log('   ⏳ Attente génération...');

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        await sleep(POLL_INTERVAL_MS);

        try {
            const response = await getTaskStatus(taskId);

            // Debug log
            if (attempt === 0 || attempt % 5 === 0) {
                console.log(`   📊 Status (${attempt + 1}/${MAX_POLL_ATTEMPTS}):`, JSON.stringify(response.data || response).substring(0, 200));
            }

            if (response.code === 200 && response.data) {
                const { successFlag, response: taskResponse, errorMessage } = response.data;

                // SUCCESS
                if (successFlag === 1) {
                    const imageUrl = taskResponse?.resultImageUrl || taskResponse?.originImageUrl;
                    if (imageUrl) {
                        console.log(`\n   ✓ Génération terminée!`);
                        console.log(`   🔗 URL: ${imageUrl.substring(0, 80)}...`);
                        return imageUrl;
                    }
                    throw new Error('Pas d\'URL image dans la réponse');
                }

                // FAILED
                if (successFlag === 2 || successFlag === 3) {
                    throw new Error(errorMessage || `Échec (code ${successFlag})`);
                }

                // GENERATING (0) - continuer à attendre
                process.stdout.write(`\r   ⏳ Génération en cours... (${attempt + 1}/${MAX_POLL_ATTEMPTS})  `);
            }
        } catch (e) {
            if (e.message.includes('Échec') || e.message.includes('Pas d\'URL')) {
                throw e;
            }
            // Erreur temporaire, continuer
            console.log(`   ⚠️ Erreur poll: ${e.message}`);
        }
    }

    throw new Error('Timeout - génération trop longue');
}

/**
 * Télécharge une image depuis une URL
 */
function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        console.log(`   💾 Téléchargement...`);

        const makeRequest = (urlString, redirectCount = 0) => {
            if (redirectCount > 5) {
                reject(new Error('Trop de redirections'));
                return;
            }

            const urlObj = new URL(urlString);
            const protocol = urlObj.protocol === 'https:' ? https : require('http');

            protocol.get(urlString, (response) => {
                // Suivre les redirections
                if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
                    console.log(`   ↪️ Redirection vers: ${response.headers.location?.substring(0, 50)}...`);
                    makeRequest(response.headers.location, redirectCount + 1);
                    return;
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }

                const file = fs.createWriteStream(filepath);
                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    const stats = fs.statSync(filepath);
                    console.log(`   ✓ Sauvé: ${path.basename(filepath)} (${(stats.size / 1024).toFixed(1)} KB)`);
                    resolve(filepath);
                });

                file.on('error', (err) => {
                    fs.unlink(filepath, () => { });
                    reject(err);
                });
            }).on('error', (err) => {
                reject(new Error(`Download: ${err.message}`));
            });
        };

        makeRequest(url);
    });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// =====================================================
// 🚀 GÉNÉRATION PRINCIPALE
// =====================================================

async function main() {
    console.log('\n🎨 ═══════════════════════════════════════════════════════');
    console.log('   NARVOS PRIME - SPELL SPRITE GENERATOR v2');
    console.log('   Using NanoBanana API (nanobananaapi.ai)');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`🔑 API Key: ${NANOBANANA_API_KEY.substring(0, 8)}...`);
    console.log(`📁 Output: ${OUTPUT_DIR}\n`);

    // Créer dossier de sortie
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`📁 Dossier créé!\n`);
    }

    const results = { success: [], failed: [] };
    console.log(`📊 Total: ${SPELL_SPRITES.length} sprites à générer\n`);
    console.log('─'.repeat(60) + '\n');

    for (let i = 0; i < SPELL_SPRITES.length; i++) {
        const sprite = SPELL_SPRITES[i];
        const filename = `${sprite.id}.png`;
        const filepath = path.join(OUTPUT_DIR, filename);

        console.log(`\n[${i + 1}/${SPELL_SPRITES.length}] 🔄 ${sprite.name}`);
        console.log('─'.repeat(40));

        try {
            // 1. Soumettre la tâche
            const taskId = await submitGenerationTask(sprite.prompt);

            // 2. Attendre la complétion
            const imageUrl = await waitForTaskCompletion(taskId);

            // 3. Télécharger l'image
            await downloadImage(imageUrl, filepath);

            results.success.push({ id: sprite.id, name: sprite.name, file: filename });
            console.log(`   ✅ SUCCÈS!\n`);

        } catch (error) {
            console.log(`\n   ❌ ERREUR: ${error.message}\n`);
            results.failed.push({ id: sprite.id, name: sprite.name, error: error.message });
        }

        // Pause entre les requêtes
        if (i < SPELL_SPRITES.length - 1) {
            console.log(`   ⏸️ Pause ${REQUEST_DELAY_MS / 1000}s avant le prochain...\n`);
            await sleep(REQUEST_DELAY_MS);
        }
    }

    // Rapport final
    console.log('\n' + '═'.repeat(60));
    console.log('   📊 RAPPORT FINAL');
    console.log('═'.repeat(60) + '\n');
    console.log(`✅ Succès: ${results.success.length}/${SPELL_SPRITES.length}`);
    console.log(`❌ Échecs: ${results.failed.length}/${SPELL_SPRITES.length}\n`);

    if (results.success.length > 0) {
        console.log('📦 Sprites générés:');
        results.success.forEach(s => console.log(`  ✓ ${s.file}`));
    }

    if (results.failed.length > 0) {
        console.log('\n⚠️ Échecs:');
        results.failed.forEach(f => console.log(`  ✗ ${f.name}: ${f.error}`));
    }

    // Sauvegarder rapport
    const reportPath = path.join(OUTPUT_DIR, 'generation_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Rapport: ${reportPath}`);

    console.log('\n🎮 Terminé!\n');
}

main().catch(console.error);
