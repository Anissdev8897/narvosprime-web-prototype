/**
 * NARVOS PRIME - Asset Manifest Generator
 * Scanne les dossiers d'assets réels et génère un manifest JSON
 * Exécuté automatiquement par "npm run dev" (predev hook)
 */

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════
// CHEMINS RÉELS DES ASSETS (structure actuelle du projet)
// ═══════════════════════════════════════════════════════════════
const TEXTURES_ROOT = 'public/textures';

const ASSET_PATHS = {
    heroes: path.join(TEXTURES_ROOT, 'personnage'),       // Classes jouables (aquarys_shadow, bio_scout, etc.)
    monsters: path.join(TEXTURES_ROOT, 'monstres'),        // Monstres par faction (AQUARYS, FUNGARIA, etc.)
    props: path.join(TEXTURES_ROOT, 'objet'),              // Objets (consomable, item)
    spells: path.join(TEXTURES_ROOT, 'spells'),            // Sorts par faction (akarlys, general, etc.)
    sprites: path.join(TEXTURES_ROOT, 'sprites'),          // Spritesheets brutes
    ui: path.join(TEXTURES_ROOT, 'ui'),                    // Assets UI
    decor: path.join(TEXTURES_ROOT, 'decor'),              // Décors de map
    items: path.join(TEXTURES_ROOT, 'items'),              // Items (icônes)
    generated: path.join(TEXTURES_ROOT, 'generated'),      // Assets générés par IA
};

const OUTPUT_FILE = 'src/data/assets-manifest.json';

/**
 * Liste les sous-dossiers d'un répertoire
 */
function getSubDirs(dir) {
    const fullPath = path.resolve(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
        console.warn(`  [SKIP] Dossier non trouvé: ${dir}`);
        return [];
    }

    return fs.readdirSync(fullPath).filter(file => {
        try {
            const filePath = path.join(fullPath, file);
            return fs.statSync(filePath).isDirectory() && !file.startsWith('.');
        } catch (e) {
            return false;
        }
    });
}

/**
 * Liste les fichiers d'un répertoire (images uniquement)
 */
function getImageFiles(dir) {
    const fullPath = path.resolve(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
        return [];
    }

    const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];

    return fs.readdirSync(fullPath).filter(file => {
        try {
            const ext = path.extname(file).toLowerCase();
            return IMAGE_EXTENSIONS.includes(ext) && !file.startsWith('.');
        } catch (e) {
            return false;
        }
    });
}

/**
 * Scanne récursivement et compte les assets
 */
function countAssetsRecursive(dir) {
    const fullPath = path.resolve(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) return 0;

    let count = 0;
    const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'];

    function walk(currentPath) {
        const entries = fs.readdirSync(currentPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name.startsWith('.')) continue;
            const fullEntryPath = path.join(currentPath, entry.name);
            if (entry.isDirectory()) {
                walk(fullEntryPath);
            } else if (IMAGE_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())) {
                count++;
            }
        }
    }

    walk(fullPath);
    return count;
}

/**
 * Génère le manifest complet
 */
function generateManifest() {
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('  NARVOS PRIME - Asset Manifest Generator');
    console.log('═══════════════════════════════════════════════════');
    console.log(`  Racine: ${TEXTURES_ROOT}`);
    console.log('');

    const manifest = {
        // Dossiers principaux (sous-dossiers = catégories)
        heroes: getSubDirs(ASSET_PATHS.heroes),
        monsters: getSubDirs(ASSET_PATHS.monsters),
        props: getSubDirs(ASSET_PATHS.props),
        spells: getSubDirs(ASSET_PATHS.spells),

        // Fichiers bruts (spritesheets, UI)
        spriteFiles: getImageFiles(ASSET_PATHS.sprites),
        uiFiles: getImageFiles(ASSET_PATHS.ui),

        // Compteurs (pour stats)
        counts: {
            heroes: countAssetsRecursive(ASSET_PATHS.heroes),
            monsters: countAssetsRecursive(ASSET_PATHS.monsters),
            props: countAssetsRecursive(ASSET_PATHS.props),
            spells: countAssetsRecursive(ASSET_PATHS.spells),
            sprites: countAssetsRecursive(ASSET_PATHS.sprites),
            ui: countAssetsRecursive(ASSET_PATHS.ui),
            decor: countAssetsRecursive(ASSET_PATHS.decor),
            items: countAssetsRecursive(ASSET_PATHS.items),
            generated: countAssetsRecursive(ASSET_PATHS.generated),
        },

        // Métadonnées
        paths: ASSET_PATHS,
        timestamp: new Date().toISOString()
    };

    // Calcul du total
    const totalAssets = Object.values(manifest.counts).reduce((a, b) => a + b, 0);

    // Écriture du fichier
    const outPath = path.resolve(process.cwd(), OUTPUT_FILE);
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));

    // Rapport
    console.log('  Résultats:');
    console.log(`    Heroes (personnage)  : ${manifest.heroes.length} classes (${manifest.counts.heroes} fichiers)`);
    console.log(`    Monsters (monstres)  : ${manifest.monsters.length} factions (${manifest.counts.monsters} fichiers)`);
    console.log(`    Props (objet)        : ${manifest.props.length} catégories (${manifest.counts.props} fichiers)`);
    console.log(`    Spells (spells)      : ${manifest.spells.length} factions (${manifest.counts.spells} fichiers)`);
    console.log(`    Sprites              : ${manifest.spriteFiles.length} fichiers`);
    console.log(`    UI                   : ${manifest.counts.ui} fichiers`);
    console.log(`    Décors               : ${manifest.counts.decor} fichiers`);
    console.log(`    Items                : ${manifest.counts.items} fichiers`);
    console.log(`    Générés (IA)         : ${manifest.counts.generated} fichiers`);
    console.log('');
    console.log(`  TOTAL: ${totalAssets} assets`);
    console.log(`  Manifest: ${OUTPUT_FILE}`);
    console.log('═══════════════════════════════════════════════════');
    console.log('');
}

generateManifest();
