/**
 * 🗂️ NARVOS PRIME - ASSET ORGANIZER
 * Organise les fichiers existants dans la bonne structure de dossiers
 * 
 * Usage: node scripts/organizeAssets.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = path.join(__dirname, '../public/textures');

// =====================================================
// 📁 RÈGLES D'ORGANISATION
// =====================================================

const ORGANIZATION_RULES = {
    // Sorts par faction
    spells: {
        akarlys: [
            'compression_sphere', 'aqua_bolt', 'restoration_flash',
            'hydro_shield', 'hydro_kinetic_wake'
        ],
        zayan: [
            'infestation', 'fungal_spore', 'nervous_symbiosis',
            'transplantation', 'bio_regen', 'mycelium_trap'
        ],
        mezalayis: [
            'glass_storm', 'scrap_shot', 'thermal_distortion',
            'magnetite_plating', 'combat_recycling', 'sand_cloak'
        ],
        monsters: [
            'monster_toxic_ray', 'monster_massive_leap', 'monster_spawn_minions',
            'monster_quick_strikes', 'monster_toxic_vomit', 'monster_double_sting',
            'monster_tail_sweep'
        ]
    },

    // Personnages par faction
    personnage: {
        akarlys: [
            'akarlys_tank', 'akarlys_bioscout', 'akarlys_currentbreaker',
            'rempart_custom', 'eclaireur_custom', 'briseur_custom',
            '2206e90b' // Hash spécifique vu dans les logs
        ],
        zayan: [
            'zayan_parasitesower', 'zayan_canopyprophet', 'zayan_myceliumhost',
            'semeur_custom', 'prophete_custom', 'hote_custom',
            '62eb9038'
        ],
        mezalayis: [
            'mezalayis_pyroalchemist', 'mezalayis_fluxscavenger',
            'mezalayis_desertmirage', 'mezalayis_dustjuggernaut',
            'alchimiste_custom', 'charognard_custom', 'mirage_custom',
            'cb9d477e', 'cd3fe6f3'
        ]
    }
};

// =====================================================
// 🔧 FONCTIONS
// =====================================================

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 Créé: ${path.relative(BASE_DIR, dirPath)}`);
    }
}

function moveFile(src, dest) {
    if (fs.existsSync(src)) {
        if (fs.existsSync(dest)) {
            console.log(`   ⚠️ Existe déjà: ${path.basename(dest)}`);
            return false;
        }
        fs.copyFileSync(src, dest);
        console.log(`   ✓ ${path.basename(src)} → ${path.relative(BASE_DIR, dest)}`);
        return true;
    }
    return false;
}

function findFilesMatching(dir, patterns) {
    if (!fs.existsSync(dir)) return [];

    const files = fs.readdirSync(dir);
    return files.filter(file => {
        const basename = file.toLowerCase();
        return patterns.some(pattern => basename.includes(pattern.toLowerCase()));
    });
}

// =====================================================
// 🚀 EXÉCUTION
// =====================================================

async function main() {
    console.log('\n🗂️ ═══════════════════════════════════════════════════════');
    console.log('   NARVOS PRIME - ASSET ORGANIZER');
    console.log('═══════════════════════════════════════════════════════════\n');

    const stats = { moved: 0, skipped: 0, errors: 0 };

    // 1. Créer la structure de dossiers
    console.log('📁 Création de la structure...\n');

    // Dossiers de sorts
    for (const faction of Object.keys(ORGANIZATION_RULES.spells)) {
        ensureDir(path.join(BASE_DIR, 'spells', faction));
    }

    // Dossiers de personnages
    for (const faction of Object.keys(ORGANIZATION_RULES.personnage)) {
        ensureDir(path.join(BASE_DIR, 'personnage', faction));
    }

    // Dossiers de maps
    const biomes = ['AQUARYS', 'FUNGARIA', 'DÉSERTICA'];
    for (const biome of biomes) {
        ensureDir(path.join(BASE_DIR, 'dofus_maps', biome, 'ville'));
        ensureDir(path.join(BASE_DIR, 'dofus_maps', biome, 'exterieur_ville'));
        ensureDir(path.join(BASE_DIR, 'dofus_maps', biome, 'donjon'));
    }
    ensureDir(path.join(BASE_DIR, 'dofus_maps', 'Station_Spatiale', 'station'));

    console.log('\n');

    // 2. Organiser les sorts
    console.log('🔮 Organisation des sorts...\n');
    const spellsDir = path.join(BASE_DIR, 'spells');

    for (const [faction, patterns] of Object.entries(ORGANIZATION_RULES.spells)) {
        const destDir = path.join(spellsDir, faction);
        const matchingFiles = findFilesMatching(spellsDir, patterns);

        for (const file of matchingFiles) {
            const src = path.join(spellsDir, file);
            const dest = path.join(destDir, file);

            // Ne pas déplacer si c'est dans le bon dossier
            if (path.dirname(src) === destDir) continue;

            if (moveFile(src, dest)) {
                stats.moved++;
            }
        }
    }

    // 3. Organiser les personnages
    console.log('\n👤 Organisation des personnages...\n');
    const personnageDir = path.join(BASE_DIR, 'personnage');

    for (const [faction, patterns] of Object.entries(ORGANIZATION_RULES.personnage)) {
        const destDir = path.join(personnageDir, faction);
        const matchingFiles = findFilesMatching(personnageDir, patterns);

        for (const file of matchingFiles) {
            const src = path.join(personnageDir, file);
            const dest = path.join(destDir, file);

            if (path.dirname(src) === destDir) continue;

            if (moveFile(src, dest)) {
                stats.moved++;
            }
        }
    }

    // 4. Nettoyage des doublons à la racine
    console.log('\n🧹 Nettoyage des doublons à la racine...\n');
    const cleanupDir = (dir, subdirs) => {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
        for (const file of files) {
            const filePath = path.join(dir, file);
            for (const subdir of subdirs) {
                const targetPath = path.join(dir, subdir, file);
                if (fs.existsSync(targetPath)) {
                    console.log(`   🗑️ Supprimé doublon racine: ${file}`);
                    fs.unlinkSync(filePath);
                    stats.moved++;
                    break;
                }
            }
        }
    };

    cleanupDir(spellsDir, Object.keys(ORGANIZATION_RULES.spells));
    cleanupDir(personnageDir, Object.keys(ORGANIZATION_RULES.personnage));

    // 5. Rapport
    console.log('\n' + '═'.repeat(60));
    console.log('   📊 RAPPORT');
    console.log('═'.repeat(60) + '\n');
    console.log(`📦 Fichiers déplacés/nettoyés: ${stats.moved}`);
    console.log(`⏭️ Fichiers ignorés: ${stats.skipped}`);

    // 6. Afficher la structure finale
    console.log('\n📂 Structure finale:\n');

    const showStructure = (dir, indent = '') => {
        if (!fs.existsSync(dir)) return;
        const items = fs.readdirSync(dir);

        for (const item of items.slice(0, 10)) {
            const itemPath = path.join(dir, item);
            const isDir = fs.statSync(itemPath).isDirectory();

            if (isDir) {
                const fileCount = fs.readdirSync(itemPath).length;
                console.log(`${indent}📁 ${item}/ (${fileCount} éléments)`);
            } else {
                const sizeKB = (fs.statSync(itemPath).size / 1024).toFixed(0);
                console.log(`${indent}📄 ${item} (${sizeKB} KB)`);
            }
        }

        if (items.length > 10) {
            console.log(`${indent}... et ${items.length - 10} autres`);
        }
    };

    showStructure(path.join(BASE_DIR, 'spells'));
    console.log('');
    showStructure(path.join(BASE_DIR, 'personnage'));
    console.log('');
    showStructure(path.join(BASE_DIR, 'dofus_maps'));

    console.log('\n✅ Organisation et Nettoyage terminés!\n');
}

main().catch(console.error);
