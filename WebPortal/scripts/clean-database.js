/**
 * Script pour nettoyer la base de données WorldNevaros.db
 * Supprime toutes les sauvegardes de scènes
 */

const Database = require('better-sqlite3');
const { app } = require('electron');
const path = require('path');
const fs = require('fs');

const DB_NAME = 'WorldNevaros.db';

function cleanDatabase() {
  try {
    // Utiliser le dossier userData d'Electron
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, DB_NAME);

    console.log(`🧹 Nettoyage de la base de données: ${dbPath}`);

    // Vérifier si la base existe
    if (!fs.existsSync(dbPath)) {
      console.log('ℹ️ La base de données n\'existe pas encore, rien à nettoyer.');
      return { success: true, message: 'Base de données inexistante' };
    }

    // Ouvrir la base de données
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    // Supprimer toutes les sauvegardes de scènes
    const deleteSavesStmt = db.prepare('DELETE FROM scene_saves');
    const deleteObjectsStmt = db.prepare('DELETE FROM scene_objects');

    // Exécuter dans une transaction
    const transaction = db.transaction(() => {
      const savesDeleted = deleteSavesStmt.run();
      const objectsDeleted = deleteObjectsStmt.run();
      return {
        saves: savesDeleted.changes,
        objects: objectsDeleted.changes
      };
    });

    const result = transaction();

    db.close();

    console.log(`✅ Base de données nettoyée:`);
    console.log(`   - ${result.saves} sauvegarde(s) de scène supprimée(s)`);
    console.log(`   - ${result.objects} objet(s) supprimé(s)`);

    return {
      success: true,
      savesDeleted: result.saves,
      objectsDeleted: result.objects
    };
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage de la base de données:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Exporter pour utilisation dans Electron
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cleanDatabase };
}

// Si exécuté directement
if (require.main === module) {
  // Note: Ce script doit être exécuté dans le contexte Electron
  console.log('⚠️ Ce script doit être exécuté dans le contexte Electron.');
  console.log('   Utilisez l\'API IPC depuis le renderer process.');
}

