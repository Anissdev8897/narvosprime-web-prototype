/**
 * 🎨 NARVOS PRIME - SPELL SPRITE GENERATOR
 * Génère automatiquement tous les sprites de sorts via l'API Nanobanana
 * 
 * Usage: node scripts/generateSpellSprites.mjs
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration API Nanobanana
const NANOBANANA_API_KEY = '78b6d9ece3ee4deedce978cf5b58eb80';
const OUTPUT_DIR = path.join(__dirname, '../public/textures/spells');

// Délai entre les requêtes pour éviter le rate limiting
const REQUEST_DELAY_MS = 5000;

// =====================================================
// DÉFINITIONS DES SPRITES DE SORTS (VERSION COURTE POUR TEST)
// =====================================================

const SPELL_SPRITES = [
    // ========== FACTION AKARLYS (HUMAINS) ==========
    {
        id: 'compression_sphere',
        name: 'Sphère de Compression',
        faction: 'AKARLYS',
        class: 'REMPART',
        prompt: `2D Dofus-style spell animation sprite sheet, isometric tactical RPG view. Spell: Compression Sphere - A massive pressurized water sphere. 8 frames horizontal strip, 256x256 per frame. Animation: Cyan energy gathers, swirling water forms translucent sphere, sphere expands with ripple distortion. Colors: Deep cyan #0891b2, Aqua glow #22d3ee, White highlights. Style: Dofus/Wakfu cartoon 2D, clean black outlines, transparent PNG background.`
    },
    {
        id: 'aqua_bolt',
        name: 'Aqua Bolt',
        faction: 'AKARLYS',
        class: 'REMPART',
        prompt: `2D Dofus-style projectile spell sprite sheet.  Spell: Aqua Bolt - Concentrated hydro-electric energy projectile. 6 frames horizontal, 128x128 per frame. Animation: Spiraling water droplets form, bolt launches with trailing particles, impact water explosion. Colors: Electric blue #3b82f6, Cyan #06b6d4. Style: Dofus 2D tactical game, sharp outlines, transparent background.`
    },
    {
        id: 'restoration_flash',
        name: 'Flash de Restauration',
        faction: 'AKARLYS',
        class: 'ECLAIREUR',
        prompt: `2D Dofus-style healing spell animation sprite sheet. Spell: Restoration Flash - Bioluminescent burst that heals allies. 6 frames horizontal, 256x256 per frame. Animation: Body glows with inner bioluminescence, bright white explosion, green/cyan healing orbs scatter. Colors: Bioluminescent cyan #67e8f9, Healing green #4ade80, Bright white flash. Style: Dofus support spell, transparent PNG.`
    },
    {
        id: 'infestation',
        name: 'Infestation',
        faction: 'ZAYAN',
        class: 'SEMEUR',
        prompt: `2D Dofus-style parasitic attack spell sprite sheet. Spell: Infestation - Launches spore that releases parasitic creatures. 8 frames horizontal, 192x192 per frame. Animation: Pulsating organic pod forms, pod launches trailing spores, pod impacts with purple veins spreading. Colors: Toxic purple #7c3aed, Organic green #4ade80. Style: Dofus alien organic, transparent background.`
    },
    {
        id: 'fungal_spore',
        name: 'Spore Putride',
        faction: 'ZAYAN',
        class: 'SEMEUR',
        prompt: `2D Dofus-style poison cloud AOE spell sprite sheet. Spell: Fungal Spore - Toxic spore cloud dealing damage. 6 frames horizontal, 256x256 per frame. Animation: Mushroom cap bursts releasing spores, cloud expands circular, toxic particles swirl. Colors: Spore cloud #a855f7, Toxic green #84cc16. Style: Dofus Sadida poison, transparent PNG.`
    },
    {
        id: 'glass_storm',
        name: 'Tempête de Verre',
        faction: 'MEZALAYIS',
        class: 'ALCHIMISTE',
        prompt: `2D Dofus-style elemental storm spell sprite sheet. Spell: Glass Storm - Sand transmutes into molten glass shards. 8 frames horizontal, 320x320 per frame. Animation: Sand rises glowing orange, glass shards swirl in violent vortex, shards fly outward. Colors: Molten orange #f97316, Glass shards #fef3c7. Style: Dofus fire aesthetic, transparent background.`
    },
    {
        id: 'thermal_distortion',
        name: 'Distorsion Thermique',
        faction: 'MEZALAYIS',
        class: 'MIRAGE',
        prompt: `2D Dofus-style clone stealth spell sprite sheet. Spell: Thermal Distortion - Creates decoy clones while becoming invisible. 8 frames horizontal, 256x256 per frame. Animation: Heat waves emanate, image splits into three versions, two clones solidify, original fades. Colors: Heat distortion #fbbf24, Clone outline #f97316. Style: Dofus Sram shadow clone, transparent background.`
    },
    {
        id: 'magnetite_plating',
        name: 'Blindage de Magnétite',
        faction: 'MEZALAYIS',
        class: 'JUGGERNAUT',
        prompt: `2D Dofus-style armor transformation spell sprite sheet. Spell: Magnetite Plating - Attracts metal debris to form heavy armor. 8 frames horizontal, 256x256 per frame. Animation: Magnetic field pulses, metal scraps fly toward caster, scraps attach forming armor plates. Colors: Metal gray #71717a, Magnetic blue #3b82f6. Style: Dofus Feca armor buf, transparent PNG.`
    },
    {
        id: 'monster_toxic_ray',
        name: 'Rayon Toxique (Boss)',
        faction: 'MONSTER',
        class: 'BOSS',
        prompt: `2D Dofus-style boss attack spell sprite sheet. Monster: Colossus Mushroom boss. Attack: Toxic Ray - Continuous poison beam. 8 frames, 384x384 per frame. Animation: Mushroom cap glows purple, beam charges, toxic ray fires wide cone. Colors: Boss purple #7c3aed, Toxic green #84cc16. Style: Dofus dungeon boss attack, transparent background.`
    },
    {
        id: 'monster_massive_leap',
        name: 'Saut Massif (Boss)',
        faction: 'MONSTER',
        class: 'BOSS',
        prompt: `2D Dofus-style ground pound attack sprite sheet. Monster: Giant Desert Toad boss. Attack: Massive Leap - Crushing jump AOE. 8 frames, 384x384 per frame. Animation: Toad crouches, leaps high, descending crash with shockwave dust. Colors: Toad yellow-brown #f59e0b, Impact dust #d97706. Style: Dofus heavy monster AOE, transparent PNG.`
    }
];

// =====================================================
// FONCTIONS API NANOBANANA
// =====================================================

/**
 * Génère une image via l'API Nanobanana
 */
async function generateImage(prompt) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            prompt: prompt,
            model: 'gemini-2.0-flash-exp',
            n: 1,
            size: '1024x1024',
            response_format: 'b64_json'
        });

        const options = {
            hostname: 'api.nanobanana.im',
            port: 443,
            path: '/v1/images/generations',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${NANOBANANA_API_KEY}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        console.log('   📡 Envoi de la requête API...');

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`   📥 Réponse reçue (${res.statusCode})`);

                try {
                    const response = JSON.parse(data);

                    if (res.statusCode !== 200) {
                        reject(new Error(response.error?.message || `HTTP ${res.statusCode}`));
                        return;
                    }

                    if (response.data && response.data[0]) {
                        resolve(response.data[0]);
                    } else if (response.error) {
                        reject(new Error(response.error.message || 'API Error'));
                    } else {
                        reject(new Error('Réponse invalide'));
                    }
                } catch (e) {
                    console.log('   ⚠️ Réponse brute:', data.substring(0, 200));
                    reject(new Error(`Parse error: ${e.message}`));
                }
            });
        });

        req.on('error', (e) => {
            reject(new Error(`Network error: ${e.message}`));
        });

        req.write(postData);
        req.end();
    });
}

/**
 * Télécharge une image depuis une URL
 */
function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Follow redirect
                https.get(response.headers.location, (res) => {
                    res.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve(filepath);
                    });
                });
            } else {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(filepath);
                });
            }
        }).on('error', (err) => {
            fs.unlink(filepath, () => { });
            reject(err);
        });
    });
}

/**
 * Sauvegarde une image base64
 */
function saveBase64Image(base64Data, filepath) {
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filepath, buffer);
    return filepath;
}

/**
 * Pause entre les requêtes
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =====================================================
// GÉNÉRATION PRINCIPALE
// =====================================================

async function generateAllSprites() {
    console.log('');
    console.log('🎨 ═══════════════════════════════════════════════════════');
    console.log('   NARVOS PRIME - SPELL SPRITE GENERATOR');
    console.log('   Using Nanobanana API (Gemini Image Generation)');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Créer le dossier de sortie
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`📁 Dossier créé: ${OUTPUT_DIR}\n`);
    }

    const results = {
        success: [],
        failed: []
    };

    console.log(`📊 Total sprites à générer: ${SPELL_SPRITES.length}\n`);
    console.log('─────────────────────────────────────────────────────────────\n');

    for (let i = 0; i < SPELL_SPRITES.length; i++) {
        const sprite = SPELL_SPRITES[i];
        const filename = `${sprite.id}.png`;
        const filepath = path.join(OUTPUT_DIR, filename);

        console.log(`[${i + 1}/${SPELL_SPRITES.length}] 🔄 Génération: ${sprite.name}`);
        console.log(`   Faction: ${sprite.faction} | Classe: ${sprite.class}`);

        try {
            // Appel API
            const result = await generateImage(sprite.prompt);

            // Sauvegarder l'image
            if (result.url) {
                console.log('   💾 Téléchargement de l\'image...');
                await downloadImage(result.url, filepath);
            } else if (result.b64_json) {
                console.log('   💾 Sauvegarde de l\'image base64...');
                saveBase64Image(result.b64_json, filepath);
            } else {
                throw new Error('Pas de données image dans la réponse');
            }

            console.log(`   ✅ Sauvegardé: ${filename}\n`);
            results.success.push({ id: sprite.id, name: sprite.name, file: filename });

        } catch (error) {
            console.log(`   ❌ Erreur: ${error.message}\n`);
            results.failed.push({ id: sprite.id, name: sprite.name, error: error.message });
        }

        // Pause entre les requêtes
        if (i < SPELL_SPRITES.length - 1) {
            console.log(`   ⏳ Pause ${REQUEST_DELAY_MS / 1000}s avant la prochaine génération...\n`);
            await sleep(REQUEST_DELAY_MS);
        }
    }

    // Rapport final
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   📊 RAPPORT DE GÉNÉRATION');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`✅ Succès: ${results.success.length}/${SPELL_SPRITES.length}`);
    console.log(`❌ Échecs: ${results.failed.length}/${SPELL_SPRITES.length}\n`);

    if (results.success.length > 0) {
        console.log('Sprites générés:');
        results.success.forEach(s => console.log(`   ✓ ${s.name} → ${s.file}`));
    }

    if (results.failed.length > 0) {
        console.log('\nSprites en échec:');
        results.failed.forEach(f => console.log(`   ✗ ${f.name}: ${f.error}`));
    }

    // Sauvegarder le rapport
    const reportPath = path.join(OUTPUT_DIR, 'generation_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Rapport sauvegardé: ${reportPath}`);

    console.log('\n🎮 Génération terminée!\n');

    return results;
}

// Lancer la génération
generateAllSprites().catch(console.error);
