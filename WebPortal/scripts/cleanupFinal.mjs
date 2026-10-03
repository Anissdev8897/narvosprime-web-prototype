import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '../public/textures');

async function main() {
    console.log("🧹 Final Assets Cleanup...");

    const itemsToDelete = [
        'dofus_maps/AQUARYS',
        'dofus_maps/FUNGARIA',
        'dofus_maps/DÉSERTICA',
        'dofus_maps/Station_Spatiale',
        'spells',
        'decor',
        'items',
        'complete_generation_report.json'
    ];

    let deletedCount = 0;
    for (const item of itemsToDelete) {
        const fullPath = path.join(ROOT_DIR, item);
        if (fs.existsSync(fullPath)) {
            console.log(`   🗑️ Nettoyage complet : ${item}`);
            if (fs.statSync(fullPath).isDirectory()) {
                // Pour les dossiers, on vide le contenu mais on garde la structure racine si besoin
                // Plus simple : on supprime et on laisse generateAllAssets recréer le dossier
                fs.rmSync(fullPath, { recursive: true, force: true });
            } else {
                fs.unlinkSync(fullPath);
            }
            deletedCount++;
        }
    }

    console.log(`\n✅ Cleanup finished. ${deletedCount} bad files removed.`);
}

main().catch(console.error);
