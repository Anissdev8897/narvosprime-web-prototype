/**
 * 🎨 NARVOS PRIME - SPELL SPRITE GENERATOR
 * Génère automatiquement tous les sprites de sorts via l'API Nanobanana
 * 
 * Usage: node scripts/generateSpellSprites.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration API Nanobanana
const NANOBANANA_API_KEY = '78b6d9ece3ee4deedce978cf5b58eb80';
const API_BASE_URL = 'https://api.nanobanana.im/v1';
const OUTPUT_DIR = path.join(__dirname, '../public/textures/spells');

// Délai entre les requêtes pour éviter le rate limiting
const REQUEST_DELAY_MS = 3000;

// =====================================================
// DÉFINITIONS DES SPRITES DE SORTS
// =====================================================

const SPELL_SPRITES = [
    // ========== FACTION AKARLYS (HUMAINS) ==========
    {
        id: 'compression_sphere',
        name: 'Sphère de Compression',
        faction: 'AKARLYS',
        class: 'REMPART',
        prompt: `2D Dofus-style spell animation sprite sheet, isometric tactical RPG view. 
Spell: Compression Sphere - A massive pressurized water sphere that slows projectiles.
12 frames horizontal strip, 256x256 per frame.
Animation: Cyan energy gathers, swirling water forms translucent sphere, sphere expands with ripple distortion, internal plasma currents pulse.
Colors: Deep cyan #0891b2, Aqua glow #22d3ee, White highlights #f0fdff.
Style: Dofus/Wakfu cartoon 2D, clean black outlines, dynamic water energy effects.
Transparent PNG background, game-ready sprite sheet.`,
        width: 3072,
        height: 256
    },
    {
        id: 'aqua_bolt',
        name: 'Aqua Bolt',
        faction: 'AKARLYS',
        class: 'REMPART',
        prompt: `2D Dofus-style projectile spell sprite sheet, isometric view.
Spell: Aqua Bolt - Concentrated hydro-electric energy projectile.
8 frames horizontal, 128x128 per frame.
Animation: Spiraling water droplets form, bolt launches with trailing particles, mid-flight electric arcs, impact water explosion.
Colors: Electric blue #3b82f6, Cyan #06b6d4, White lightning.
Projectile shape: Elongated teardrop with spiral tail.
Style: Dofus 2D tactical game, sharp outlines, transparent background.`,
        width: 1024,
        height: 128
    },
    {
        id: 'restoration_flash',
        name: 'Flash de Restauration',
        faction: 'AKARLYS',
        class: 'ECLAIREUR',
        prompt: `2D Dofus-style healing spell animation sprite sheet.
Spell: Restoration Flash - Bioluminescent burst that heals allies.
10 frames horizontal, 256x256 per frame.
Animation: Body glows with inner bioluminescence, light intensifies, bright white explosion, green/cyan healing orbs scatter, gentle fade with sparkles.
Colors: Bioluminescent cyan #67e8f9, Healing green #4ade80, Bright white flash.
Effects: Radial light rays, floating healing orbs, sparkle particles.
Style: Dofus support spell, transparent PNG.`,
        width: 2560,
        height: 256
    },
    {
        id: 'hydro_shield',
        name: 'Bouclier Hydro',
        faction: 'AKARLYS',
        class: 'ECLAIREUR',
        prompt: `2D Dofus-style defensive barrier spell sprite sheet.
Spell: Hydro Shield - Protective water plasma dome.
8 frames horizontal, 192x192 per frame.
Animation: Water rises in circular pattern, streams merge into dome, shield solidifies with hexagonal pattern, stable flowing water.
Colors: Semi-transparent aqua #22d3ee, Shield edge glow #0ea5e9.
60% transparent shield body, 100% opaque edges.
Style: Dofus protective magic bubble, transparent background.`,
        width: 1536,
        height: 192
    },
    {
        id: 'hydro_kinetic_wake',
        name: 'Sillage Hydro-Cinétique',
        faction: 'AKARLYS',
        class: 'BRISEUR',
        prompt: `2D Dofus-style movement trail spell sprite sheet.
Spell: Hydro-Kinetic Wake - Electrified water trail that paralyzes.
12 frames horizontal, 320x128 per frame.
Animation: Character dashes leaving water splashes, electric current forms in wake, lightning arcs between droplets, trail fades with sparks.
Colors: Water trail #0891b2, Electric arcs #fbbf24, Paralysis purple #a855f7.
Trail shape: Curved wake with zigzag electricity.
Style: Dofus speed effect, transparent PNG.`,
        width: 3840,
        height: 128
    },

    // ========== FACTION ZAYAN (ALIENS) ==========
    {
        id: 'infestation',
        name: 'Infestation',
        faction: 'ZAYAN',
        class: 'SEMEUR',
        prompt: `2D Dofus-style parasitic attack spell sprite sheet.
Spell: Infestation - Launches spore that releases parasitic creatures.
16 frames horizontal, 192x192 per frame.
Animation: Pulsating organic pod forms, pod launches trailing spores, pod impacts and burrows (purple veins spread), small parasitic bugs emerge.
Colors: Toxic purple #7c3aed, Organic green #4ade80, Corruption veins #581c87.
Small crawling insects with glowing eyes.
Style: Dofus alien organic horror, transparent background.`,
        width: 3072,
        height: 192
    },
    {
        id: 'fungal_spore',
        name: 'Spore Putride',
        faction: 'ZAYAN',
        class: 'SEMEUR',
        prompt: `2D Dofus-style poison cloud AOE spell sprite sheet.
Spell: Fungal Spore - Toxic spore cloud dealing damage over time.
10 frames horizontal, 256x256 per frame.
Animation: Mushroom cap emerges, cap bursts releasing spores, cloud expands circular, toxic particles swirl, cloud dissipates.
Colors: Spore cloud #a855f7, Toxic green particles #84cc16, Mushroom brown #92400e.
Billowing organic cloud with floating spores.
Style: Dofus Sadida-inspired poison, transparent PNG.`,
        width: 2560,
        height: 256
    },
    {
        id: 'nervous_symbiosis',
        name: 'Symbiose Nerveuse',
        faction: 'ZAYAN',
        class: 'PROPHETE',
        prompt: `2D Dofus-style neural link spell sprite sheet.
Spell: Nervous Symbiosis - Creates neural link to share damage.
12 frames horizontal, 320x192 per frame.
Animation: Mycelia tendrils extend from caster, tendrils travel across ground, connection established with glowing network, pulsing link with particles.
Colors: Neural purple #c084fc, Connection glow #4ade80, Pulse energy #f0abfc.
Organic vein-like tendrils with glowing nodes.
Style: Dofus support link spell, transparent background.`,
        width: 3840,
        height: 192
    },
    {
        id: 'bio_regen',
        name: 'Bio-Régénération',
        faction: 'ZAYAN',
        class: 'PROPHETE',
        prompt: `2D Dofus-style regeneration healing spell sprite sheet.
Spell: Bio-Regeneration - Accelerated cellular healing.
8 frames horizontal, 192x192 per frame.
Animation: Green organic energy spirals around target, cellular particles multiply, healing wave pulses, body glows briefly.
Colors: Healing green #22c55e, Bio-energy cyan #2dd4bf, Cell particles #86efac.
Style: Organic healing magic, Dofus Eniripsa-inspired, transparent PNG.`,
        width: 1536,
        height: 192
    },
    {
        id: 'transplantation',
        name: 'Transplantation',
        faction: 'ZAYAN',
        class: 'HOTE',
        prompt: `2D Dofus-style underground movement spell sprite sheet.
Spell: Transplantation - Burrow and emerge beneath enemy.
16 frames horizontal, 256x256 per frame.
Animation: Caster sinks with roots pulling down, underground dust on surface, roots burst at target location, caster emerges entangling target.
Colors: Earth brown #78350f, Root purple #7c3aed, Entangle glow #c084fc.
Dirt particles, organic tendrils, ground cracks.
Style: Dofus earth movement spell, transparent background.`,
        width: 4096,
        height: 256
    },
    {
        id: 'mycelium_trap',
        name: 'Piège Mycélien',
        faction: 'ZAYAN',
        class: 'HOTE',
        prompt: `2D Dofus-style trap spell sprite sheet.
Spell: Mycelium Trap - Invisible trap that immobilizes and poisons.
12 frames horizontal, 192x192 per frame.
Animation: Faint spore cloud settles (nearly invisible), enemy triggers, roots explode from ground, roots wrap around legs, poison emanates.
Colors: Almost invisible purple #7c3aed20, Roots #581c87, Poison #a3e635.
Hidden state: Very subtle shimmer only.
Style: Dofus Sram trap with organic twist, transparent PNG.`,
        width: 2304,
        height: 192
    },

    // ========== FACTION MEZALAYIS (MERCENAIRES) ==========
    {
        id: 'glass_storm',
        name: 'Tempête de Verre',
        faction: 'MEZALAYIS',
        class: 'ALCHIMISTE',
        prompt: `2D Dofus-style elemental storm spell sprite sheet.
Spell: Glass Storm - Sand transmutes into molten glass shards.
14 frames horizontal, 320x320 per frame.
Animation: Alchemist gestures sand rises, sand glows orange transforming, glass shards swirl in violent vortex, shards fly outward, impact shatter.
Colors: Molten orange #f97316, Glass shards #fef3c7, Sand brown #d97706.
Angular reflective glass fragments.
Style: Dofus Xelor fire aesthetic, transparent background.`,
        width: 4480,
        height: 320
    },
    {
        id: 'scrap_shot',
        name: 'Tir de Ferraille',
        faction: 'MEZALAYIS',
        class: 'ALCHIMISTE',
        prompt: `2D Dofus-style metal projectile spell sprite sheet.
Spell: Scrap Shot - Magnetic blast of recycled metal debris.
8 frames horizontal, 192x128 per frame.
Animation: Metal scraps gather around weapon, magnetic compression forms projectile, projectile fires with metallic trail, impact shrapnel scatter.
Colors: Rusted metal #b45309, Magnetic blue #3b82f6, Sparks #fbbf24.
Cluster of spinning metal fragments.
Style: Dofus industrial ranged attack, transparent PNG.`,
        width: 1536,
        height: 128
    },
    {
        id: 'combat_recycling',
        name: 'Recyclage de Combat',
        faction: 'MEZALAYIS',
        class: 'CHAROGNARD',
        prompt: `2D Dofus-style resource creation spell sprite sheet.
Spell: Combat Recycling - Generates supplies from battlefield debris.
10 frames horizontal, 192x192 per frame.
Animation: Energy field scans ground, debris floats up converges, materials reform into crate, supply item materializes with glow.
Colors: Scan energy #22d3ee, Metal scraps #78716c, Supply glow #fbbf24.
Result: Ammo crate or health kit sprite.
Style: Dofus Enutrof resource magic, transparent background.`,
        width: 1920,
        height: 192
    },
    {
        id: 'sand_cloak',
        name: 'Cape de Sable',
        faction: 'MEZALAYIS',
        class: 'CHAROGNARD',
        prompt: `2D Dofus-style evasion buff spell sprite sheet.
Spell: Sand Cloak - Sand particles create evasion aura.
8 frames horizontal, 192x192 per frame.
Animation: Sand swirls up around character, sand forms cloak shroud, cloak shimmers with mirage effect, stable flowing sand particles.
Colors: Desert sand #fde68a, Mirage shimmer white, Earth brown #92400e.
Semi-transparent sand veil with heat distortion.
Style: Dofus defensive buff aura, transparent PNG.`,
        width: 1536,
        height: 192
    },
    {
        id: 'thermal_distortion',
        name: 'Distorsion Thermique',
        faction: 'MEZALAYIS',
        class: 'MIRAGE',
        prompt: `2D Dofus-style clone stealth spell sprite sheet.
Spell: Thermal Distortion - Creates decoy clones while becoming invisible.
14 frames horizontal, 384x256 per frame.
Animation: Heat waves emanate, image splits into three versions, two clones solidify with heat shimmer, original fades to transparency.
Colors: Heat distortion #fbbf24, Clone outline #f97316, Invisible shimmer.
Clones: Orange-tinted mirror images.
Style: Dofus Sram shadow clone, transparent background.`,
        width: 5376,
        height: 256
    },
    {
        id: 'magnetite_plating',
        name: 'Blindage de Magnétite',
        faction: 'MEZALAYIS',
        class: 'JUGGERNAUT',
        prompt: `2D Dofus-style armor transformation spell sprite sheet.
Spell: Magnetite Plating - Attracts metal debris to form heavy armor.
12 frames horizontal, 256x256 per frame.
Animation: Magnetic field pulses outward, metal scraps fly toward caster, scraps attach forming armor plates, full armor transformation with sparks.
Colors: Metal gray #71717a, Magnetic blue #3b82f6, Sparks #fbbf24.
Final state: Heavy mechanized armor.
Style: Dofus Feca armor buff transformation, transparent PNG.`,
        width: 3072,
        height: 256
    },

    // ========== MONSTRES ==========
    {
        id: 'monster_toxic_ray',
        name: 'Rayon Toxique (Colosse Champignon)',
        faction: 'MONSTER',
        class: 'BOSS',
        prompt: `2D Dofus-style boss attack spell sprite sheet.
Monster: Colossus Mushroom - Giant fungal boss attack.
Attack: Toxic Ray - Continuous poison beam.
16 frames horizontal, 384x384 per frame.
Animation: Mushroom cap glows purple, beam charges at opening, toxic ray fires wide cone, beam sweeps battlefield.
Colors: Boss purple #7c3aed, Toxic green #84cc16, Corruption black #1e1b4b.
Thick organic pulsating ray with floating spores.
Style: Dofus dungeon boss attack, transparent background.`,
        width: 6144,
        height: 384
    },
    {
        id: 'monster_spawn_minions',
        name: 'Spawn Minions (Colosse Champignon)',
        faction: 'MONSTER',
        class: 'BOSS',
        prompt: `2D Dofus-style minion spawn spell sprite sheet.
Boss Attack: Spawn Minions - Summons small mushroom creatures.
12 frames horizontal, 320x320 per frame.
Animation: Boss trembles spores release, spores hit ground burrow, small mushroom caps emerge, mini-mushroom creatures fully spawn.
Minion design: Small 32x32 purple mushrooms with angry eyes and tiny legs.
Colors: Purple #7c3aed, Spore green #84cc16.
Style: Dofus summon spell effects, transparent PNG.`,
        width: 3840,
        height: 320
    },
    {
        id: 'monster_quick_strikes',
        name: 'Coups Rapides (Serpent Sentinel)',
        faction: 'MONSTER',
        class: 'BOSS',
        prompt: `2D Dofus-style serpent multi-attack sprite sheet.
Monster: Serpent Sentinel - Fast aquatic guardian.
Attack: Quick Strikes - Rapid poison bite combo.
10 frames horizontal, 256x192 per frame.
Animation: Serpent coils preparing, first lightning bite, second bite different angle, third bite with poison drip, return to ready.
Colors: Serpent cyan #0891b2, Poison green #22c55e, Fangs white.
Speed lines on each bite.
Style: Dofus fast multi-hit attack, transparent background.`,
        width: 2560,
        height: 192
    },
    {
        id: 'monster_massive_leap',
        name: 'Saut Massif (Crapaud Géant)',
        faction: 'MONSTER',
        class: 'BOSS',
        prompt: `2D Dofus-style ground pound attack sprite sheet.
Monster: Giant Desert Toad - Heavy toxic amphibian.
Attack: Massive Leap - Crushing jump AOE attack.
14 frames horizontal, 384x384 per frame.
Animation: Toad crouches muscles tense, leaps high shadow grows, apex massive silhouette, descending crash, shockwave dust cloud ground cracks.
Colors: Toad yellow-brown #f59e0b, Impact dust #d97706, Shockwave #fef3c7.
Radial crack pattern, debris flying.
Style: Dofus heavy monster AOE attack, transparent PNG.`,
        width: 5376,
        height: 384
    },
    {
        id: 'monster_toxic_vomit',
        name: 'Vomissement Toxique (Crapaud Géant)',
        faction: 'MONSTER',
        class: 'BOSS',
        prompt: `2D Dofus-style poison breath attack sprite sheet.
Monster: Giant Desert Toad.
Attack: Toxic Vomit - Sprays poison pool on ground.
12 frames horizontal, 320x256 per frame.
Animation: Toad bloats cheeks puff, mouth opens green liquid sprays, toxic spray arcs toward target, poison pool forms bubbling.
Colors: Toxic green #65a30d, Vomit yellow #a3e635, Bubble highlights #d9f99d.
Bubbling acidic surface animation.
Style: Dofus persistent hazard spell, transparent background.`,
        width: 3840,
        height: 256
    },
    {
        id: 'monster_double_sting',
        name: 'Piqûres Doubles (Scorpion)',
        faction: 'MONSTER',
        class: 'ELITE',
        prompt: `2D Dofus-style double attack sprite sheet.
Monster: Two-Headed Scorpion - Dual poison striker.
Attack: Double Sting - Both tails strike simultaneously.
10 frames horizontal, 256x192 per frame.
Animation: Both tails raise menacingly, tails arc forward in unison, double impact stingers hit, poison injection visible, tails retract dripping.
Colors: Scorpion brown #78350f, Venom purple #a855f7, Stinger glow #f97316.
Dripping glowing venom on stingers.
Style: Dofus multi-hit poison attack, transparent PNG.`,
        width: 2560,
        height: 192
    }
];

// =====================================================
// FONCTIONS API NANOBANANA
// =====================================================

/**
 * Génère une image via l'API Nanobanana
 */
async function generateImage(prompt, width, height) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            prompt: prompt,
            width: width,
            height: height,
            model: 'gemini-2.5-flash-preview-image-generation',
            response_format: 'url'
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

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.data && response.data[0]) {
                        resolve(response.data[0].url || response.data[0].b64_json);
                    } else if (response.error) {
                        reject(new Error(response.error.message || 'API Error'));
                    } else {
                        resolve(response);
                    }
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message}`));
                }
            });
        });

        req.on('error', (e) => reject(e));
        req.write(postData);
        req.end();
    });
}

/**
 * Télécharge une image depuis une URL
 */
async function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(filepath);
            });
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
    console.log('🎨 ═══════════════════════════════════════════════════════');
    console.log('   NARVOS PRIME - SPELL SPRITE GENERATOR');
    console.log('   Using Nanobanana API');
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
        console.log(`   Dimensions: ${sprite.width}x${sprite.height}`);

        try {
            // Appel API
            const result = await generateImage(sprite.prompt, sprite.width, sprite.height);

            // Sauvegarder l'image
            if (typeof result === 'string' && result.startsWith('http')) {
                await downloadImage(result, filepath);
            } else if (typeof result === 'string') {
                saveBase64Image(result, filepath);
            } else if (result.url) {
                await downloadImage(result.url, filepath);
            } else if (result.b64_json) {
                saveBase64Image(result.b64_json, filepath);
            }

            console.log(`   ✅ Sauvegardé: ${filename}\n`);
            results.success.push({ id: sprite.id, name: sprite.name, file: filename });

        } catch (error) {
            console.log(`   ❌ Erreur: ${error.message}\n`);
            results.failed.push({ id: sprite.id, name: sprite.name, error: error.message });
        }

        // Pause entre les requêtes
        if (i < SPELL_SPRITES.length - 1) {
            await sleep(REQUEST_DELAY_MS);
        }
    }

    // Rapport final
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   📊 RAPPORT DE GÉNÉRATION');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`✅ Succès: ${results.success.length}/${SPELL_SPRITES.length}`);
    console.log(`❌ Échecs: ${results.failed.length}/${SPELL_SPRITES.length}\n`);

    if (results.failed.length > 0) {
        console.log('Sprites en échec:');
        results.failed.forEach(f => console.log(`   - ${f.name}: ${f.error}`));
    }

    // Sauvegarder le rapport
    const reportPath = path.join(OUTPUT_DIR, 'generation_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Rapport sauvegardé: ${reportPath}`);

    console.log('\n🎮 Génération terminée!');
}

// Lancer la génération
generateAllSprites().catch(console.error);
