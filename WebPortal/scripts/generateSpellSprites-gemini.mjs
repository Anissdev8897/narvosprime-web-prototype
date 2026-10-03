/**
 * 🎨 NARVOS PRIME - SPELL SPRITE GENERATOR
 * Génère automatiquement tous les sprites de sorts via l'API Google Gemini
 * 
 * Configuration:
 * 1. Obtenez une clé API sur https://aistudio.google.com/app/apikey
 * 2. Définissez la variable GEMINI_API_KEY ci-dessous
 * 
 * Usage: node scripts/generateSpellSprites-gemini.mjs
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =====================================================
// 🔐 CONFIGURATION API
// =====================================================

// Remplacez par votre clé API Google AI Studio
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '78b6d9ece3ee4deedce978cf5b58eb80';
const API_BASE_URL = 'generativelanguage.googleapis.com';
const MODEL = 'gemini-2.0-flash-exp-image-generation';

const OUTPUT_DIR = path.join(__dirname, '../public/textures/spells');
const REQUEST_DELAY_MS = 3000;

// =====================================================
// 🎯 DÉFINITIONS DES SPRITES DE SORTS
// =====================================================

const SPELL_SPRITES = [
    // ========== FACTION AKARLYS (HUMAINS - AQUATIQUE) ==========
    {
        id: 'compression_sphere',
        name: 'Sphère de Compression',
        faction: 'AKARLYS',
        class: 'REMPART',
        prompt: `Create a 2D sprite sheet for a tactical RPG game in Dofus/Wakfu art style.

SPELL: "Compression Sphere" - A massive pressurized water sphere
LAYOUT: 8 frames in a horizontal strip, 256x256 pixels each frame
ANIMATION SEQUENCE:
- Frames 1-2: Cyan energy particles gather around caster's hands
- Frames 3-4: Swirling water particles form a translucent sphere
- Frames 5-6: Sphere expands rapidly with ripple distortion effect
- Frames 7-8: Full manifestation with internal plasma currents pulsing

COLOR PALETTE: Deep cyan #0891b2, Aqua glow #22d3ee, White highlights #f0fdff
STYLE: Clean cartoon outlines, bright colors, dynamic energy effects
BACKGROUND: Transparent (PNG format)

Please generate all 8 frames arranged horizontally in a single sprite sheet image.`
    },
    {
        id: 'aqua_bolt',
        name: 'Aqua Bolt',
        faction: 'AKARLYS',
        class: 'REMPART',
        prompt: `Create a 2D projectile sprite sheet for a tactical RPG in Dofus style.

SPELL: "Aqua Bolt" - A concentrated bolt of hydro-electric energy
LAYOUT: 6 frames horizontal strip, 128x128 pixels each
ANIMATION:
- Frames 1-2: Spiraling water droplets form into projectile shape
- Frames 3-4: Bolt launches with trailing water particles and electric arcs
- Frames 5-6: Impact explosion with water splash and electric sparks

COLOR PALETTE: Electric blue #3b82f6, Cyan #06b6d4, White lightning
PROJECTILE SHAPE: Elongated teardrop with spiral energy tail
STYLE: Dofus 2D cartoon, sharp clean outlines
BACKGROUND: Transparent`
    },
    {
        id: 'restoration_flash',
        name: 'Flash de Restauration',
        faction: 'AKARLYS',
        class: 'ECLAIREUR',
        prompt: `Create a 2D healing spell sprite sheet for Dofus-style tactical RPG.

SPELL: "Restoration Flash" - Bioluminescent burst that heals allies
LAYOUT: 8 frames horizontal, 256x256 each
ANIMATION:
- Frames 1-2: Caster's body begins to glow with inner bioluminescence
- Frames 3-4: Light intensifies, bright particles rise upward
- Frames 5-6: Bright white explosion flash covering the area
- Frames 7-8: Green/cyan healing orbs scatter outward with sparkles

COLORS: Bioluminescent cyan #67e8f9, Healing green #4ade80, Bright white
EFFECTS: Radial light rays, floating healing orbs, sparkle particles
STYLE: Dofus Eniripsa-inspired support magic
BACKGROUND: Transparent PNG`
    },
    {
        id: 'hydro_shield',
        name: 'Bouclier Hydro',
        faction: 'AKARLYS',
        class: 'ECLAIREUR',
        prompt: `Create a 2D defensive barrier sprite sheet for Dofus-style game.

SPELL: "Hydro Shield" - Protective water plasma dome
LAYOUT: 6 frames horizontal, 192x192 each
ANIMATION:
- Frames 1-2: Water rises from ground in circular pattern
- Frames 3-4: Water streams merge into dome shape
- Frames 5-6: Shield stabilizes with hexagonal pattern and flowing water inside

COLORS: Semi-transparent aqua #22d3ee (60% opacity), Shield edge glow #0ea5e9
STYLE: Dofus protective magic bubble, clean cartoon style
BACKGROUND: Transparent`
    },
    {
        id: 'hydro_kinetic_wake',
        name: 'Sillage Hydro-Cinétique',
        faction: 'AKARLYS',
        class: 'BRISEUR',
        prompt: `Create a 2D movement trail effect sprite sheet for Dofus-style RPG.

SPELL: "Hydro-Kinetic Wake" - Electrified water trail that paralyzes enemies
LAYOUT: 8 frames horizontal, 320x128 each (wide trail effect)
ANIMATION:
- Frames 1-2: Character dashes leaving water splashes behind
- Frames 3-4: Electric current forms in the water wake
- Frames 5-6: Lightning bolts arc between water droplets
- Frames 7-8: Trail fades with residual electric sparks

COLORS: Water trail #0891b2, Electric arcs #fbbf24, Paralysis purple #a855f7
TRAIL SHAPE: Curved wake pattern with zigzag electricity
STYLE: Dofus speed/movement effect
BACKGROUND: Transparent`
    },

    // ========== FACTION ZAYAN (ALIENS - FONGIQUE) ==========
    {
        id: 'infestation',
        name: 'Infestation',
        faction: 'ZAYAN',
        class: 'SEMEUR',
        prompt: `Create a 2D parasitic attack sprite sheet for Dofus-style game.

SPELL: "Infestation" - Launches a spore that releases parasitic creatures
LAYOUT: 10 frames horizontal, 192x192 each
ANIMATION:
- Frames 1-3: Pulsating organic purple pod forms in caster's hands
- Frames 4-6: Pod launches, trailing spore particles behind it
- Frames 7-8: Pod impacts target, purple veins spread outward
- Frames 9-10: Small parasitic bug creatures emerge (3-4 tiny insects)

COLORS: Toxic purple #7c3aed, Organic green #4ade80, Corruption veins #581c87
CREATURE DESIGN: Small crawling insects with glowing green eyes
STYLE: Dofus alien/organic horror aesthetic
BACKGROUND: Transparent`
    },
    {
        id: 'fungal_spore',
        name: 'Spore Putride',
        faction: 'ZAYAN',
        class: 'SEMEUR',
        prompt: `Create a 2D poison cloud AOE sprite sheet for Dofus-style RPG.

SPELL: "Fungal Spore" - Toxic spore cloud dealing damage over time
LAYOUT: 8 frames horizontal, 256x256 each
ANIMATION:
- Frames 1-2: Mushroom cap appears from ground
- Frames 3-4: Cap bursts open releasing spore cloud
- Frames 5-6: Cloud expands in circular pattern with swirling particles
- Frames 7-8: Cloud slowly dissipates leaving lingering particles

COLORS: Spore cloud #a855f7, Toxic green particles #84cc16, Mushroom brown #92400e
CLOUD SHAPE: Billowing organic cloud with floating spores
STYLE: Dofus Sadida-inspired poison magic
BACKGROUND: Transparent`
    },
    {
        id: 'nervous_symbiosis',
        name: 'Symbiose Nerveuse',
        faction: 'ZAYAN',
        class: 'PROPHETE',
        prompt: `Create a 2D neural link spell sprite sheet for Dofus-style game.

SPELL: "Nervous Symbiosis" - Creates neural link to share damage with ally
LAYOUT: 8 frames horizontal, 320x192 each (wide for connection effect)
ANIMATION:
- Frames 1-2: Organic mycelia tendrils extend from caster
- Frames 3-4: Tendrils travel across ground toward ally
- Frames 5-6: Connection established with glowing neural network
- Frames 7-8: Pulsing link with data particles traveling both directions

COLORS: Neural purple #c084fc, Connection glow #4ade80, Pulse energy #f0abfc
VISUAL: Organic vein-like tendrils with glowing nodes
STYLE: Dofus support link spell aesthetic
BACKGROUND: Transparent`
    },
    {
        id: 'bio_regen',
        name: 'Bio-Régénération',
        faction: 'ZAYAN',
        class: 'PROPHETE',
        prompt: `Create a 2D regeneration healing sprite sheet for Dofus-style RPG.

SPELL: "Bio-Regeneration" - Accelerated cellular healing
LAYOUT: 6 frames horizontal, 192x192 each
ANIMATION:
- Frames 1-2: Green organic energy spirals around target
- Frames 3-4: Cellular particles multiply and spread across body
- Frames 5-6: Healing wave pulses outward, body glows briefly

COLORS: Healing green #22c55e, Bio-energy cyan #2dd4bf, Cell particles #86efac
STYLE: Organic alien healing magic, Dofus Eniripsa-inspired
BACKGROUND: Transparent`
    },
    {
        id: 'transplantation',
        name: 'Transplantation',
        faction: 'ZAYAN',
        class: 'HOTE',
        prompt: `Create a 2D underground movement sprite sheet for Dofus-style game.

SPELL: "Transplantation" - Burrow underground and emerge beneath enemy
LAYOUT: 10 frames horizontal, 256x256 each
ANIMATION:
- Frames 1-3: Caster sinks into ground, organic roots pulling down
- Frames 4-5: Underground travel shown as dust/dirt particles on surface
- Frames 6-8: Roots burst from ground at target location
- Frames 9-10: Caster emerges fully, roots entangle the target

COLORS: Earth brown #78350f, Root purple #7c3aed, Entangle glow #c084fc
EFFECTS: Dirt particles, organic tendrils, ground crack pattern
STYLE: Dofus earth/organic movement spell
BACKGROUND: Transparent`
    },
    {
        id: 'mycelium_trap',
        name: 'Piège Mycélien',
        faction: 'ZAYAN',
        class: 'HOTE',
        prompt: `Create a 2D trap spell sprite sheet for Dofus-style tactical RPG.

SPELL: "Mycelium Trap" - Invisible trap that immobilizes and poisons
LAYOUT: 8 frames horizontal, 192x192 each
ANIMATION:
- Frames 1-2: Faint spore cloud settles on tile (nearly invisible, subtle shimmer)
- Frames 3-4: Enemy triggers trap - roots explode from ground
- Frames 5-6: Roots wrap around target's legs, holding them
- Frames 7-8: Poison particles emanate from the roots

COLORS: Invisible state (faint purple #7c3aed at 20% opacity), Roots #581c87, Poison #a3e635
TRAP HIDDEN STATE: Very subtle shimmer only
STYLE: Dofus Sram trap aesthetic with organic twist
BACKGROUND: Transparent`
    },

    // ========== FACTION MEZALAYIS (MERCENAIRES - DÉSERT) ==========
    {
        id: 'glass_storm',
        name: 'Tempête de Verre',
        faction: 'MEZALAYIS',
        class: 'ALCHIMISTE',
        prompt: `Create a 2D elemental storm sprite sheet for Dofus-style game.

SPELL: "Glass Storm" - Sand transmutes into molten glass shards
LAYOUT: 10 frames horizontal, 320x320 each (large AOE effect)
ANIMATION:
- Frames 1-2: Alchemist gestures, sand rises from ground
- Frames 3-4: Sand glows orange-hot, transforming to molten glass
- Frames 5-7: Glass shards swirl in violent vortex
- Frames 8-9: Shards fly outward in all directions
- Frame 10: Impact - shards shatter on ground

COLORS: Molten orange #f97316, Glass shards #fef3c7, Sand brown #d97706
SHARD SHAPES: Angular, reflective glass fragments
STYLE: Dofus Xelor/fire aesthetic
BACKGROUND: Transparent`
    },
    {
        id: 'scrap_shot',
        name: 'Tir de Ferraille',
        faction: 'MEZALAYIS',
        class: 'ALCHIMISTE',
        prompt: `Create a 2D metal projectile sprite sheet for Dofus-style RPG.

SPELL: "Scrap Shot" - Magnetic blast of recycled metal debris
LAYOUT: 6 frames horizontal, 192x128 each
ANIMATION:
- Frames 1-2: Metal scraps magnetically gather around caster's weapon
- Frames 3-4: Magnetic compression forms spinning projectile cluster
- Frames 5-6: Projectile fires with metallic trail, impact shrapnel scatter

COLORS: Rusted metal #b45309, Magnetic blue glow #3b82f6, Sparks #fbbf24
PROJECTILE: Cluster of spinning metal fragments
STYLE: Dofus industrial ranged attack aesthetic
BACKGROUND: Transparent`
    },
    {
        id: 'combat_recycling',
        name: 'Recyclage de Combat',
        faction: 'MEZALAYIS',
        class: 'CHAROGNARD',
        prompt: `Create a 2D resource creation sprite sheet for Dofus-style game.

SPELL: "Combat Recycling" - Generates supplies from battlefield debris
LAYOUT: 8 frames horizontal, 192x192 each
ANIMATION:
- Frames 1-2: Energy field scans the ground for debris
- Frames 3-4: Debris floats up and converges together
- Frames 5-6: Materials reform and reshape
- Frames 7-8: Supply item materializes with golden glow (ammo crate or health kit)

COLORS: Scan energy #22d3ee, Metal scraps #78716c, Supply glow #fbbf24
RESULT ITEM: Ammo crate or health kit sprite
STYLE: Dofus Enutrof treasure/resource magic
BACKGROUND: Transparent`
    },
    {
        id: 'sand_cloak',
        name: 'Cape de Sable',
        faction: 'MEZALAYIS',
        class: 'CHAROGNARD',
        prompt: `Create a 2D evasion buff sprite sheet for Dofus-style RPG.

SPELL: "Sand Cloak" - Sand particles create evasion aura
LAYOUT: 6 frames horizontal, 192x192 each
ANIMATION:
- Frames 1-2: Sand swirls up from ground around character
- Frames 3-4: Sand forms cloak-like shroud around body
- Frames 5-6: Cloak shimmers with mirage/heat distortion effect

COLORS: Desert sand #fde68a, Mirage shimmer (white semi-transparent), Earth brown #92400e
EFFECT: Semi-transparent sand veil with heat distortion
STYLE: Dofus defensive buff aura
BACKGROUND: Transparent`
    },
    {
        id: 'thermal_distortion',
        name: 'Distorsion Thermique',
        faction: 'MEZALAYIS',
        class: 'MIRAGE',
        prompt: `Create a 2D clone/stealth sprite sheet for Dofus-style tactical RPG.

SPELL: "Thermal Distortion" - Creates decoy clones while becoming invisible
LAYOUT: 10 frames horizontal, 384x256 each (wide for multiple figures)
ANIMATION:
- Frames 1-2: Heat waves emanate from caster
- Frames 3-4: Caster's image wavers and splits into three versions
- Frames 5-7: Two clones solidify with heat shimmer effect
- Frames 8-10: Original caster fades to transparency, clones stand ready

COLORS: Heat distortion #fbbf24, Clone outline #f97316, Invisible shimmer (white 20% opacity)
CLONE DESIGN: Slightly orange-tinted mirror images of caster
STYLE: Dofus Sram shadow clone aesthetic
BACKGROUND: Transparent`
    },
    {
        id: 'magnetite_plating',
        name: 'Blindage de Magnétite',
        faction: 'MEZALAYIS',
        class: 'JUGGERNAUT',
        prompt: `Create a 2D armor buff transformation sprite sheet for Dofus-style game.

SPELL: "Magnetite Plating" - Attracts metal debris to form heavy armor
LAYOUT: 8 frames horizontal, 256x256 each
ANIMATION:
- Frames 1-2: Magnetic field pulses outward from caster (blue wave)
- Frames 3-4: Metal scraps fly toward caster from all sides
- Frames 5-6: Scraps attach and form armor plates on body
- Frames 7-8: Full armor transformation complete, sparks flying

COLORS: Metal gray #71717a, Magnetic blue #3b82f6, Sparks #fbbf24
FINAL STATE: Heavy mechanized armor appearance
STYLE: Dofus Feca/Sacrier armor buff transformation
BACKGROUND: Transparent`
    },

    // ========== MONSTRES ==========
    {
        id: 'monster_toxic_ray',
        name: 'Rayon Toxique (Colosse Champignon)',
        faction: 'MONSTER',
        class: 'BOSS',
        prompt: `Create a 2D boss attack sprite sheet for Dofus-style dungeon game.

MONSTER: "Colossus Mushroom" - Giant fungal boss creature
ATTACK: "Toxic Ray" - Continuous poison beam attack
LAYOUT: 10 frames horizontal, 384x384 each (large boss attack)
ANIMATION:
- Frames 1-3: Giant mushroom cap glows purple, spores gather at opening
- Frames 4-5: Beam of toxic energy charges
- Frames 6-8: Thick toxic ray fires in wide cone pattern
- Frames 9-10: Beam sweeps across battlefield with spores floating in it

COLORS: Boss purple #7c3aed, Toxic green #84cc16, Corruption black #1e1b4b
BEAM STYLE: Thick, organic, pulsating ray with floating spores
STYLE: Dofus dungeon boss attack aesthetic
BACKGROUND: Transparent`
    },
    {
        id: 'monster_spawn_minions',
        name: 'Spawn Minions (Colosse Champignon)',
        faction: 'MONSTER',
        class: 'BOSS',
        prompt: `Create a 2D boss summon sprite sheet for Dofus-style game.

BOSS ATTACK: "Spawn Minions" - Summons small mushroom creatures
LAYOUT: 8 frames horizontal, 320x320 each
ANIMATION:
- Frames 1-2: Boss trembles and releases spore cloud
- Frames 3-4: Spores hit ground and burrow into soil
- Frames 5-6: Small mushroom caps emerge from ground
- Frames 7-8: Mini-mushroom creatures fully spawn (show 4 small units)

MINION DESIGN: Small (~48x48) purple mushrooms with angry glowing eyes and tiny legs
COLORS: Purple #7c3aed, Spore green #84cc16
STYLE: Dofus summon spell effects, cute but menacing minions
BACKGROUND: Transparent`
    },
    {
        id: 'monster_quick_strikes',
        name: 'Coups Rapides (Serpent Sentinel)',
        faction: 'MONSTER',
        class: 'BOSS',
        prompt: `Create a 2D serpent multi-attack sprite sheet for Dofus-style game.

MONSTER: "Serpent Sentinel" - Fast aquatic guardian
ATTACK: "Quick Strikes" - Rapid poison bite combo (3 hits)
LAYOUT: 8 frames horizontal, 256x192 each
ANIMATION:
- Frames 1-2: Serpent coils, preparing to strike
- Frames 3-4: First lightning-fast bite with motion blur
- Frames 5-6: Second bite from different angle
- Frames 7-8: Third bite with visible poison dripping from fangs

COLORS: Serpent cyan #0891b2, Poison drip green #22c55e, Fangs white
EFFECTS: Speed lines/motion blur on each bite attack
STYLE: Dofus fast multi-hit attack animation
BACKGROUND: Transparent`
    },
    {
        id: 'monster_call_reinforcements',
        name: 'Appel Renforts (Serpent Sentinel)',
        faction: 'MONSTER',
        class: 'BOSS',
        prompt: `Create a 2D summoning roar sprite sheet for Dofus-style game.

MONSTER: "Serpent Sentinel" - Aquatic boss
ATTACK: "Call Reinforcements" - Serpent calls other creatures
LAYOUT: 6 frames horizontal, 256x256 each
ANIMATION:
- Frames 1-2: Serpent rears up majestically
- Frames 3-4: Opens mouth wide, sonic/sonar waves emanate outward
- Frames 5-6: Sound waves travel outward (concentric cyan rings), smaller serpents appear at edges

SOUND WAVE VISUAL: Concentric cyan rings expanding outward
STYLE: Dofus monster summoning ability
BACKGROUND: Transparent`
    },
    {
        id: 'monster_massive_leap',
        name: 'Saut Massif (Crapaud Géant)',
        faction: 'MONSTER',
        class: 'BOSS',
        prompt: `Create a 2D ground-pound attack sprite sheet for Dofus-style dungeon game.

MONSTER: "Giant Desert Toad" - Heavy toxic amphibian boss
ATTACK: "Massive Leap" - Crushing jump attack with AOE damage
LAYOUT: 10 frames horizontal, 384x384 each (large boss)
ANIMATION:
- Frames 1-2: Massive toad crouches, muscles visibly tensing
- Frames 3-4: Leaps high into air (shadow on ground grows larger)
- Frames 5-6: Apex of jump - massive silhouette against sky
- Frames 7-8: Descending rapidly
- Frames 9-10: Crushing impact - shockwave, dust cloud, cracks in ground

COLORS: Toad yellow-brown #f59e0b, Impact dust #d97706, Shockwave #fef3c7
IMPACT EFFECT: Radial crack pattern in ground, debris flying outward
STYLE: Dofus heavy monster AOE attack
BACKGROUND: Transparent`
    },
    {
        id: 'monster_toxic_vomit',
        name: 'Vomissement Toxique (Crapaud Géant)',
        faction: 'MONSTER',
        class: 'BOSS',
        prompt: `Create a 2D poison breath attack sprite sheet for Dofus-style game.

MONSTER: "Giant Desert Toad" boss
ATTACK: "Toxic Vomit" - Sprays poison pool on ground
LAYOUT: 8 frames horizontal, 320x256 each
ANIMATION:
- Frames 1-2: Toad bloats up, cheeks puffing with green liquid
- Frames 3-4: Mouth opens wide, green toxic liquid sprays out
- Frames 5-6: Toxic spray arcs toward target area
- Frames 7-8: Poison pool forms on ground, bubbling acidically

COLORS: Toxic green #65a30d, Vomit yellow-green #a3e635, Bubble highlights #d9f99d
POOL EFFECT: Bubbling, acidic surface with occasional bubble pops
STYLE: Dofus persistent ground hazard spell
BACKGROUND: Transparent`
    },
    {
        id: 'monster_double_sting',
        name: 'Piqûres Doubles (Scorpion)',
        faction: 'MONSTER',
        class: 'ELITE',
        prompt: `Create a 2D double sting attack sprite sheet for Dofus-style game.

MONSTER: "Two-Headed Scorpion" - Elite desert creature with two poison tails
ATTACK: "Double Sting" - Both tails strike simultaneously
LAYOUT: 8 frames horizontal, 256x192 each
ANIMATION:
- Frames 1-2: Both scorpion tails raise up menacingly
- Frames 3-4: Both tails arc forward in unison
- Frames 5-6: Double impact - two stingers hit target simultaneously
- Frames 7-8: Poison injection (glowing venom visible), tails retract with dripping venom

COLORS: Scorpion brown #78350f, Venom purple glow #a855f7, Stinger highlights #f97316
VENOM EFFECT: Glowing dripping liquid on stingers
STYLE: Dofus multi-hit poisonous attack
BACKGROUND: Transparent`
    },
    {
        id: 'monster_tail_sweep',
        name: 'Balayage Queue (Scorpion)',
        faction: 'MONSTER',
        class: 'ELITE',
        prompt: `Create a 2D area spin attack sprite sheet for Dofus-style game.

MONSTER: "Two-Headed Scorpion" elite monster
ATTACK: "Tail Sweep" - 360° tail rotation hitting all nearby enemies
LAYOUT: 6 frames horizontal, 320x320 each (wide AOE)
ANIMATION:
- Frames 1-2: Scorpion plants claws firmly, prepares to spin
- Frames 3-4: Both tails swing in wide arc (first half of rotation with motion blur)
- Frames 5-6: Full 360° rotation complete, impact waves ripple outward

ARC VISUAL: Motion blur trails on both tail attacks
IMPACT EFFECT: Dust and small rocks kicked up in circular pattern
STYLE: Dofus monster spin/sweep attack
BACKGROUND: Transparent`
    }
];

// =====================================================
// 🔧 FONCTIONS API GEMINI
// =====================================================

async function generateWithGemini(prompt) {
    return new Promise((resolve, reject) => {
        const requestBody = JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                responseModalities: ["image", "text"],
                responseMimeType: "image/png"
            }
        });

        const options = {
            hostname: API_BASE_URL,
            port: 443,
            path: `/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestBody)
            }
        };

        console.log('   📡 Envoi requête Gemini API...');

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`   📥 Réponse: HTTP ${res.statusCode}`);

                try {
                    const response = JSON.parse(data);

                    if (res.statusCode !== 200) {
                        const errorMsg = response.error?.message || `HTTP ${res.statusCode}`;
                        reject(new Error(errorMsg));
                        return;
                    }

                    // Extraire l'image de la réponse
                    const candidates = response.candidates;
                    if (candidates && candidates[0]?.content?.parts) {
                        for (const part of candidates[0].content.parts) {
                            if (part.inlineData?.mimeType?.startsWith('image/')) {
                                resolve({ b64_json: part.inlineData.data });
                                return;
                            }
                        }
                    }

                    reject(new Error('Pas d\'image dans la réponse'));
                } catch (e) {
                    console.log('   ⚠️ Réponse:', data.substring(0, 300));
                    reject(new Error(`Parse error: ${e.message}`));
                }
            });
        });

        req.on('error', e => reject(new Error(`Network: ${e.message}`)));
        req.write(requestBody);
        req.end();
    });
}

function saveBase64Image(base64Data, filepath) {
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filepath, buffer);
    console.log(`   💾 Sauvegardé: ${path.basename(filepath)} (${(buffer.length / 1024).toFixed(1)} KB)`);
    return filepath;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// =====================================================
// 🚀 GÉNÉRATION PRINCIPALE
// =====================================================

async function main() {
    console.log('\n🎨 ═══════════════════════════════════════════════════════');
    console.log('   NARVOS PRIME - SPELL SPRITE GENERATOR');
    console.log('   Using Google Gemini Image Generation API');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Créer dossier de sortie
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`📁 Dossier créé: ${OUTPUT_DIR}\n`);
    }

    const results = { success: [], failed: [] };
    console.log(`📊 Total: ${SPELL_SPRITES.length} sprites à générer\n`);
    console.log('─'.repeat(60) + '\n');

    for (let i = 0; i < SPELL_SPRITES.length; i++) {
        const sprite = SPELL_SPRITES[i];
        const filename = `${sprite.id}.png`;
        const filepath = path.join(OUTPUT_DIR, filename);

        console.log(`[${i + 1}/${SPELL_SPRITES.length}] 🔄 ${sprite.name}`);
        console.log(`   ${sprite.faction} | ${sprite.class}`);

        try {
            const result = await generateWithGemini(sprite.prompt);

            if (result.b64_json) {
                saveBase64Image(result.b64_json, filepath);
                results.success.push({ id: sprite.id, name: sprite.name, file: filename });
                console.log(`   ✅ Succès!\n`);
            } else {
                throw new Error('Pas de données image');
            }
        } catch (error) {
            console.log(`   ❌ Erreur: ${error.message}\n`);
            results.failed.push({ id: sprite.id, name: sprite.name, error: error.message });
        }

        if (i < SPELL_SPRITES.length - 1) {
            console.log(`   ⏳ Pause ${REQUEST_DELAY_MS / 1000}s...\n`);
            await sleep(REQUEST_DELAY_MS);
        }
    }

    // Rapport
    console.log('\n' + '═'.repeat(60));
    console.log('   📊 RAPPORT FINAL');
    console.log('═'.repeat(60) + '\n');
    console.log(`✅ Succès: ${results.success.length}/${SPELL_SPRITES.length}`);
    console.log(`❌ Échecs: ${results.failed.length}/${SPELL_SPRITES.length}\n`);

    if (results.success.length > 0) {
        console.log('Sprites générés:');
        results.success.forEach(s => console.log(`  ✓ ${s.file}`));
    }

    if (results.failed.length > 0) {
        console.log('\nÉchecs:');
        results.failed.forEach(f => console.log(`  ✗ ${f.name}: ${f.error}`));
    }

    // Sauvegarder rapport
    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'generation_report.json'),
        JSON.stringify(results, null, 2)
    );

    console.log('\n🎮 Terminé!\n');
}

main().catch(console.error);
