import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '../public/textures');
const PERSONNAGE_DIR = path.join(ROOT_DIR, 'processed/personnage');

async function main() {
    console.log("🧹 Grand ménage des assets Narvos Prime...");
    let deletedCount = 0;

    // 1. Dossiers Personnages à supprimer (suspects de double sprites / labels)
    if (fs.existsSync(PERSONNAGE_DIR)) {
        const folders = fs.readdirSync(PERSONNAGE_DIR);
        for (const folder of folders) {
            const fullPath = path.join(PERSONNAGE_DIR, folder);
            if (fs.statSync(fullPath).isDirectory()) {
                const isCustom = folder.includes('custom');
                const isHash = /^[0-9a-f]{8,}/.test(folder) || /^[0-9]{10,}/.test(folder);

                if (isCustom || isHash) {
                    console.log(`   🗑️ Suppression dossier suspect: ${folder}`);
                    fs.rmSync(fullPath, { recursive: true, force: true });
                    deletedCount++;
                }
            }
        }
    }

    // 2. Maps à supprimer (déjà identifiées ou patterns incohérents)
    const mapsToDelete = [
        'dofus_maps/Station_Spatiale/station', // Toute la station est à refaire
        'dofus_maps/AQUARYS/donjon/aquarys_donjon_2.png',
        'dofus_maps/FUNGARIA/donjon/fungaria_donjon_1.png',
    ];

    for (const mapPath of mapsToDelete) {
        const fullPath = path.join(ROOT_DIR, mapPath);
        if (fs.existsSync(fullPath)) {
            console.log(`   🗑️ Suppression map/dossier: ${mapPath}`);
            if (fs.statSync(fullPath).isDirectory()) {
                fs.rmSync(fullPath, { recursive: true, force: true });
            } else {
                fs.unlinkSync(fullPath);
            }
            deletedCount++;
        }
    }

    console.log(`\n✅ Nettoyage terminé. ${deletedCount} éléments majeurs supprimés.`);
    console.log("🚀 Prêt pour la régénération avec les nouveaux standards de qualité.");
}

main().catch(console.error);
