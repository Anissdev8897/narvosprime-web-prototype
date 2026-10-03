/**
 * 🔪 NARVOS PRIME - UI ELEMENT CUTTER
 * Découpe les éléments UI de l'image pour le launcher
 * 
 * Usage: node scripts/cutUIElements.mjs
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_IMAGE = path.join(__dirname, '../public/textures/launcher/ui_elements.jpg');
const OUTPUT_DIR = path.join(__dirname, '../public/textures/launcher/ui');

// Coordonnées des éléments UI à découper (x, y, width, height)
// Basé sur l'analyse de l'image uploadée
const UI_ELEMENTS = [
    // Panneau principal login (cadre avec circuits)
    { id: 'login_panel', x: 30, y: 30, width: 485, height: 320, description: 'Panneau de login principal' },

    // Bouton LOGIN (en haut à gauche du panneau)
    { id: 'btn_login', x: 40, y: 45, width: 200, height: 75, description: 'Bouton Login stylisé' },

    // Champ input username (icône utilisateur)
    { id: 'input_username', x: 310, y: 55, width: 190, height: 45, description: 'Champ username' },

    // Champ input password (icône cadenas)
    { id: 'input_password', x: 310, y: 110, width: 190, height: 45, description: 'Champ password' },

    // Orbe Bleu (loading/décor)
    { id: 'orb_blue', x: 30, y: 355, width: 100, height: 100, description: 'Orbe bleu décoratif' },

    // Orbe Vert (loading/décor)
    { id: 'orb_green', x: 135, y: 355, width: 100, height: 100, description: 'Orbe vert décoratif' },

    // Bouton SETTINGS
    { id: 'btn_settings', x: 300, y: 355, width: 210, height: 55, description: 'Bouton Settings' },

    // Bouton HELP
    { id: 'btn_help', x: 300, y: 420, width: 210, height: 55, description: 'Bouton Help' },

    // Icône Loading avec orbe
    { id: 'loading_orb', x: 30, y: 480, width: 70, height: 70, description: 'Orbe de chargement' },

    // Barre LOADING
    { id: 'bar_loading', x: 30, y: 485, width: 210, height: 50, description: 'Barre de loading' },

    // Bouton SERVER SELECTION
    { id: 'btn_server', x: 300, y: 485, width: 210, height: 50, description: 'Bouton sélection serveur' }
];

async function main() {
    console.log('\n🔪 ═══════════════════════════════════════════════════════');
    console.log('   NARVOS PRIME - UI ELEMENT CUTTER');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Créer le dossier de sortie
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`📁 Dossier créé: ${OUTPUT_DIR}\n`);
    }

    // Charger l'image source
    const metadata = await sharp(INPUT_IMAGE).metadata();
    console.log(`📸 Image source: ${metadata.width}x${metadata.height}\n`);

    const results = { success: [], failed: [] };

    for (const element of UI_ELEMENTS) {
        console.log(`✂️ Découpe: ${element.id}`);
        console.log(`   📐 Position: (${element.x}, ${element.y}) - ${element.width}x${element.height}`);

        try {
            // Vérifier que les coordonnées sont valides
            if (element.x + element.width > metadata.width ||
                element.y + element.height > metadata.height) {
                throw new Error('Coordonnées hors limites');
            }

            const outputPath = path.join(OUTPUT_DIR, `${element.id}.png`);

            await sharp(INPUT_IMAGE)
                .extract({
                    left: element.x,
                    top: element.y,
                    width: element.width,
                    height: element.height
                })
                .png()
                .toFile(outputPath);

            const stats = fs.statSync(outputPath);
            console.log(`   ✅ Sauvé: ${element.id}.png (${(stats.size / 1024).toFixed(1)} KB)`);
            results.success.push(element.id);

        } catch (error) {
            console.log(`   ❌ Erreur: ${error.message}`);
            results.failed.push({ id: element.id, error: error.message });
        }
    }

    // Rapport
    console.log('\n' + '═'.repeat(60));
    console.log('   📊 RAPPORT');
    console.log('═'.repeat(60) + '\n');
    console.log(`✅ Succès: ${results.success.length}/${UI_ELEMENTS.length}`);
    console.log(`❌ Échecs: ${results.failed.length}/${UI_ELEMENTS.length}`);

    if (results.success.length > 0) {
        console.log('\n📦 Éléments découpés:');
        results.success.forEach(id => console.log(`   ✓ ${id}.png`));
    }

    console.log(`\n📂 Dossier: ${OUTPUT_DIR}`);
    console.log('\n✅ Terminé!\n');
}

main().catch(console.error);
