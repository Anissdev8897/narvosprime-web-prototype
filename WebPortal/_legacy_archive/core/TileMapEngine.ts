
import * as THREE from 'three';
import { GridType } from '../types';

export interface TileMapData {
    name: string;
    faction: string;
    tileSize: number;
    cols: number;
    rows: number;
    totalUniqueTiles: number;
    data: number[][];
}

/**
 * Moteur de TileMap Isométrique (Style Dofus / IsoForge AI)
 * Affiche les maps comme une grille de diamants composée de tuiles individuelles.
 */
export class TileMapEngine {
    private scene: THREE.Scene;
    private textureLoader: THREE.TextureLoader;
    private tileCache: Map<string, THREE.Texture> = new Map();
    private currentMapGroup: THREE.Group | null = null;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.textureLoader = new THREE.TextureLoader();
    }

    /**
     * Charge une map à partir de son fichier JSON tileset ou .tileset direct
     */
    public async loadTileMap(faction: string, mapName: string): Promise<THREE.Group> {
        console.log(`🗺️ [TileMapEngine] Tentative de chargement de: ${mapName} (${faction})`);

        // 🖼️ STRATÉGIE 1 : Image Normale (Full Render) - STYLE DOFUS
        const category = this.inferCategory(mapName);
        const extensions = ['.png', '.jpg', '.jpeg'];

        for (const ext of extensions) {
            const fullImagePath = `/textures/dofus_maps/${faction}/${category}/${mapName}${ext}`;
            try {
                // console.log(`🖼️ [TileMapEngine] Check Image: ${fullImagePath}`);
                const checkResp = await fetch(fullImagePath, { method: 'HEAD' });
                if (checkResp.ok) {
                    console.log(`✅ [TileMapEngine] Image trouvée (${ext}), rendu Direct Plane.`);
                    return await this.renderFullImageMap(fullImagePath, mapName);
                }
            } catch (e) {
                // Continue to next extension or strategy
            }
        }

        // 📦 STRATÉGIE 2 : Nouveau format .tileset direct
        const tilesetPath = `/maps_data/${mapName}.tileset`;
        try {
            const resp = await fetch(tilesetPath);
            // Vérifier si c'est réellement du JSON (évite les fallbacks 200 HTML des serveurs SPA)
            const contentType = resp.headers.get("content-type");
            if (resp.ok && contentType && contentType.includes("application/json")) {
                console.log(`📦 [TileMapEngine] Nouveau format JSON détecté: ${tilesetPath}`);
                const fullData = await resp.json();
                return this.renderFullTileset(fullData, mapName);
            } else if (resp.ok) {
                // Si c'est un .tileset mais pas JSON (probablement renommé sans extension correcte ou erreur serveur)
                // On tente quand même de le parser si l'extension .tileset est là, sauf si c'est du HTML
                const text = await resp.text();
                if (!text.trim().startsWith("<html")) {
                    console.log(`📦 [TileMapEngine] Format .tileset détecté (par extension): ${tilesetPath}`);
                    const fullData = JSON.parse(text);
                    return this.renderFullTileset(fullData, mapName);
                }
            }
        } catch (e) {
            console.log(`[TileMapEngine] Echec .tileset direct (${mapName}), passage au fallback classique.`);
        }

        // 🗺️ STRATÉGIE 3 : Fallback Classique (Structure /tilesets/...)
        const f = faction;
        const m = mapName;
        const jsonPath = `/tilesets/${encodeURIComponent(f)}/${encodeURIComponent(m)}/map_data.json`;
        console.log(`🗺️ [TileMapEngine] Requete JSON: ${jsonPath}`);

        try {
            const response = await fetch(jsonPath);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const mapData: TileMapData = await response.json();
            console.log(`📐 [TileMapEngine] Map: ${mapData.cols}x${mapData.rows} (ISO Diamond Mode)`);

            const mapGroup = new THREE.Group();
            mapGroup.name = `TILEMAP_${mapName}`;

            // Dimensions mondiales basé sur logic IsoForge AI
            const tileW = mapData.tileSize / 10; // 6.4 units
            const tileH = tileW / 2;             // 3.2 units

            const uniqueIds = Array.from(new Set(mapData.data.flat()));
            const tileTextures = new Map<number, THREE.Texture>();

            for (const id of uniqueIds) {
                try {
                    const url = `/tilesets/${f}/${m}/tiles/tile_${id}.png`;
                    const tex = await this.loadTexture(url);
                    tileTextures.set(id, tex);
                } catch (e) {
                    console.warn(`Tile ${id} failed to load`);
                }
            }

            const geometry = new THREE.PlaneGeometry(tileW, tileW);
            let totalTiles = 0;
            const rows = mapData.data.length;

            for (let r = 0; r < rows; r++) {
                const cols = mapData.data[r].length;
                for (let c = 0; c < cols; c++) {
                    const tileId = mapData.data[r][c];
                    const texture = tileTextures.get(tileId);
                    if (!texture) continue;

                    const material = new THREE.MeshBasicMaterial({
                        map: texture,
                        transparent: true,
                        side: THREE.DoubleSide,
                        alphaTest: 0.1
                    });
                    const tile = new THREE.Mesh(geometry, material);
                    const worldX = (c - r) * (tileW / 2);
                    const worldZ = (c + r) * (tileH / 2);
                    tile.position.set(worldX, 0, worldZ);
                    tile.rotation.x = -Math.PI / 2;
                    mapGroup.add(tile);
                    totalTiles++;
                }
            }

            this.currentMapGroup = mapGroup;
            this.scene.add(mapGroup);
            console.log(`✅ [TileMapEngine] ${totalTiles} tuiles ISO rendues.`);
            return mapGroup;
        } catch (error) {
            console.warn(`⚠️ [TileMapEngine] Toutes stratégies échouées pour ${mapName}.`);
            throw new Error(`Map not found: ${mapName}`);
        }
    }

    /**
     * Crée un sol basique de fallback quand aucune map n'est trouvée
     */
    private createFallbackGround(mapName: string): THREE.Group {
        const mapGroup = new THREE.Group();
        mapGroup.name = `FALLBACK_${mapName}`;
        mapGroup.userData = { type: 'TILEMAP', isGround: true };

        // Sol isométrique simple avec grid visible
        const gridSize = 20;
        const tileW = 3.2;
        const tileH = 1.6;

        const geometry = new THREE.PlaneGeometry(tileW, tileH);

        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                const material = new THREE.MeshBasicMaterial({
                    color: (r + c) % 2 === 0 ? 0x1e3a5f : 0x0f2847,
                    transparent: true,
                    opacity: 0.9,
                    side: THREE.DoubleSide
                });
                const tile = new THREE.Mesh(geometry, material);
                const worldX = (c - r) * (tileW / 2);
                const worldZ = (c + r) * (tileH / 2);
                tile.position.set(worldX, 0, worldZ);
                tile.rotation.x = -Math.PI / 2;
                mapGroup.add(tile);
            }
        }

        // Centrer le groupe
        mapGroup.position.set(0, 0, -gridSize * tileH / 2);

        this.currentMapGroup = mapGroup;
        this.scene.add(mapGroup);
        console.log(`✅ [TileMapEngine] Sol de fallback créé (${gridSize}x${gridSize} tuiles)`);
        return mapGroup;
    }

    /**
     * 🎮 RENDU 2D AUTHENTIQUE STYLE DOFUS
     * Affiche l'image de map à plat, sans rotation 3D ni masque
     */
    private async renderFullImageMap(imageUrl: string, mapName: string): Promise<THREE.Group> {
        const mapGroup = new THREE.Group();
        mapGroup.name = `FULLMAP_${mapName}`;
        mapGroup.userData = { type: 'TILEMAP', isGround: true, is2DMap: true };

        // Charger et encoder le chemin pour les caractères spéciaux (DÉSERTICA)
        const encodedUrl = imageUrl.split('/').map(segment =>
            segment === 'textures' || segment === 'dofus_maps' ? segment : encodeURIComponent(segment)
        ).join('/');

        const texture = await this.loadTexture(encodedUrl);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearFilter;

        // 🎮 RENDU 2D PLAT - Style Dofus Authentique
        // Utilise un MeshBasicMaterial simple sans éclairage
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.FrontSide,
            depthWrite: true,
            depthTest: true
        });

        // Calculer les dimensions basées sur l'image
        const img = texture.image as HTMLImageElement | undefined;
        const imgWidth = img?.width || 1024;
        const imgHeight = img?.height || 1024;

        // Échelle pour adapter à la vue (ajuster selon besoin)
        const SCALE = 0.15; // Pixels vers unités monde
        const worldWidth = imgWidth * SCALE;
        const worldHeight = imgHeight * SCALE;

        const geometry = new THREE.PlaneGeometry(worldWidth, worldHeight);
        const plane = new THREE.Mesh(geometry, material);

        // 🎯 POSITION À PLAT SUR LE SOL
        // La map est affichée horizontalement (rotation X de -90°)
        // Position Y légèrement au-dessus de 0 pour éviter z-fighting
        plane.rotation.x = -Math.PI / 2;
        plane.position.set(0, 0.01, 0);

        mapGroup.add(plane);
        this.currentMapGroup = mapGroup;
        this.scene.add(mapGroup);

        console.log(`✅ [TileMapEngine] Map 2D Dofus chargée: ${mapName} (${imgWidth}x${imgHeight} -> ${worldWidth.toFixed(1)}x${worldHeight.toFixed(1)})`);
        return mapGroup;
    }

    private inferCategory(mapName: string): string {
        const mn = mapName.toLowerCase();
        if (mn.includes('donjon')) return 'donjon';
        if (mn.includes('exterieur_ville')) return 'exterieur_ville';
        if (mn.includes('ville')) return 'ville';
        if (mn.includes('exterieur')) return 'exterieur';
        if (mn.includes('station')) return 'station';
        return 'exterieur';
    }

    private async renderFullTileset(data: any, mapName: string): Promise<THREE.Group> {
        const mapGroup = new THREE.Group();
        mapGroup.name = `TILEMAP_${mapName}`;
        mapGroup.userData = { type: 'TILEMAP', isGround: true };

        const tileW = 6.4;
        const tileH = 3.2; // FIX: Ratio 2:1 pour Dofus
        const geometry = new THREE.PlaneGeometry(tileW, tileH);

        if (!data.tiles || !Array.isArray(data.tiles)) {
            console.warn(`⚠️ [TileMapEngine] Données de tuiles invalides pour ${mapName}`);
            return mapGroup;
        }

        console.log(`🏗️ [TileMapEngine] Rendu de ${data.tiles.length} tuiles (Direct Mode)...`);

        for (const tileData of data.tiles) {
            try {
                const texture = await this.loadTexture(tileData.data);
                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    side: THREE.DoubleSide,
                    alphaTest: 0.1
                });
                const tile = new THREE.Mesh(geometry, material);
                const c = tileData.gridX;
                const r = tileData.gridY;

                // Logique IsoDiamond: X=(col-row)*W/2, Z=(col+row)*H/2
                const worldX = (c - r) * (tileW / 2);
                const worldZ = (c + r) * (tileH / 2);

                tile.position.set(worldX, 0, worldZ);
                tile.rotation.x = -Math.PI / 2;
                mapGroup.add(tile);
            } catch (e) {
                console.warn(`Failed to render tile ${tileData.id}`);
            }
        }

        this.currentMapGroup = mapGroup;
        this.scene.add(mapGroup);
        console.log(`✅ [TileMapEngine] Map Group ajouté à la scène: ${mapGroup.name} (${data.tiles.length} tuiles)`);
        return mapGroup;
    }

    private loadTexture(path: string): Promise<THREE.Texture> {
        if (this.tileCache.has(path)) return Promise.resolve(this.tileCache.get(path)!);
        return new Promise((resolve, reject) => {
            this.textureLoader.load(path, (tex) => {
                tex.magFilter = THREE.NearestFilter;
                tex.minFilter = THREE.NearestFilter;
                this.tileCache.set(path, tex);
                resolve(tex);
            }, undefined, reject);
        });
    }

    public clear() {
        if (this.currentMapGroup) {
            this.scene.remove(this.currentMapGroup);
            this.currentMapGroup.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry?.dispose();
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material?.dispose();
                }
            });
            this.currentMapGroup = null;
        }
    }
}
