import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { EntityType, Faction, MonsterDef, MonsterEntity, PlayerEntity, AIState } from '../types';
import { CHARACTER_MODELS } from '../components/CharacterSelection';
import { ENTITY_CONFIG } from '../constants';

/**
 * Usine à Entités (Factory Pattern)
 * Gère le chargement et l'instanciation des entités (Joueur, Mobs, PNJ).
 */
export class EntityFactory {
    private fbxLoader: FBXLoader;
    private textureLoader: THREE.TextureLoader;
    private scene: THREE.Scene;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.fbxLoader = new FBXLoader();
        this.textureLoader = new THREE.TextureLoader();
    }

    /**
     * Charge et configure le modèle du joueur
     */
    public async loadPlayerModel(player: PlayerEntity, parentGroup: THREE.Group): Promise<THREE.AnimationMixer | null> {
        try {
            // Trouver le modèle sélectionné ou par défaut
            const characterModel = CHARACTER_MODELS.find(c => c.id === player.characterModelId) || CHARACTER_MODELS[0];
            const modelPath = characterModel.modelPath;

            console.log(`🔄 [EntityFactory] Loading player model: ${modelPath}`);

            const fbx = await this.loadFBX(modelPath);

            // Configuration du modèle
            fbx.scale.set(0.01, 0.01, 0.01); // Échelle standard FBX -> Three.js
            fbx.position.y = -0.9; // Ajustement au sol
            fbx.rotation.y = Math.PI; // Faire face à la caméra

            // Chargement des textures PBR si disponibles
            await this.applyCharacterTextures(fbx, modelPath);

            // Configuration de l'animation
            const mixer = new THREE.AnimationMixer(fbx);
            if (fbx.animations.length > 0) {
                const action = mixer.clipAction(fbx.animations[0]);
                action.play();
            }

            // Nettoyage du placeholder (Capsule)
            parentGroup.children.forEach(child => {
                if (child instanceof THREE.Mesh && child.geometry instanceof THREE.CapsuleGeometry) {
                    parentGroup.remove(child);
                }
            });

            parentGroup.add(fbx);
            return mixer;

        } catch (error) {
            console.error('❌ [EntityFactory] Failed to load player model:', error);
            return null;
        }
    }

    /**
     * Spawn un monstre dans la scène
     */
    public async spawnMonster(def: MonsterDef, position: THREE.Vector3, monstersList: MonsterEntity[], entitiesList?: THREE.Object3D[]): Promise<void> {
        // Création du conteneur
        const group = new THREE.Group();
        group.position.copy(position);

        // Placeholder visuel (en attendant le chargement)
        const placeholder = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.8, 2, 4, 8),
            new THREE.MeshStandardMaterial({ color: 0xff0000 })
        );
        placeholder.position.y = 1;
        group.add(placeholder);

        // ✅ Déterminer le type d'IA selon le monstre (comme dans GameEngine.backup.tsx)
        // Logique similaire à getBehaviorType dans aiService.ts
        let aiModelType: 'AGGRESSIVE' | 'DEFENSIVE' | 'STRATEGIC' = 'DEFENSIVE';
        if (def.aggressiveness > 0.7) {
            aiModelType = 'AGGRESSIVE';
        } else if (def.name.includes('Lurker') || def.name.includes('Goliath') || def.name.includes('Leviathan')) {
            aiModelType = 'STRATEGIC';
        } else {
            aiModelType = 'DEFENSIVE';
        }

        // Configuration de l'entité
        const monsterEntity: MonsterEntity = {
            id: `monster_${Date.now()}_${Math.random()}`,
            monsterDef: def,
            position: position,
            velocity: { x: 0, y: 0, z: 0 },
            rotation: Math.random() * Math.PI * 2,
            mesh: group,
            stats: {
                hp: def.hp, maxHp: def.hp,
                armor: def.armor, maxArmor: def.armor,
                ap: 6, maxAp: 6,
                mp: 3, maxMp: 3,
                range: 0,
                oxygen: 0, maxOxygen: 0
            },
            aiModelType: aiModelType, // ✅ Rôle attribué selon le type de monstre
            currentState: AIState.IDLE,
            lastAIUpdate: Date.now()
        };

        console.log(`👾 [MONSTER SPAWN] ${def.name} | Type IA: ${aiModelType} | Agressivité: ${def.aggressiveness.toFixed(2)}`);

        // Ajout à la scène
        this.scene.add(group);
        monstersList.push(monsterEntity);
        if (entitiesList) {
            entitiesList.push(group);
        }

        // Chargement asynchrone du modèle réel
        // Note: Dans une vraie implémentation, on utiliserait un pool d'objets ou le cache
    }

    /**
     * Spawn des civils (PNJ)
     */
    public spawnCivilians(count: number, faction: Faction, entitiesList: THREE.Object3D[]): void {
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const radius = 30 + Math.random() * 10;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const civilian = new THREE.Mesh(
                new THREE.CapsuleGeometry(0.5, 1.8, 4, 8),
                new THREE.MeshStandardMaterial({
                    color: faction === Faction.HUMAN ? 0x3b82f6 : faction === Faction.ALIEN ? 0x22c55e : 0xeab308
                })
            );
            civilian.position.set(x, 0.9, z);
            civilian.userData = {
                type: 'CIVIL_NPC',
                faction: faction,
                id: `civil_${i}`
            };

            this.scene.add(civilian);
            entitiesList.push(civilian);
        }
    }

    // --- Helpers ---

    private loadFBX(path: string): Promise<THREE.Group> {
        return new Promise((resolve, reject) => {
            this.fbxLoader.load(path, resolve, undefined, reject);
        });
    }

    private async applyCharacterTextures(model: THREE.Group, basePath: string): Promise<void> {
        // Logique simplifiée de chargement de textures
        // Dans le futur, utiliser preloadService ou cacheService
        const dir = basePath.substring(0, basePath.lastIndexOf('/'));
        // ... (Logique de texture ici)
    }
}
