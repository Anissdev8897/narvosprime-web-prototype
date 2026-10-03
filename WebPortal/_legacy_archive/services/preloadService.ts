import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TextureLoader } from 'three';
import { Faction, PlanetConfig } from '../types';
import { MONSTER_DB, PLANETS } from '../constants';
import { localAIService } from './localAIService';
import { aiModelManager } from './aiModelManager';
import { cacheService } from './cacheService';

export interface PreloadProgress {
  total: number;
  loaded: number;
  currentItem: string;
  stage: 'AI_MODEL' | 'MODELS' | 'TEXTURES' | 'ANIMATIONS' | 'MOBS' | 'SHADERS' | 'MAPS' | 'COMPLETE';
  percentage: number;
  message?: string; // Message dynamique pour l'écran de chargement
  cacheSize?: string; // Taille du cache (ex: "1.2 GB")
  downloadSpeed?: string; // Vitesse de téléchargement
}

export type PreloadCallback = (progress: PreloadProgress) => void;

export class PreloadService {
  private static instance: PreloadService;
  private loadedModels: Map<string, THREE.Object3D> = new Map();
  private loadedTextures: Map<string, THREE.Texture> = new Map();
  private loadedAnimations: Map<string, THREE.AnimationClip[]> = new Map();
  private fbxLoader: FBXLoader;
  private objLoader: OBJLoader;
  private mtlLoader: MTLLoader;
  private gltfLoader: GLTFLoader;
  private textureLoader: TextureLoader;
  private totalBytesLoaded: number = 0;

  // 🚫 FLAG : Activer le chargement des modèles 3D
  private static readonly DISABLE_MODEL_LOADING = true;

  // 🚫 FLAG : Désactiver COMPLÈTEMENT le chargement des maps planétaires
  private static readonly DISABLE_PLANETARY_MAPS = false; // ACTIVÉ pour charger les maps

  private constructor() {
    this.fbxLoader = new FBXLoader();
    this.objLoader = new OBJLoader();
    this.mtlLoader = new MTLLoader();
    this.gltfLoader = new GLTFLoader();
    this.textureLoader = new TextureLoader();
  }

  public static getInstance(): PreloadService {
    if (!PreloadService.instance) {
      PreloadService.instance = new PreloadService();
    }
    return PreloadService.instance;
  }

  // Obtenir un modèle préchargé
  public getModel(path: string): THREE.Object3D | null {
    return this.loadedModels.get(path) || null;
  }

  // Obtenir une texture préchargée
  public getTexture(path: string): THREE.Texture | null {
    return this.loadedTextures.get(path) || null;
  }

  // Obtenir des animations préchargées
  public getAnimations(path: string): THREE.AnimationClip[] | null {
    return this.loadedAnimations.get(path) || null;
  }

  // Helper pour formater la taille
  private formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  // Télécharger avec progression et mise en cache
  private async fetchAndCache(url: string, onProgress: (loaded: number, total: number) => void): Promise<Response> {
    const cacheName = 'narvos-prime-assets-v1';
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(url);

    if (cachedResponse) {
      // Si en cache, on retourne la réponse (on pourrait vérifier la taille ici)
      const blob = await cachedResponse.blob();
      onProgress(blob.size, blob.size);
      this.totalBytesLoaded += blob.size;
      return cachedResponse;
    }

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    let loaded = 0;

    const reader = response.body?.getReader();
    if (!reader) throw new Error('ReadableStream not supported');

    const stream = new ReadableStream({
      start(controller) {
        function push() {
          reader.read().then(({ done, value }) => {
            if (done) {
              controller.close();
              return;
            }
            loaded += value.byteLength;
            onProgress(loaded, total);
            controller.enqueue(value);
            push();
          });
        }
        push();
      }
    });

    const newResponse = new Response(stream, { headers: response.headers });
    // On doit cloner pour mettre en cache car le body ne peut être lu qu'une fois
    const responseToCache = newResponse.clone();

    // Attention: cache.put consomme le body, donc on doit attendre que le stream soit consommé par l'appelant
    // OU on utilise une stratégie différente. Ici, on va lire le stream pour le loader Three.js
    // Pour simplifier et assurer le cache, on va lire tout le blob d'abord
    const blob = await newResponse.blob();
    this.totalBytesLoaded += blob.size;

    // Sauvegarder dans le cache
    await cache.put(url, new Response(blob, { headers: response.headers }));

    return new Response(blob, { headers: response.headers });
  }

  // Charger un modèle individuel (pour les transitions de map)
  public async loadModel(path: string): Promise<THREE.Object3D | null> {
    // 🚫 DÉSACTIVATION MODÈLES : Retourner null si désactivé
    if (PreloadService.DISABLE_MODEL_LOADING) {
      console.log(`🚫 [PRELOAD] loadModel désactivé: ${path}`);
      return null;
    }

    // Vérifier si déjà chargé
    if (this.loadedModels.has(path)) {
      return this.loadedModels.get(path) || null;
    }

    // Vérifier le cache
    const cached = await cacheService.isModelCached(path);
    if (cached) {
      // Le modèle est en cache, mais on doit le recharger depuis le serveur
      // (car on ne peut pas sérialiser Three.js objects facilement)
      // Pour l'instant, on recharge depuis le serveur
    }

    try {
      let model: THREE.Object3D | null = null;

      if (path.endsWith('.fbx')) {
        model = await new Promise<THREE.Group>((resolve, reject) => {
          this.fbxLoader.load(path, resolve, undefined, reject);
        });
      } else if (path.endsWith('.obj')) {
        model = await new Promise<THREE.Group>((resolve, reject) => {
          this.objLoader.load(path, resolve, undefined, reject);
        });
      } else if (path.endsWith('.gltf') || path.endsWith('.glb')) {
        const gltf = await new Promise<any>((resolve, reject) => {
          this.gltfLoader.load(path, resolve, undefined, reject);
        });
        model = gltf.scene;
      }

      if (model) {
        this.loadedModels.set(path, model);
        await cacheService.saveModel(path, model);
        return model;
      }
    } catch (error) {
      console.warn(`⚠️ Erreur lors du chargement du modèle ${path}:`, error);
    }

    return null;
  }

  // Charger une texture individuelle (pour les transitions de map)
  public async loadTexture(path: string): Promise<THREE.Texture | null> {
    // Vérifier si déjà chargée
    if (this.loadedTextures.has(path)) {
      return this.loadedTextures.get(path) || null;
    }

    try {
      // Charger depuis le serveur directement (Cache de texture désactivé)
      const texture = await new Promise<THREE.Texture>((resolve, reject) => {
        this.textureLoader.load(path, resolve, undefined, reject);
      });

      if (texture) {
        if (!texture.userData) texture.userData = {};
        texture.userData.path = path;
        this.loadedTextures.set(path, texture);
        return texture;
      }
    } catch (error) {
      console.warn(`⚠️ Erreur lors du chargement de la texture ${path}:`, error);
    }

    return null;
  }

  // Précharger tous les assets
  public async preloadAll(callback?: PreloadCallback): Promise<void> {
    // NETTOYER ET INITIALISER LE CACHE EN PREMIER
    try {
      // Nettoyer le cache existant pour forcer le rechargement
      await cacheService.clearCache();
      console.log('🧹 [PRELOAD] Cache nettoyé');

      // Initialiser le cache
      await cacheService.init();
      console.log('✅ [PRELOAD] Cache service initialisé et prêt');
    } catch (error) {
      console.error('❌ [PRELOAD] Erreur lors de l\'initialisation du cache:', error);
      // Continuer quand même mais sans cache
      console.warn('⚠️ [PRELOAD] Continuation sans cache');
    }

    const allAssets: string[] = [];
    let loaded = 0;
    let actuallyLoaded = 0; // Compteur pour les assets réellement chargés

    // 1. MODÈLES PNJ (Désactivés pour le mode Tactical 2D)
    const pnjModels: string[] = [];

    // 2. MODÈLES MOBS
    const mobModels: string[] = [];

    // 3. MODÈLES ARMES
    const weaponModels: string[] = [];

    // 4. MODÈLES VÉHICULES
    const vehicleModels: string[] = [];

    // 5. MAPS UNREAL (Fichiers lourds)
    const mapFiles: { type: 'obj' | 'mtl' | 'fbx', path: string }[] = [
      // MAPS UNREAL désactivées temporairement
    ];

    // 🚫 DÉSACTIVATION MODÈLES : Ne pas charger les modèles 3D si désactivé
    if (!PreloadService.DISABLE_MODEL_LOADING) {
      allAssets.push(...pnjModels, ...mobModels, ...weaponModels, ...vehicleModels);
    } else {
      console.log('🚫 [PRELOAD] Chargement des modèles 3D désactivé - Seulement les textures et éléments utiles seront chargés');
    }

    // 5. TEXTURES (TOUJOURS CHARGÉES - ÉLÉMENTS UTILES)
    const texturePaths: string[] = [];

    // Textures PNJ
    pnjModels.forEach(modelPath => {
      const basePath = modelPath.substring(0, modelPath.lastIndexOf('/'));
      texturePaths.push(
        `${basePath}/texture_0_metallic.png`,
        `${basePath}/texture_0_normal.png`,
        `${basePath}/texture_0_roughness.png`
      );
    });

    // Textures Mobs
    mobModels.forEach(modelPath => {
      const basePath = modelPath.substring(0, modelPath.lastIndexOf('/'));
      texturePaths.push(
        `${basePath}/texture_0_metallic.png`,
        `${basePath}/texture_0_normal.png`,
        `${basePath}/texture_0_roughness.png`
      );
    });

    // Textures armes (Désactivées car non existantes en /weapon/)
    /*
    texturePaths.push(
      '/weapon/weapon_AYARLYS/Futuristic_Arsenal_1123110734_texture.png',
      '/weapon/weapon_ZAYAN/Ethereal_Arsenal_1123150038_texture.png',
      '/weapon/weapon_MEZALAYIS/Steampunk_Armory_Disp_1123191304_texture.png'
    );
    */

    // On récupère les sprites des personnages
    const constants = await import('../constants');
    Object.values(constants.CLASSES_DB).forEach(cls => {
      const c = cls.spriteConfig;
      if (c.malePath) texturePaths.push(c.malePath);
      if (c.femalePath) texturePaths.push(c.femalePath);
      if (c.maleMask) texturePaths.push(c.maleMask);
      if (c.femaleMask) texturePaths.push(c.femaleMask);
    });

    // TEXTURES MAPS DOFUS - Désactivé car géré par TileMapEngine
    // Les tuiles sont chargées dynamiquement par le TileMapEngine depuis /tilesets/

    // (Textures UI Character supprimées car dossiers vides)

    // Messages dynamiques pour l'écran de chargement
    const loadingMessages = [
      'Il existe 3 factions jouables : AKARLYS, ZAYAN et MEZALAYIS...',
      'L\'IA locale analyse votre environnement...',
      'Chargement des textures planétaires...',
      'Initialisation des systèmes de combat...',
      'Préparation des biomes uniques...',
      'Chargement des modèles 3D...',
      'Optimisation des performances...',
      'Mise en cache sécurisée des données...',
    ];
    let messageIndex = 0;

    const totalAssets = allAssets.length + texturePaths.length + mapFiles.length + 1; // +1 pour le modèle IA
    let currentStage: PreloadProgress['stage'] = 'AI_MODEL';

    // Fonction de mise à jour du progrès
    const updateProgress = (item: string, stage?: PreloadProgress['stage'], message?: string) => {
      loaded++;
      if (stage) currentStage = stage;
      const progress: PreloadProgress = {
        total: totalAssets,
        loaded,
        currentItem: item,
        stage: currentStage,
        percentage: Math.round((loaded / totalAssets) * 100),
        message: message || loadingMessages[messageIndex % loadingMessages.length],
        cacheSize: this.formatBytes(this.totalBytesLoaded)
      };
      if (callback) callback(progress);
      messageIndex++;
    };

    // ÉTAPE 0: Charger les modèles IA pour les PNJ (en premier pour optimiser)
    try {
      updateProgress('Vérification des modèles IA...', 'AI_MODEL', 'Vérification de la disponibilité des modèles IA pour les PNJ...');

      // Charger tous les modèles IA activés via AIModelManager
      await aiModelManager.loadAllEnabledModels((modelId, progress) => {
        const modelConfig = aiModelManager.getModelConfig(modelId);
        const modelName = modelConfig?.name || modelId;
        updateProgress(
          `Modèle ${modelName}: ${Math.round(progress * 100)}%`,
          'AI_MODEL',
          `Chargement de ${modelName}...`
        );
      });

      // Vérifier le statut des modèles chargés
      const statuses = aiModelManager.getAllStatuses();
      const loadedCount = statuses.filter(s => s.status === 'LOADED').length;
      const enabledCount = statuses.filter(s => s.config.enabled).length;

      if (loadedCount > 0) {
        console.log(`✅ [PRELOAD] ${loadedCount}/${enabledCount} modèle(s) IA chargé(s) avec succès`);
        updateProgress(
          `${loadedCount} modèle(s) IA chargé(s)`,
          'AI_MODEL',
          'Les PNJ peuvent maintenant utiliser l\'IA pour leurs comportements et dialogues'
        );
      } else {
        console.warn('⚠️ [PRELOAD] Aucun modèle IA chargé - Fallback activé');
        updateProgress(
          'Modèles IA: Non disponibles (fallback activé)',
          'AI_MODEL',
          'Le jeu utilisera un système de comportement par défaut'
        );
      }
    } catch (error) {
      console.warn('Erreur lors du chargement des modèles IA, continuation sans IA:', error);
      updateProgress('Modèles IA: Non disponibles (fallback activé)', 'AI_MODEL', 'Le jeu utilisera un système de comportement par défaut');
    }

    // NOUVELLE ÉTAPE : Charger les MAPS UNREAL (Lourds) - DÉSACTIVÉ si DISABLE_PLANETARY_MAPS = true
    currentStage = 'MAPS';

    if (PreloadService.DISABLE_PLANETARY_MAPS) {
      // 🚫 MAPS DÉSACTIVÉES : Simuler le chargement pour la progression
      console.log(`🚫 [PRELOAD] ${mapFiles.length} maps planétaires ignorées (chargement désactivé)`);
      for (const mapFile of mapFiles) {
        const fileName = mapFile.path.split('/').pop() || 'Map';
        updateProgress(fileName, 'MAPS', `Chargement désactivé: ${fileName}`);
      }
    } else {
      // Chargement normal des maps
      updateProgress('Initialisation du cache des maps...', 'MAPS', 'Téléchargement et mise en cache sécurisée des environnements...');

      for (const mapFile of mapFiles) {
        try {
          const fileName = mapFile.path.split('/').pop() || 'Map';
          // Utiliser fetchAndCache pour télécharger et mettre en cache avec progression
          await this.fetchAndCache(mapFile.path, (loadedBytes, totalBytes) => {
            // On pourrait mettre à jour la progression détaillée ici si on voulait
            // Mais pour l'instant on met juste à jour la taille totale
          });

          // Si c'est un MTL, on le précharge dans Three.js
          if (mapFile.type === 'mtl') {
            await new Promise((resolve, reject) => {
              this.mtlLoader.load(mapFile.path, (materials) => {
                materials.preload();
                resolve(materials);
              }, undefined, reject);
            });
          }
          // Si c'est un FBX ou OBJ, on le charge également en mémoire pour qu'il soit prêt
          if (mapFile.type === 'fbx' || mapFile.type === 'obj') {
            await this.loadModel(mapFile.path);
          }

          updateProgress(fileName, 'MAPS', `Mise en cache de ${fileName}...`);
        } catch (error) {
          console.warn(`⚠️ Erreur chargement map ${mapFile.path}:`, error);
          updateProgress(mapFile.path, 'MAPS', `Erreur cache ${mapFile.path}`);
        }
      }
    }

    // Charger les modèles standards (DÉSACTIVÉ si DISABLE_MODEL_LOADING = true)
    currentStage = 'MODELS';
    let civilModelsCount = 0;

    if (PreloadService.DISABLE_MODEL_LOADING) {
      // 🚫 MODÈLES DÉSACTIVÉS : Simuler le chargement pour la progression
      console.log(`🚫 [PRELOAD] ${allAssets.length} modèles ignorés (chargement désactivé)`);
      for (const modelPath of allAssets) {
        updateProgress(modelPath, 'MODELS');
        loaded++;
      }
      actuallyLoaded = 0; // Aucun modèle réellement chargé
    } else {
      // Chargement normal des modèles
      for (const modelPath of allAssets) {
        try {
          // Vérifier si le modèle est en cache
          const isCached = await cacheService.isModelCached(modelPath);

          // Compter les modèles civils (pour confirmation)
          if (modelPath.includes('civil_AKARLYS') || modelPath.includes('civil_ZAYAN') || modelPath.includes('civil_MEZALAYIS')) {
            civilModelsCount++;
          }

          if (modelPath.endsWith('.fbx')) {
            const model = await new Promise<THREE.Group>((resolve, reject) => {
              this.fbxLoader.load(modelPath, resolve, undefined, reject);
            });
            this.loadedModels.set(modelPath, model);

            // Sauvegarder dans le cache
            if (!isCached) {
              await cacheService.saveModel(modelPath, model);
            }

            // Extraire les animations
            if (model.animations && model.animations.length > 0) {
              this.loadedAnimations.set(modelPath, model.animations);
            }
            actuallyLoaded++;
          } else if (modelPath.endsWith('.obj')) {
            const model = await new Promise<THREE.Group>((resolve, reject) => {
              this.objLoader.load(modelPath, resolve, undefined, reject);
            });
            this.loadedModels.set(modelPath, model);

            // Sauvegarder dans le cache
            if (!isCached) {
              await cacheService.saveModel(modelPath, model);
            }
            actuallyLoaded++;
          } else if (modelPath.endsWith('.gltf') || modelPath.endsWith('.glb')) {
            const gltf = await new Promise<any>((resolve, reject) => {
              this.gltfLoader.load(modelPath, resolve, undefined, reject);
            });
            this.loadedModels.set(modelPath, gltf.scene);

            // Sauvegarder dans le cache
            if (!isCached) {
              await cacheService.saveModel(modelPath, gltf.scene);
            }

            if (gltf.animations && gltf.animations.length > 0) {
              this.loadedAnimations.set(modelPath, gltf.animations);
            }
            actuallyLoaded++;
          }
          updateProgress(modelPath, 'MODELS');
          loaded++;
        } catch (error) {
          console.warn(`❌ Erreur lors du chargement de ${modelPath}:`, error);
          updateProgress(modelPath, 'MODELS');
          loaded++;
          // Ne pas incrémenter actuallyLoaded en cas d'erreur
        }
      }
    }

    console.log(`✅ [PRELOAD] Modèles chargés: ${actuallyLoaded}/${allAssets.length} (réellement chargés)`);

    // Charger les textures
    currentStage = 'TEXTURES';
    let actuallyLoadedTextures = 0;
    for (const texturePath of texturePaths) {
      try {
        // Charger depuis le serveur directement
        const texture = await new Promise<THREE.Texture>((resolve, reject) => {
          this.textureLoader.load(texturePath, resolve, undefined, reject);
        });

        if (texture) {
          if (!texture.userData) texture.userData = {};
          texture.userData.path = texturePath;
          this.loadedTextures.set(texturePath, texture);
          actuallyLoadedTextures++;
        }
        updateProgress(texturePath, 'TEXTURES');
      } catch (error) {
        console.warn(`❌ Erreur lors du chargement de la texture ${texturePath}`);
        updateProgress(texturePath, 'TEXTURES');
      }
    }

    console.log(`✅ [PRELOAD] Textures chargées: ${actuallyLoadedTextures}/${texturePaths.length} (réellement chargées)`);

    // Métadonnées du cache désactivées
    console.log(`ℹ️ [PRELOAD] Préchargement terminé. Actifs chargés: ${actuallyLoaded} modèles, ${actuallyLoadedTextures} textures.`);

    // Initialiser les animations
    currentStage = 'ANIMATIONS';
    updateProgress('Initialisation des animations...', 'ANIMATIONS');

    // Préparer les données des mobs
    currentStage = 'MOBS';
    updateProgress('Préparation des mobs...', 'MOBS');

    // Précharger les shaders (Three.js les charge automatiquement, mais on peut forcer)
    currentStage = 'SHADERS';
    updateProgress('Initialisation des shaders...', 'SHADERS');

    // Forcer le chargement des shaders Three.js
    const testMaterial = new THREE.MeshStandardMaterial();
    const testGeometry = new THREE.BoxGeometry(1, 1, 1);
    const testMesh = new THREE.Mesh(testGeometry, testMaterial);
    testGeometry.dispose();
    testMaterial.dispose();

    // Finalisation
    currentStage = 'COMPLETE';
    updateProgress('Chargement terminé !', 'COMPLETE', `Monde prêt. Cache sécurisé: ${this.formatBytes(this.totalBytesLoaded)}`);
  }

  // Nettoyer les ressources
  public dispose(): void {
    this.loadedModels.forEach(model => {
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    });
    this.loadedTextures.forEach(texture => texture.dispose());
    this.loadedModels.clear();
    this.loadedTextures.clear();
    this.loadedAnimations.clear();
  }
}

export const preloadService = PreloadService.getInstance();

