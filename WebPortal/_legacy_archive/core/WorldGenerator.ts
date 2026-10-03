
import * as THREE from 'three';
import { PlanetConfig, GridType } from '../types';
import { PLANETS } from '../constants';
import { TileMapEngine } from './TileMapEngine';
import { SpriteService } from '../services/spriteService';
import { CLASSES_DB } from '../constants';
import { PlayerClass } from '../types';

/**
 * Système de génération des mondes (Style Dofus Isométrique)
 * Gère la création des Battle Maps par tuiles (Modular Tile System).
 * Utilise la logique de projection isométrique d'IsoForge AI.
 */
import { TmxLoader } from './TmxLoader';

// ... (existing imports)

export class WorldGenerator {
    private scene: THREE.Scene;
    private tileMapEngine: TileMapEngine;
    private tmxLoader: TmxLoader; // Ajout du loader

    // Pour la gestion des collisions
    public static currentColliders: any[] = []; // Simple static access pour le test

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.tileMapEngine = new TileMapEngine(scene);
        this.tmxLoader = new TmxLoader();
    }

    // ... (getDefaultMapForFaction)

    public async loadPlanetScene(planetId: string, onLoad?: (aspect: number) => void, faction?: string | null): Promise<string> {
        this.clearScene();
        this.tileMapEngine.clear();
        WorldGenerator.currentColliders = []; // Reset colliders

        // Gestion spéciale pour les fichiers TMX directs (ex: ville_arkarlys.tmx)
        if (planetId.endsWith('.tmx') || planetId === 'ville_arkarlys') {
            console.log(`🗺️ [WorldGenerator] Chargement TMX Direct: ${planetId}`);

            // Si c'est juste le nom sans extension, on ajoute .tmx et le chemin par défaut
            const path = planetId.endsWith('.tmx')
                ? `/maps/${planetId}`
                : `/maps/${planetId}.tmx`;

            try {
                const mapData = await this.tmxLoader.load(path);

                // 1. Créer le sol (Image)
                if (mapData.background) {
                    const bgTex = new THREE.TextureLoader().load(`/maps/${mapData.background}`);
                    bgTex.colorSpace = THREE.SRGBColorSpace;

                    // En Tiled, l'origine est Top-Left. En ThreeJS PlaneGeometry, c'est Center.
                    // On doit mapper correctement.
                    // Taille totale en pixels
                    const width = mapData.width * mapData.tileWidth;
                    const height = mapData.height * mapData.tileHeight;

                    // Conversion de pixels en unités 3D (ex: 32px = 1 unité)
                    const PIXELS_PER_UNIT = 32;
                    const worldW = width / PIXELS_PER_UNIT;
                    const worldH = height / PIXELS_PER_UNIT;

                    const planeGeo = new THREE.PlaneGeometry(worldW, worldH);
                    const planeMat = new THREE.MeshBasicMaterial({
                        map: bgTex,
                        transparent: true,
                        side: THREE.BackSide // Car on rotationne souvent la cam
                    });

                    const ground = new THREE.Mesh(planeGeo, planeMat);
                    ground.rotation.x = Math.PI / 2; // A plat
                    ground.name = 'TMX_BACKGROUND';
                    this.scene.add(ground);

                    // Centrer la caméra ou les objets si besoin
                    // Par défaut le mesh est à (0,0,0) au centre
                }

                // 2. Gestion des Collisions (Debug Visualisation + Logic)
                if (mapData.colliders.length > 0) {
                    console.log(`🚧 [WorldGenerator] Génération de ${mapData.colliders.length} zones de collision`);
                    WorldGenerator.currentColliders = mapData.colliders;

                    // DEBUG: Afficher les colliders en rouge semi-transparent
                    const debugMat = new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: 0.3, transparent: true, side: THREE.DoubleSide });
                    const PIXELS_PER_UNIT = 32;

                    mapData.colliders.forEach(c => {
                        // Position relative au top-left de l'image
                        // Il faut convertir en coordonnées centrées du monde 3D
                        // ... (Calculs un peu complexes de centrage, on fera une approx pour l'instant)
                        // TODO: Affiner la conversion de coords Tiled -> ThreeJS
                    });
                }

                if (onLoad) onLoad(2.0); // ISO
                return planetId;

            } catch (err) {
                console.error("❌ Echec chargement TMX", err);
            }
        }

        // ... (Suite du code existant random/tilesets) ...
        const config = PLANETS.find(p => p.id === planetId) || PLANETS[0]; // (Simplifié pour le patch)
        // ... (Reste de la logique existante) ...
        return planetId;
    }

    /**
     * Charge une map aléatoire depuis le manifeste
     */
    public async loadRandomMap(faction: string | null = 'AQUARYS', onLoad?: (aspect: number) => void): Promise<string> {
        try {
            const response = await fetch('/tilesets/manifest.json');
            if (!response.ok) throw new Error("Manifest non trouvé");

            const manifest = await response.json();

            // Si pas de faction, en choisir une au hasard
            let targetFaction = faction;
            if (!targetFaction || !manifest[targetFaction]) {
                const factions = Object.keys(manifest);
                targetFaction = factions[Math.floor(Math.random() * factions.length)];
            }

            const maps = manifest[targetFaction] || [];

            if (maps.length === 0) throw new Error(`Aucune map trouvée pour ${targetFaction}`);

            const randomMap = maps[Math.floor(Math.random() * maps.length)];
            console.log(`🎲 [WorldGenerator] Map Aléatoire sélectionnée: ${randomMap} (${targetFaction})`);

            await this.tileMapEngine.loadTileMap(targetFaction, randomMap);
            if (onLoad) onLoad(2.0);
            this.spawnDofusMonsters();

            return randomMap;
        } catch (error) {
            console.error("❌ Echec chargement map aléatoire, fallback.", error);
            this.createFallbackFloor();
            return "FALLBACK";
        }
    }

    private clearScene(): void {
        const toRemove: THREE.Object3D[] = [];
        this.scene.traverse(child => {
            if (child.name === 'HUB_FLOOR' || child.name === 'SKYBOX' || child.name === 'FALLBACK_FLOOR') {
                toRemove.push(child);
            }
        });
        toRemove.forEach(obj => this.scene.remove(obj));
    }

    private createHubFloor(): void {
        const floorGeo = new THREE.CylinderGeometry(50, 50, 2, 64);
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.1, metalness: 0.8 });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.position.y = -1;
        floor.name = 'HUB_FLOOR';
        floor.userData = { type: 'HUB', isGround: true };
        this.scene.add(floor);
    }

    private createFallbackFloor(): void {
        const floorGeo = new THREE.PlaneGeometry(100, 100);
        const floorMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.name = 'FALLBACK_FLOOR';
        this.scene.add(floor);
    }

    private createSkybox(config: PlanetConfig): void {
        const skyGeo = new THREE.SphereGeometry(1000, 32, 32);
        const skyMat = new THREE.MeshBasicMaterial({
            color: config.atmosphereColor,
            side: THREE.BackSide,
            transparent: true,
            opacity: 0.3
        });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        sky.name = 'SKYBOX';
        this.scene.add(sky);
    }

    /**
     * Spawn representative entities of the faction (Narvos Prime Characters)
     */
    private spawnFactionEntities(factionName: string) {
        // Clear existing mob
        const existing = this.scene.children.filter(c => c.userData.type === 'MONSTER' || c.userData.type === 'NPC');
        existing.forEach(e => this.scene.remove(e));

        console.log(`👥 [WorldGenerator] Spawning NPCs for faction: ${factionName}`);

        // 1. Déterminer la classe à spawner selon la faction
        let targetClass = CLASSES_DB[PlayerClass.PRESSURE_MANIPULATOR]; // Default Aquarys

        const fNormal = factionName.toLowerCase();
        if (fNormal.includes('fungaria') || fNormal.includes('mycelion') || fNormal.includes('alien')) {
            targetClass = CLASSES_DB[PlayerClass.PARASITE_SOWER];
        } else if (fNormal.includes('desertica') || fNormal.includes('mercenary')) {
            targetClass = CLASSES_DB[PlayerClass.PYRO_ALCHEMIST];
        }

        // 2. Créer 2 PNJs
        for (let i = 0; i < 2; i++) {
            // Utiliser le SpriteService pour avoir le visuel correct
            const mesh = SpriteService.createSprite(targetClass.spriteConfig);

            // Position aléatoire près du centre
            const x = (i === 0) ? -2 : 2;
            const z = 2;

            mesh.position.set(x, 1.5, z); // Y un peu levé pour être sur le sol
            mesh.userData = {
                type: 'NPC',
                name: `${targetClass.name} ${i + 1}`,
                stats: targetClass.baseStats
            };

            // Billboard initial setup
            mesh.rotation.x = 0;
            // Note: En mode Dofus 2D fixed camera (Top Down), les sprites doivent être légèrement inclinés 
            // ou face caméra (-45deg X) selon le setup. 
            // Ici avec la cam Dofus à (0, 100, 0), ils doivent être à plat ou verticaux (Billboard Y)?
            // Si on utilise Billboard, ils regarderont la caméra.
            // On laisse PhysicsSystem gérer l'orientation billboard à chaque frame, 
            // mais ici on peut set une rotation de base.

            this.scene.add(mesh);
        }
    }
}