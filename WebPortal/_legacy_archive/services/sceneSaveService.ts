import * as THREE from 'three';
import { SceneMode } from '../types';
import { animationManagerService } from './animationManagerService';

/**
 * Données sauvegardées pour un objet de la scène
 */
export interface SavedSceneObject {
  id: string;
  name: string;
  type: 'IMPORTED_MODEL' | 'GEOMETRY' | 'TERRAIN' | 'PROP' | 'PORTAL_TRIGGER' | 'PORTAL_FRAME' | 'PORTAL_LIGHT' | 'SPAWN_PLATFORM';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  material?: {
    type: 'MeshStandardMaterial' | 'MeshBasicMaterial' | 'MeshPhongMaterial';
    color?: number;
    metalness?: number;
    roughness?: number;
    emissive?: number;
    emissiveIntensity?: number;
    map?: string; // URL de la texture
    normalMap?: string;
    roughnessMap?: string;
    metallicMap?: string;
    opacity?: number;
    transparent?: boolean;
    alphaTest?: number;
  };
  geometryType?: string; // 'Box', 'Sphere', etc.
  modelPath?: string; // Chemin du modèle importé
  animation?: {
    entityType?: string; // Type d'entité (VEHICLE, SPACESHIP, etc.)
    animationName?: string; // Nom de l'animation (IDLE, WALK, etc.)
    animationType?: string; // Type d'animation (idle, move, etc.)
    isPlaying?: boolean; // Si l'animation est en cours de lecture
  };
  userData?: any; // Données personnalisées
}

export interface GlobalSceneSettings {
  water?: {
    planetId: string;
    config: any; // WaterConfig
  };
  fog?: {
    color: number;
    near: number;
    far: number;
    density: number;
  };
  skybox?: {
    atmosphereColor?: number;
    // Autres props
  };
}

/**
 * Données complètes d'une scène sauvegardée
 */
export interface SavedSceneData {
  planetId: string | null; // 'aquarys', 'draelkara', 'mycelion', 'hub', null pour l'espace
  sceneMode: SceneMode;
  timestamp: number;
  version: string;
  objects: SavedSceneObject[];
  deletedObjectIds?: string[];
  settings?: GlobalSceneSettings; // ✅ NOUVEAU
  terrain?: {
    material?: SavedSceneObject['material'];
  };
}

// ✅ CHANGEMENT : Nouveau préfixe aligné avec la DB
const STORAGE_PREFIX = 'world_nevaros_save_v1_';
const CURRENT_VERSION = '3.0.0';

/**
 * Service de sauvegarde de scène par planète
 */
export class SceneSaveService {
  private static instance: SceneSaveService;

  public static getInstance(): SceneSaveService {
    if (!SceneSaveService.instance) {
      SceneSaveService.instance = new SceneSaveService();
    }
    return SceneSaveService.instance;
  }

  /**
   * Obtenir la clé de stockage pour une planète
   */
  private getStorageKey(planetId: string | null): string {
    if (planetId === 'hub') {
      return `${STORAGE_PREFIX}hub`;
    }
    return `${STORAGE_PREFIX}${planetId || 'space'}`;
  }

  /**
   * Sérialiser un objet 3D en données sauvegardables
   */
  /**
   * Sérialiser un matériau
   */
  public serializeMaterial(material: THREE.Material): SavedSceneObject['material'] | undefined {
    if (!material) return undefined;

    const serializeTexture = (map: THREE.Texture | null | undefined): string | undefined => {
      if (!map) return undefined;
      // Essayer de récupérer le nom ou l'URL de l'image
      if (map.name) return map.name;
      if (map.source && map.source.data && (map.source.data as any).src) return (map.source.data as any).src;
      return undefined;
    };

    const baseData: any = {
      type: material.type.replace('Mesh', '').replace('Material', ''),
    };

    if (
      material instanceof THREE.MeshStandardMaterial ||
      material instanceof THREE.MeshPhysicalMaterial ||
      material instanceof THREE.MeshBasicMaterial ||
      material instanceof THREE.MeshPhongMaterial ||
      material instanceof THREE.MeshLambertMaterial
    ) {
      const mat = material as any;
      if (mat.color) baseData.color = mat.color.getHex();
      if (mat.metalness !== undefined) baseData.metalness = mat.metalness;
      if (mat.roughness !== undefined) baseData.roughness = mat.roughness;
      if (mat.emissive) baseData.emissive = mat.emissive.getHex();
      if (mat.emissiveIntensity !== undefined) baseData.emissiveIntensity = mat.emissiveIntensity;

      if (mat.map) baseData.map = serializeTexture(mat.map);
      if (mat.normalMap) baseData.normalMap = serializeTexture(mat.normalMap);
      if (mat.roughnessMap) baseData.roughnessMap = serializeTexture(mat.roughnessMap);
      if (mat.metalnessMap) baseData.metallicMap = serializeTexture(mat.metalnessMap);

      // ✅ NOUVEAU : Transparence et Opacité
      baseData.opacity = material.opacity;
      baseData.transparent = material.transparent;
      baseData.alphaTest = material.alphaTest;
    } else if (material instanceof THREE.ShaderMaterial) {
      // ✅ NOUVEAU : Sérialisation des uniforms pour les shaders
      baseData.type = 'Shader';
      baseData.uniforms = {};

      // Parcourir les uniforms et extraire les valeurs simples
      for (const key in material.uniforms) {
        const uniform = material.uniforms[key];
        if (uniform.value !== undefined && uniform.value !== null) {
          const val = uniform.value;
          // Gérer les types spécifiques Three.js
          if (val instanceof THREE.Color) {
            baseData.uniforms[key] = { type: 'Color', value: val.getHex() };
          } else if (val instanceof THREE.Vector3) {
            baseData.uniforms[key] = { type: 'Vector3', value: { x: val.x, y: val.y, z: val.z } };
          } else if (val instanceof THREE.Vector2) {
            baseData.uniforms[key] = { type: 'Vector2', value: { x: val.x, y: val.y } };
          } else if (typeof val === 'number' || typeof val === 'string' || typeof val === 'boolean') {
            baseData.uniforms[key] = val;
          }
        }
      }
    }

    return baseData;
  }

  /**
   * Sérialiser un objet 3D en données sauvegardables
   */
  public serializeObject(obj: THREE.Object3D): SavedSceneObject | null {
    // ✅ CRITIQUE : PERSISTENCE UNIVERSELLE OPT-IN
    // Seuls les objets explicitement marqués comme 'isSavable' sont sauvegardés.
    // Cela exclut automatiquement le Wave System, les projectiles, les particules, etc.
    if (obj.userData.isSavable !== true) {
      return null;
    }

    // Ignorer les objets système
    if (obj.userData.type === 'PLAYER' ||
      obj.userData.isSystem === true || // ✅ GLOBAL EXCLUSION for system objects (Water, Seabed, etc.)
      obj.userData.type === 'WATER_SYSTEM' ||
      obj.userData.type === 'SEABED_SYSTEM' ||
      obj.userData.type === 'TRANSFORM_CONTROLS' ||
      obj.userData.type === 'TRANSFORM_CONTROLS_HELPER' ||
      obj.userData.type === 'CAMERA' ||
      obj.userData.type === 'LIGHT' ||
      obj.userData.type === 'HELPER' ||
      obj.userData.isHelper === true ||
      obj.name.includes('Helper') ||
      obj.name.includes('Grid') ||
      obj.name === 'X' || obj.name === 'Y' || obj.name === 'Z' || obj.name === 'E' ||
      obj.name === 'XY' || obj.name === 'XZ' || obj.name === 'YZ' ||
      obj.name.includes('TransformControls') ||
      obj.name.includes('Gizmo') ||
      obj instanceof THREE.Light ||
      obj instanceof THREE.Camera) {
      return null;
    }

    // Déterminer le type d'objet
    let objectType: SavedSceneObject['type'] = 'PROP';
    if (obj.userData.type === 'IMPORTED_MODEL') {
      objectType = 'IMPORTED_MODEL';
    } else if (obj.userData.type === 'SPAWN_PLATFORM' || obj.userData.type === 'TERRAIN' || obj.userData.type === 'PORTAL_TRIGGER') {
      objectType = 'TERRAIN';
    } else if (obj.userData.geometryType) {
      objectType = 'GEOMETRY';
    } else if (obj.userData.type) {
      objectType = obj.userData.type as SavedSceneObject['type'];
    }

    // Générer un ID unique et stable si manquant
    let objectId = obj.userData.modelId || obj.userData.id;
    if (!objectId) {
      objectId = `${objectType}_${obj.uuid}`;
      if (!obj.userData.id) {
        obj.userData.id = objectId;
      }
    }

    const savedObj: SavedSceneObject = {
      id: objectId,
      name: obj.name || obj.userData.name || obj.userData.type || 'Unnamed Object',
      type: objectType,
      position: {
        x: obj.position.x,
        y: obj.position.y,
        z: obj.position.z
      },
      rotation: {
        x: obj.rotation.x,
        y: obj.rotation.y,
        z: obj.rotation.z
      },
      scale: {
        x: obj.scale.x,
        y: obj.scale.y,
        z: obj.scale.z
      },
      userData: (({ animations, animationMixer, animationManager, ...rest }) => rest)(obj.userData),
      modelPath: obj.userData.modelPath // ✅ CRITIQUE : Capturer le chemin du modèle pour la sauvegarde
    };

    // Extraire les informations de géométrie
    if (obj instanceof THREE.Mesh) {
      if (obj.geometry instanceof THREE.BoxGeometry) savedObj.geometryType = 'Box';
      else if (obj.geometry instanceof THREE.SphereGeometry) savedObj.geometryType = 'Sphere';
      else if (obj.geometry instanceof THREE.CylinderGeometry) savedObj.geometryType = 'Cylinder';
      else if (obj.geometry instanceof THREE.ConeGeometry) savedObj.geometryType = 'Cone';
      else if (obj.geometry instanceof THREE.TorusGeometry) savedObj.geometryType = 'Torus';
      else if (obj.geometry instanceof THREE.PlaneGeometry) savedObj.geometryType = 'Plane';
    }

    // Extraire les informations de matériau
    if (obj instanceof THREE.Mesh && obj.material) {
      // ✅ Utiliser la nouvelle méthode serializeMaterial
      savedObj.material = this.serializeMaterial(obj.material as THREE.Material);
    }

    return savedObj;
  }

  /**
   * ✅ NOUVEAU : Désérialiser un objet sauvegardé en Object3D
   * Cette fonction recrée les modèles importés à partir de leur chemin de fichier
   */
  public async deserializeObject(savedObj: SavedSceneObject): Promise<THREE.Object3D | null> {
    try {
      // Cas 1: Modèle importé (GLB/FBX/OBJ)
      if (savedObj.type === 'IMPORTED_MODEL' && savedObj.modelPath) {
        console.log(`🔄 [RESTORE] Rechargement du modèle: ${savedObj.modelPath}`);

        // Importer dynamiquement le preloadService pour éviter les dépendances circulaires
        const { preloadService } = await import('./preloadService');
        const model = await preloadService.loadModel(savedObj.modelPath);

        if (model) {
          // Appliquer les transformations sauvegardées
          model.position.set(savedObj.position.x, savedObj.position.y, savedObj.position.z);
          model.rotation.set(savedObj.rotation.x, savedObj.rotation.y, savedObj.rotation.z);
          model.scale.set(savedObj.scale.x, savedObj.scale.y, savedObj.scale.z);

          // Restaurer les userData
          model.userData = {
            ...savedObj.userData,
            id: savedObj.id,
            type: 'IMPORTED_MODEL',
            name: savedObj.name,
            modelPath: savedObj.modelPath,
            isSavable: true,
            editable: true,
            isPlanetContent: true
          };

          console.log(`✅ [RESTORE] Modèle restauré: ${savedObj.name}`);
          return model;
        } else {
          console.warn(`⚠️ [RESTORE] Impossible de charger le modèle: ${savedObj.modelPath}`);
        }
      }

      // Cas 2: Géométrie primitive (Box, Sphere, etc.)
      if (savedObj.geometryType) {
        let geometry: THREE.BufferGeometry;

        switch (savedObj.geometryType) {
          case 'Box': geometry = new THREE.BoxGeometry(1, 1, 1); break;
          case 'Sphere': geometry = new THREE.SphereGeometry(1, 32, 32); break;
          case 'Cylinder': geometry = new THREE.CylinderGeometry(1, 1, 2, 32); break;
          case 'Cone': geometry = new THREE.ConeGeometry(1, 2, 32); break;
          case 'Torus': geometry = new THREE.TorusGeometry(1, 0.3, 16, 48); break;
          case 'Plane': geometry = new THREE.PlaneGeometry(1, 1); break;
          default:
            console.warn(`⚠️ [RESTORE] Type de géométrie non supporté: ${savedObj.geometryType}`);
            return null;
        }

        // Créer le matériau
        let material: THREE.Material = new THREE.MeshStandardMaterial({ color: 0x888888 });
        if (savedObj.material) {
          material = new THREE.MeshStandardMaterial({
            color: savedObj.material.color ?? 0x888888,
            roughness: savedObj.material.roughness ?? 0.5,
            metalness: savedObj.material.metalness ?? 0.0,
            transparent: savedObj.material.transparent ?? false,
            opacity: savedObj.material.opacity ?? 1.0
          });
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(savedObj.position.x, savedObj.position.y, savedObj.position.z);
        mesh.rotation.set(savedObj.rotation.x, savedObj.rotation.y, savedObj.rotation.z);
        mesh.scale.set(savedObj.scale.x, savedObj.scale.y, savedObj.scale.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        mesh.userData = {
          id: savedObj.id,
          type: 'GEOMETRY',
          name: savedObj.name,
          geometryType: savedObj.geometryType,
          isSavable: true,
          editable: true,
          isPlanetContent: true
        };

        console.log(`✅ [RESTORE] Géométrie restaurée: ${savedObj.name} (${savedObj.geometryType})`);
        return mesh;
      }

      return null;
    } catch (error) {
      console.error(`❌ [RESTORE] Erreur lors de la restauration de ${savedObj.name}:`, error);
      return null;
    }
  }

  /**
   * Sauvegarder la scène actuelle pour une planète
   * SNAPSHOT: Sauvegarde l'état exact actuel. Tout objet non présent ici est considéré comme inexistant.
   */
  public async saveScene(
    scene: THREE.Scene,
    planetId: string | null,
    sceneMode: SceneMode,
    deletedObjectIds: string[] = [],
    settings?: GlobalSceneSettings
  ): Promise<void> {
    try {
      console.log(`💾 [SAVE SERVICE] Sauvegarde (Snapshot) pour ${planetId || 'espace'}...`);
      const objects: SavedSceneObject[] = [];

      scene.traverse((obj) => {
        const savedObj = this.serializeObject(obj);
        if (savedObj) {
          objects.push(savedObj);
        }
      });

      const sceneData: SavedSceneData = {
        planetId,
        sceneMode,
        timestamp: Date.now(),
        version: CURRENT_VERSION,
        objects,
        deletedObjectIds,
        settings
      };

      // Tentative via Electron
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        try {
          const initResult = await (window as any).electronAPI.initDatabase();
          if (initResult.success) {
            const sceneModeStr = typeof sceneMode === 'string' ? sceneMode : String(sceneMode);
            // Passer deletedObjectIds et settings à l'API Electron
            const saveResult = await (window as any).electronAPI.saveSceneToDatabase(
              planetId,
              sceneModeStr,
              objects,
              CURRENT_VERSION,
              deletedObjectIds,
              settings // 6ème argument pour les settings
            );
            if (saveResult && saveResult.success) {
              console.log(`✅ [SAVE SERVICE] Sauvegarde DB réussie (${objects.length} objets)`);
              return;
            }
          }
        } catch (e) {
          console.warn('⚠️ [SAVE SERVICE] Échec sauvegarde DB, fallback LocalStorage', e);
        }
      }

      // Fallback LocalStorage
      const storageKey = this.getStorageKey(planetId);
      localStorage.setItem(storageKey, JSON.stringify(sceneData));
      console.log(`✅ [SAVE SERVICE] Sauvegarde LocalStorage réussie (${objects.length} objets)`);
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      throw error;
    }
  }

  /**
   * Charger une scène sauvegardée
   */
  public async loadScene(planetId: string | null, sceneMode?: SceneMode): Promise<SavedSceneData | null> {
    try {
      // Tentative via Electron
      if (typeof window !== 'undefined' && (window as any).electronAPI && sceneMode) {
        try {
          const initResult = await (window as any).electronAPI.initDatabase();
          if (initResult.success) {
            const sceneModeStr = typeof sceneMode === 'string' ? sceneMode : String(sceneMode);
            const loadResult = await (window as any).electronAPI.loadSceneFromDatabase(planetId, sceneModeStr);
            if (loadResult.success && loadResult.sceneData) {
              console.log(`📦 [LOAD SERVICE] Chargement depuis DB (${loadResult.sceneData.objects.length} objets)`);

              // ✅ CRITIQUE : S'assurer que userData est bien un objet et pas une chaîne JSON brute
              // Cela corrige le bug où userData devient {0: "{", 1: "\"", ...} après un spread
              loadResult.sceneData.objects.forEach((obj: any) => {
                if (typeof obj.userData === 'string') {
                  try {
                    obj.userData = JSON.parse(obj.userData);
                    console.log(`🔧 [LOAD SERVICE] userData parsé pour ${obj.name || obj.id}`);
                  } catch (e) {
                    console.error(`❌ [LOAD SERVICE] Erreur de parsing userData pour ${obj.name || obj.id}`, e);
                    obj.userData = {};
                  }
                }

                // ✅ CRITIQUE : Restaurer modelPath depuis userData si manquant à la racine (rétrocompatibilité)
                if (!obj.modelPath && obj.userData && obj.userData.modelPath) {
                  obj.modelPath = obj.userData.modelPath;
                  console.log(`🔧 [LOAD SERVICE] modelPath restauré depuis userData pour ${obj.name}`);
                }
              });

              return loadResult.sceneData;
            } else {
              console.warn('⚠️ [LOAD SERVICE] Chargement DB réussi mais aucune donnée trouvée (ou échec partiel). Retourne null pour éviter le bruit.');
              // ✅ STRICT MODE: Si on est en Electron et que la DB ne renvoie rien, on ne veut PAS fallback sur LocalStorage
              // On retourne null pour signaler qu'il n'y a pas de sauvegarde fiable.
              return null;
            }
          }
        } catch (e) {
          console.error('❌ [LOAD SERVICE] CRITICAL: Échec chargement DB Electron.', e);
          // ✅ STRICT MODE: En cas d'erreur critique DB, on ne veut SURTOUT PAS charger un vieux LocalStorage
          // On propage l'erreur ou on retourne null
          console.warn('🔒 [STRICT MODE] Fallback LocalStorage BLOQUÉ pour éviter la corruption de données.');
          return null;
        }
      }

      // Fallback LocalStorage
      const storageKey = this.getStorageKey(planetId);
      const data = localStorage.getItem(storageKey);
      if (!data) return null;

      const sceneData: SavedSceneData = JSON.parse(data);
      console.log(`📦 [LOAD SERVICE] Chargé depuis LocalStorage (${sceneData.objects.length} objets)`);
      return sceneData;
    } catch (error) {
      console.error('❌ Erreur lors du chargement:', error);
      return null;
    }
  }

  public async deleteScene(planetId: string | null, sceneMode?: SceneMode): Promise<void> {
    try {
      // Tentative via Electron
      if (typeof window !== 'undefined' && (window as any).electronAPI && sceneMode) {
        try {
          const sceneModeStr = typeof sceneMode === 'string' ? sceneMode : String(sceneMode);
          await (window as any).electronAPI.deleteSceneFromDatabase(planetId, sceneModeStr);
          console.log(`🗑️ [DELETE SERVICE] Suppression DB effectuée pour ${planetId}`);
        } catch (e) {
          console.warn('⚠️ [DELETE SERVICE] Échec suppression DB', e);
        }
      }

      // Fallback LocalStorage (toujours nettoyer)
      const storageKey = this.getStorageKey(planetId);
      localStorage.removeItem(storageKey);
      console.log(`🗑️ [DELETE SERVICE] Clé LocalStorage supprimée: ${storageKey}`);
    } catch (error) {
      console.error('❌ Erreur lors de la suppression:', error);
    }
  }

  /**
   * ✅ NOUVEAU : Supprimer un objet spécifique de la DB
   */
  public async deleteObject(objectId: string, planetId: string): Promise<boolean> {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      try {
        const result = await (window as any).electronAPI.deleteObjectFromDatabase(objectId, planetId);
        if (result && result.success) {
          return true;
        }
      } catch (e) {
        console.warn(`⚠️ [DELETE SERVICE] Échec suppression objet DB: ${objectId}`, e);
      }
    }
    return false;
  }

  public hasSave(planetId: string | null): boolean {
    const storageKey = this.getStorageKey(planetId);
    return localStorage.getItem(storageKey) !== null;
  }

  /**
   * Créer un backup de la scène actuelle
   */
  public async createBackup(
    scene: THREE.Scene,
    planetId: string | null,
    sceneMode: SceneMode,
    name: string,
    deletedObjectIds: string[] = [],
    settings?: GlobalSceneSettings
  ): Promise<number | null> {
    try {
      console.log(`💾 [BACKUP SERVICE] Création backup "${name}" pour ${planetId}...`);
      const objects: SavedSceneObject[] = [];

      scene.traverse((obj) => {
        const savedObj = this.serializeObject(obj);
        if (savedObj) {
          objects.push(savedObj);
        }
      });

      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        const sceneModeStr = typeof sceneMode === 'string' ? sceneMode : String(sceneMode);
        const result = await (window as any).electronAPI.saveBackupToDatabase(
          planetId,
          sceneModeStr,
          objects,
          name,
          deletedObjectIds,
          settings
        );

        if (result && result.success && result.backupId) {
          console.log(`✅ [BACKUP SERVICE] Backup créé avec ID: ${result.backupId}`);
          return result.backupId;
        } else {
          console.warn('⚠️ [BACKUP SERVICE] Échec création backup:', result?.error);
          return null;
        }
      }
      return null;
    } catch (error) {
      console.error('❌ Erreur createBackup:', error);
      return null;
    }
  }

  /**
   * Récupérer la liste des backups
   */
  public async getBackups(planetId: string | null, sceneMode: SceneMode): Promise<any[]> {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const sceneModeStr = typeof sceneMode === 'string' ? sceneMode : String(sceneMode);
      const result = await (window as any).electronAPI.getBackupsFromDatabase(planetId, sceneModeStr);
      if (result && result.success) {
        return result.backups;
      }
    }
    return [];
  }

  /**
   * Charger un backup spécifique
   */
  public async loadBackup(backupId: number): Promise<SavedSceneData | null> {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const result = await (window as any).electronAPI.loadBackupFromDatabase(backupId);
      if (result && result.success && result.sceneData) {
        console.log(`📦 [BACKUP SERVICE] Backup ${backupId} chargé`);
        return result.sceneData;
      }
    }
    return null;
  }

  /**
   * Supprimer un backup
   */
  public async deleteBackup(backupId: number): Promise<boolean> {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const result = await (window as any).electronAPI.deleteBackupFromDatabase(backupId);
      return result && result.success;
    }
    return false;
  }
}

export const sceneSaveService = SceneSaveService.getInstance();
