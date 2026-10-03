/**
 * Utilitaire pour nettoyer la base de données depuis le renderer process
 * Utilise l'API IPC d'Electron
 */

export async function cleanDatabase(): Promise<{ success: boolean; savesDeleted?: number; objectsDeleted?: number; error?: string }> {
  try {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const result = await (window as any).electronAPI.cleanDatabase();
      if (result.success) {
        console.log(`✅ [DB CLEAN] Base de données nettoyée: ${result.savesDeleted || 0} sauvegarde(s), ${result.objectsDeleted || 0} objet(s) supprimé(s)`);
      } else {
        console.error(`❌ [DB CLEAN] Erreur lors du nettoyage: ${result.error}`);
      }
      return result;
    } else {
      console.warn('⚠️ [DB CLEAN] electronAPI non disponible, nettoyage impossible');
      return { success: false, error: 'electronAPI non disponible' };
    }
  } catch (error: any) {
    console.error('❌ [DB CLEAN] Erreur lors du nettoyage de la base de données:', error);
    return { success: false, error: error.message };
  }
}

