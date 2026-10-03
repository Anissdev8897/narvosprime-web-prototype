/**
 * 🗂️ NARVOS PRIME - 3D ASSET ORGANIZER
 * Organise les fichiers .glb dans la structure de dossiers officielle
 * 
 * Usage: node scripts/organize3DAssets.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_DIR = 'E:/narvosprime-web-prototype/Client/public/textures/model3D';

// =====================================================
// 📁 CONFIGURATION
// =====================================================

const HUMAN_CLASSES = [
    'aquarys_shadow_male', 'aquarys_shadow_female',
    'bio_scout_male', 'bio_scout_female',
    'current_breaker_male', 'current_breaker_female',
    'desert_mirage_male', 'desert_mirage_female',
    'dust_juggernaut_male', 'dust_juggernaut_female',
    'flux_scavenger_male', 'flux_scavenger_female',
    'mycelium_host_male', 'mycelium_host_female',
    'parasite_sower_male', 'parasite_sower_female',
    'pressure_manipulator_male', 'pressure_manipulator_female',
    'pyro_alchemist_male', 'pyro_alchemist_female',
    'venom_stalker_male', 'venom_stalker_female'
];

const ALIEN_CLASSES = [
    'abyssal_stalker', 'void_reaver',
    'crystalline_behemoth', 'swarm_hivemind',
    'nebula_weaver', 'stellar_predator'
];

// =====================================================
// 🔧 UTILS
// =====================================================

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`📁 Créé: ${path.relative(BASE_DIR, dirPath)}`);
    }
}

function moveFile(src, dest) {
    if (fs.existsSync(src)) {
        ensureDir(path.dirname(dest));
        if (fs.existsSync(dest)) {
            // console.log(`   ⚠️ Existe déjà: ${path.basename(dest)}`);
            return false;
        }
        fs.renameSync(src, dest);
        console.log(`   ✓ ${path.basename(src)} → ${path.relative(BASE_DIR, dest)}`);
        return true;
    }
    return false;
}

// =====================================================
// 🚀 EXÉCUTION
// =====================================================

async function main() {
    console.log('\n🗂️  NARVOS PRIME - 3D ASSET ORGANIZER\n');

    let movedCount = 0;

    // 1. Scanner tous les fichiers .glb récursivement
    function getFiles(dir, fileList = []) {
        const files = fs.readdirSync(dir);
        files.forEach(file => {
            const filePath = path.join(dir, file);
            if (fs.statSync(filePath).isDirectory()) {
                getFiles(filePath, fileList);
            } else if (file.endsWith('.glb')) {
                fileList.push(filePath);
            }
        });
        return fileList;
    }

    const allFiles = getFiles(BASE_DIR);
    console.log(`🔍 ${allFiles.length} fichiers .glb trouvés.\n`);

    allFiles.forEach(file => {
        const basename = path.basename(file).toLowerCase();
        let targetPath = null;

        // --- DÉTERMINATION DE LA RACE ---
        const isHuman = basename.includes('hu_') || basename.includes('humain') || file.includes('human');
        const isAlien = basename.includes('alien') || file.includes('alien');
        const race = isHuman ? 'human' : (isAlien ? 'alien' : 'human'); // Default to human if unsure

        // --- DÉTERMINATION DU TYPE ---
        let type = 'personnage_pnj'; // Default
        if (basename.includes('vaiseau') || basename.includes('vaiseau') || basename.includes('sky_sentinel') || basename.includes('nocturnal_soar')) {
            type = 'vehicule/vaiseau';
        } else if (basename.includes('voiture') || basename.includes('desert_guardians') || basename.includes('rugged')) {
            type = 'vehicule/voiture';
        } else if (basename.includes('arsenal') || basename.includes('arme')) {
            type = 'arme';
        }

        // --- DÉTERMINATION DE LA CLASSE (Si applicable) ---
        let className = null;
        const classes = race === 'human' ? HUMAN_CLASSES : ALIEN_CLASSES;

        for (const cls of classes) {
            // Conversion du nom de classe pour le matching (ex: pyro_alchemist -> pyroalchemist)
            const matchName = cls.replace(/_/g, '').toLowerCase();
            const cleanBasename = basename.replace(/_/g, '').toLowerCase();

            if (cleanBasename.includes(matchName)) {
                className = cls;
                type = 'player_personnage';
                break;
            }
        }

        // Cas spécifiques pour les fichiers déjà renommés manuellement ou contenant des indices
        if (!className) {
            if (basename.includes('pyro')) className = 'pyro_alchemist_male';
            if (basename.includes('stalker')) className = 'venom_stalker_male';
            if (basename.includes('shadow')) className = 'aquarys_shadow_male';
            // ... on peut ajouter d'autres patterns
            if (className) type = 'player_personnage';
        }

        // --- CONSTRUCTION DU CHEMIN CIBLE ---
        if (type === 'player_personnage' && className) {
            targetPath = path.join(BASE_DIR, race, type, className, path.basename(file));
        } else {
            // PNJ, Arme, Vehicule
            targetPath = path.join(BASE_DIR, race, type, path.basename(file));
        }

        // --- DÉPLACEMENT ---
        if (targetPath && file !== targetPath) {
            if (moveFile(file, targetPath)) {
                movedCount++;
            }
        }
    });

    console.log(`\n✅ Terminé. ${movedCount} fichiers déplacés.`);
}

main().catch(console.error);
