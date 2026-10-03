import * as THREE from 'three';

/**
 * Service de cache pour les Modules (Modèles 3D)
 * Adapté : Ne gère plus que les "Modules" (Modèles Importés) et délègue le stockage à la Base de Données.
 * Les textures et autres blobs ne sont plus mis en cache localement pour éviter les incohérences.
 */
export class CacheService {
  private static instance: CacheService;
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'narvos_modules_cache'; // Renamed to reflect purpose
  private readonly DB_VERSION = 2; // Incremented version to force clear/update
  private readonly STORE_MODULES = 'modules';

  private constructor() { }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Initialise la base de données IndexedDB (Uniquement pour les Modules)
   */
  public async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => {
        console.error('❌ [CACHE] Erreur lors de l\'ouverture de la base de données Modules');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ [CACHE] Registre des Modules (IndexedDB) initialisé');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Supprimer les anciens stores s'ils existent (nettoyage)
        if (db.objectStoreNames.contains('models')) db.deleteObjectStore('models');
        if (db.objectStoreNames.contains('textures')) db.deleteObjectStore('textures');
        if (db.objectStoreNames.contains('metadata')) db.deleteObjectStore('metadata');

        // Créer le store pour les modules uniquement
        if (!db.objectStoreNames.contains(this.STORE_MODULES)) {
          db.createObjectStore(this.STORE_MODULES, { keyPath: 'path' });
        }
      };
    });
  }

  /**
   * Enregistre un module comme "connu" (Metadonnées uniquement)
   * Le stockage réel se fait dans la Base de Données SQL via sceneSaveService
   */
  public async saveModel(path: string, model: THREE.Object3D): Promise<void> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) return;

    try {
      const moduleData = {
        path,
        timestamp: Date.now(),
        type: model.type,
        name: model.name || 'Unknown Module',
        isKnown: true
      };

      const transaction = this.db.transaction([this.STORE_MODULES], 'readwrite');
      const store = transaction.objectStore(this.STORE_MODULES);
      await store.put(moduleData);

      console.log(`✅ [CACHE] Module enregistré dans le registre local: ${path}`);
    } catch (error) {
      console.warn(`⚠️ [CACHE] Erreur lors de l'enregistrement du module ${path}:`, error);
    }
  }

  /**
   * Vérifie si un module est déjà connu/enregistré
   */
  public async isModelCached(path: string): Promise<boolean> {
    if (!this.db) await this.init();
    if (!this.db) return false;

    try {
      const transaction = this.db.transaction([this.STORE_MODULES], 'readonly');
      const store = transaction.objectStore(this.STORE_MODULES);
      const request = store.get(path);

      return new Promise((resolve) => {
        request.onsuccess = () => {
          resolve(request.result !== undefined);
        };
        request.onerror = () => {
          resolve(false);
        };
      });
    } catch (error) {
      return false;
    }
  }

  // Les méthodes de textures et métadonnées ont été supprimées pour éviter les conflits
  // et forcer l'utilisation de la Base de Données SQL.

  /**
   * Nettoie le registre local
   */
  public async clearCache(): Promise<void> {
    if (!this.db) await this.init();
    if (!this.db) return;

    try {
      const transaction = this.db.transaction([this.STORE_MODULES], 'readwrite');
      const req = transaction.objectStore(this.STORE_MODULES).clear();

      req.onsuccess = () => console.log('✅ [CACHE] Registre des modules nettoyé');

    } catch (error) {
      console.warn('⚠️ [CACHE] Erreur lors du nettoyage:', error);
    }
  }

  public async getCacheSize(): Promise<number> {
    if (!this.db) return 0;
    try {
      const transaction = this.db.transaction([this.STORE_MODULES], 'readonly');
      return new Promise<number>((resolve) => {
        const request = transaction.objectStore(this.STORE_MODULES).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(0);
      });
    } catch (error) {
      return 0;
    }
  }
}

export const cacheService = CacheService.getInstance();

