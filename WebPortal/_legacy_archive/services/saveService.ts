import { PlayerEntity, Faction, Rank, InventoryItem, SceneMode, BiomeType, Gender } from '../types';

export interface SaveData {
  version: string;
  timestamp: number;
  player: {
    id: number;
    type: string;
    position: { x: number; y: number; z: number };
    velocity: { x: number; y: number; z: number };
    rotation: number;
    pitch: number;
    color: string;
    speed: number;
    size: number;
    stats: {
      hp: number;
      maxHp: number;
      armor: number;
      maxArmor: number;
      oxygen: number;
      maxOxygen: number;
    };
    faction: Faction;
    isDead: boolean;
    inventory: InventoryItem[];
    rank: Rank;
    level: number;
    experience: number;
    equippedItems: { [slot: string]: string };
    gender?: Gender;
    reputation?: { [faction: string]: number };
    currentAp: number;
    currentMp: number;
  };
  gameState: {
    sceneMode: SceneMode;
    activePlanetId: string | null;
    originPlanetId: string | null;
    cameraMode: string;
  };
  currencies: {
    currencyId: string;
    amount: number;
  }[];
  progression: {
    discoveredPlanets: string[];
    completedQuests: string[];
    defeatedBosses: string[];
    unlockedCrafts: string[];
    visitedZones: string[];
  };
  settings: {
    masterVolume: number;
    sfxVolume: number;
    musicVolume: number;
    graphics: {
      quality: string;
      shadows: boolean;
      antialiasing: boolean;
    };
  };
  metadata: {
    playTime: number; // en secondes
    lastSaveTime: number;
    saveCount: number;
  };
}

const DB_NAME = 'NarvosPrime_SaveDB';
const DB_VERSION = 1;
const STORE_NAME = 'saves';

export class SaveService {
  private static instance: SaveService;
  private db: IDBDatabase | null = null;
  private readonly CURRENT_VERSION = '1.0.0';

  private constructor() { }

  public static getInstance(): SaveService {
    if (!SaveService.instance) {
      SaveService.instance = new SaveService();
    }
    return SaveService.instance;
  }

  // Initialiser la base de données
  private async initDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error('Erreur lors de l\'ouverture de la base de données'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Créer l'object store s'il n'existe pas
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
          objectStore.createIndex('timestamp', 'timestamp', { unique: false });
          objectStore.createIndex('version', 'version', { unique: false });
        }
      };
    });
  }

  // Valider les données de sauvegarde
  private validateSaveData(data: any): data is SaveData {
    if (!data || typeof data !== 'object') return false;
    if (!data.version || !data.timestamp || !data.player) return false;
    if (!data.player.stats || !data.player.inventory) return false;
    return true;
  }

  // Sauvegarder les données du joueur
  public async saveData(playerData: PlayerEntity, gameState: any, currencies: any[], progression: any, settings: any, playTime: number = 0): Promise<boolean> {
    try {
      const db = await this.initDB();

      const saveData: SaveData = {
        version: this.CURRENT_VERSION,
        timestamp: Date.now(),
        player: {
          id: playerData.id,
          type: playerData.type,
          position: { ...playerData.position },
          velocity: { ...playerData.velocity },
          rotation: playerData.rotation,
          pitch: playerData.pitch,
          color: playerData.color,
          speed: playerData.speed,
          size: playerData.size,
          stats: { ...playerData.stats },
          faction: playerData.faction,
          isDead: playerData.isDead,
          inventory: [...playerData.inventory],
          rank: playerData.rank,
          level: playerData.level,
          experience: playerData.experience,
          equippedItems: { ...playerData.equippedItems },
          gender: playerData.gender,
          reputation: playerData.reputation ? { ...playerData.reputation } : undefined,
          currentAp: playerData.currentAp,
          currentMp: playerData.currentMp
        },
        gameState: {
          sceneMode: gameState.sceneMode || 'HUB',
          activePlanetId: gameState.activePlanetId || null,
          originPlanetId: gameState.originPlanetId || null,
          cameraMode: gameState.cameraMode || 'THIRD_PERSON'
        },
        currencies: currencies || [],
        progression: progression || {
          discoveredPlanets: [],
          completedQuests: [],
          defeatedBosses: [],
          unlockedCrafts: [],
          visitedZones: []
        },
        settings: settings || {
          masterVolume: 1.0,
          sfxVolume: 1.0,
          musicVolume: 1.0,
          graphics: {
            quality: 'HIGH',
            shadows: true,
            antialiasing: true
          }
        },
        metadata: {
          playTime: playTime,
          lastSaveTime: Date.now(),
          saveCount: await this.getSaveCount() + 1
        }
      };

      // Validation
      if (!this.validateSaveData(saveData)) {
        throw new Error('Données de sauvegarde invalides');
      }

      // Sauvegarder dans IndexedDB
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);

        // Supprimer les anciennes sauvegardes (garder seulement les 5 dernières)
        const clearRequest = objectStore.clear();
        clearRequest.onsuccess = () => {
          const addRequest = objectStore.add(saveData);

          addRequest.onsuccess = () => {
            console.log('Sauvegarde réussie');
            resolve(true);
          };

          addRequest.onerror = () => {
            reject(new Error('Erreur lors de l\'enregistrement'));
          };
        };

        clearRequest.onerror = () => {
          // Si le clear échoue, essayer quand même d'ajouter
          const addRequest = objectStore.add(saveData);
          addRequest.onsuccess = () => resolve(true);
          addRequest.onerror = () => reject(new Error('Erreur lors de l\'enregistrement'));
        };
      });
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      return false;
    }
  }

  // Charger les données sauvegardées
  public async loadData(): Promise<SaveData | null> {
    try {
      const db = await this.initDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);
        const index = objectStore.index('timestamp');
        const request = index.openCursor(null, 'prev'); // Dernière sauvegarde en premier

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const data = cursor.value;

            // Valider les données
            if (this.validateSaveData(data)) {
              resolve(data);
            } else {
              console.warn('Données de sauvegarde corrompues, tentative de récupération...');
              // Essayer la sauvegarde précédente
              cursor.continue();
            }
          } else {
            resolve(null); // Aucune sauvegarde trouvée
          }
        };

        request.onerror = () => {
          reject(new Error('Erreur lors du chargement de la sauvegarde'));
        };
      });
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
      return null;
    }
  }

  // Mettre à jour un élément précis
  public async updateData(updates: Partial<SaveData>): Promise<boolean> {
    try {
      const currentData = await this.loadData();
      if (!currentData) {
        console.warn('Aucune sauvegarde à mettre à jour');
        return false;
      }

      // Fusionner les mises à jour
      const updatedData: SaveData = {
        ...currentData,
        ...updates,
        timestamp: Date.now(),
        player: {
          ...currentData.player,
          ...(updates.player || {})
        },
        gameState: {
          ...currentData.gameState,
          ...(updates.gameState || {})
        },
        progression: {
          ...currentData.progression,
          ...(updates.progression || {})
        },
        metadata: {
          ...currentData.metadata,
          ...(updates.metadata || {}),
          lastSaveTime: Date.now()
        }
      };

      // Valider et sauvegarder
      if (!this.validateSaveData(updatedData)) {
        throw new Error('Données mises à jour invalides');
      }

      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);

        // Supprimer l'ancienne sauvegarde
        const clearRequest = objectStore.clear();
        clearRequest.onsuccess = () => {
          const addRequest = objectStore.add(updatedData);
          addRequest.onsuccess = () => resolve(true);
          addRequest.onerror = () => reject(new Error('Erreur lors de la mise à jour'));
        };
        clearRequest.onerror = () => reject(new Error('Erreur lors de la mise à jour'));
      });
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      return false;
    }
  }

  // Réinitialiser les données (nouvelle partie)
  public async resetData(): Promise<boolean> {
    try {
      const db = await this.initDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);
        const clearRequest = objectStore.clear();

        clearRequest.onsuccess = () => {
          console.log('Données réinitialisées');
          resolve(true);
        };

        clearRequest.onerror = () => {
          reject(new Error('Erreur lors de la réinitialisation'));
        };
      });
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
      return false;
    }
  }

  // Obtenir le nombre de sauvegardes
  private async getSaveCount(): Promise<number> {
    try {
      const db = await this.initDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const objectStore = transaction.objectStore(STORE_NAME);
        const countRequest = objectStore.count();

        countRequest.onsuccess = () => {
          resolve(countRequest.result);
        };

        countRequest.onerror = () => {
          reject(new Error('Erreur lors du comptage'));
        };
      });
    } catch (error) {
      return 0;
    }
  }

  // Vérifier si une sauvegarde existe
  public async hasSaveData(): Promise<boolean> {
    const data = await this.loadData();
    return data !== null;
  }

  // Exporter les données de sauvegarde (pour backup)
  public async exportSaveData(): Promise<string | null> {
    try {
      const data = await this.loadData();
      if (!data) return null;

      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      return null;
    }
  }

  // Importer les données de sauvegarde (depuis backup)
  public async importSaveData(jsonData: string): Promise<boolean> {
    try {
      const data = JSON.parse(jsonData);

      if (!this.validateSaveData(data)) {
        throw new Error('Données importées invalides');
      }

      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const objectStore = transaction.objectStore(STORE_NAME);

        const clearRequest = objectStore.clear();
        clearRequest.onsuccess = () => {
          const addRequest = objectStore.add(data);
          addRequest.onsuccess = () => resolve(true);
          addRequest.onerror = () => reject(new Error('Erreur lors de l\'import'));
        };
        clearRequest.onerror = () => reject(new Error('Erreur lors de l\'import'));
      });
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      return false;
    }
  }

  // Obtenir les statistiques de sauvegarde
  public async getSaveStats(): Promise<{ lastSaveTime: number; playTime: number; saveCount: number } | null> {
    try {
      const data = await this.loadData();
      if (!data) return null;

      return {
        lastSaveTime: data.metadata.lastSaveTime,
        playTime: data.metadata.playTime,
        saveCount: data.metadata.saveCount
      };
    } catch (error) {
      console.error('Erreur lors de la récupération des stats:', error);
      return null;
    }
  }
}

export const saveService = SaveService.getInstance();

