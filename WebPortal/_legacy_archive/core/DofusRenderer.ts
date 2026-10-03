/**
 * 🎮 DOFUS RENDERER - Système de rendu 2D authentique
 * 
 * Basé sur l'analyse du code source Dofus:
 * - Maps de 14x20x2 = 560 cellules
 * - Caméra orthographique fixe
 * - Images 2D plates (pas de rotation 3D)
 * - Grille isométrique invisible pour gameplay
 */

import * as THREE from 'three';

// Constantes Dofus officielles (de MapPoint.cs)
export const DOFUS_MAP_WIDTH = 14;   // Colonnes
export const DOFUS_MAP_HEIGHT = 20;  // Lignes
export const DOFUS_MAP_SIZE = DOFUS_MAP_WIDTH * DOFUS_MAP_HEIGHT * 2; // 560 cellules

// Dimensions d'affichage (en pixels logiques)
export const CELL_WIDTH = 86;   // Largeur d'une cellule isométrique
export const CELL_HEIGHT = 43;  // Hauteur d'une cellule (ratio 2:1)

export interface DofusCell {
    id: number;
    x: number;
    y: number;
    screenX: number;
    screenY: number;
    walkable: boolean;
    lineOfSight: boolean;
}

export interface DofusMapConfig {
    id: string;
    imageUrl: string;
    cells: DofusCell[];
    width: number;
    height: number;
}

/**
 * Convertit un CellId en coordonnées (X, Y) - Formule Dofus
 */
export function cellIdToCoords(cellId: number): { x: number; y: number } {
    const row = Math.floor(cellId / (DOFUS_MAP_WIDTH * 2));
    const col = cellId % (DOFUS_MAP_WIDTH * 2);

    const isOddRow = col >= DOFUS_MAP_WIDTH;
    const adjustedCol = isOddRow ? col - DOFUS_MAP_WIDTH : col;

    const x = row + adjustedCol + (isOddRow ? 1 : 0);
    const y = adjustedCol - row + (isOddRow ? 0 : 0);

    return { x, y };
}

/**
 * Convertit des coordonnées (X, Y) en CellId - Formule Dofus
 */
export function coordsToCellId(x: number, y: number): number {
    return (x - y) * DOFUS_MAP_WIDTH + y + Math.floor((x - y) / 2);
}

/**
 * Convertit des coordonnées de grille en position écran (isométrique)
 */
export function gridToScreen(x: number, y: number): { screenX: number; screenY: number } {
    const screenX = (x - y) * (CELL_WIDTH / 2);
    const screenY = (x + y) * (CELL_HEIGHT / 2);
    return { screenX, screenY };
}

/**
 * Convertit une position écran en coordonnées de grille
 */
export function screenToGrid(screenX: number, screenY: number): { x: number; y: number } {
    const x = Math.floor((screenX / (CELL_WIDTH / 2) + screenY / (CELL_HEIGHT / 2)) / 2);
    const y = Math.floor((screenY / (CELL_HEIGHT / 2) - screenX / (CELL_WIDTH / 2)) / 2);
    return { x, y };
}

/**
 * Génère toutes les cellules d'une map Dofus
 */
export function generateDofusCells(): DofusCell[] {
    const cells: DofusCell[] = [];

    let posX = 0;
    let posY = 0;
    let cellCount = 0;

    for (let row = 0; row < DOFUS_MAP_HEIGHT; row++) {
        // Première moitié de la ligne
        for (let col = 0; col < DOFUS_MAP_WIDTH; col++) {
            const x = posX + col;
            const y = posY + col;
            const { screenX, screenY } = gridToScreen(x, y);

            cells.push({
                id: cellCount++,
                x,
                y,
                screenX,
                screenY,
                walkable: true,
                lineOfSight: true
            });
        }
        posX++;

        // Deuxième moitié de la ligne
        for (let col = 0; col < DOFUS_MAP_WIDTH; col++) {
            const x = posX + col;
            const y = posY + col;
            const { screenX, screenY } = gridToScreen(x, y);

            cells.push({
                id: cellCount++,
                x,
                y,
                screenX,
                screenY,
                walkable: true,
                lineOfSight: true
            });
        }
        posY--;
    }

    return cells;
}

/**
 * 🎮 DOFUS RENDERER CLASS
 * Gère le rendu 2D authentique style Dofus
 */
export class DofusRenderer {
    private container: HTMLElement;
    private scene: THREE.Scene;
    private camera: THREE.OrthographicCamera;
    private renderer: THREE.WebGLRenderer;
    private mapSprite: THREE.Sprite | null = null;
    private gridGroup: THREE.Group;
    private cells: DofusCell[] = [];
    private animationFrameId: number | null = null;

    // Dimensions du viewport
    private viewWidth = 1280;
    private viewHeight = 720;

    constructor(container: HTMLElement) {
        this.container = container;
        this.viewWidth = container.clientWidth || 1280;
        this.viewHeight = container.clientHeight || 720;

        // Créer la scène
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a1a2e);

        // Caméra ORTHOGRAPHIQUE (essentiel pour le rendu 2D)
        const aspect = this.viewWidth / this.viewHeight;
        const frustumSize = 600; // Taille de vue
        this.camera = new THREE.OrthographicCamera(
            -frustumSize * aspect / 2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            -frustumSize / 2,
            0.1,
            1000
        );
        // Caméra positionnée au-dessus, regardant vers le bas
        this.camera.position.set(0, 100, 0);
        this.camera.lookAt(0, 0, 0);
        this.camera.up.set(0, 0, -1); // Important: Z négatif vers le haut

        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(this.viewWidth, this.viewHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // Groupe pour la grille
        this.gridGroup = new THREE.Group();
        this.scene.add(this.gridGroup);

        // Générer les cellules
        this.cells = generateDofusCells();

        console.log(`🎮 [DofusRenderer] Initialisé avec ${this.cells.length} cellules`);
    }

    /**
     * Monte le renderer dans le DOM
     */
    public mount(): void {
        this.container.appendChild(this.renderer.domElement);
        this.startRenderLoop();
        window.addEventListener('resize', this.handleResize);
    }

    /**
     * Démonte le renderer
     */
    public unmount(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        window.removeEventListener('resize', this.handleResize);
        this.container.removeChild(this.renderer.domElement);
        this.renderer.dispose();
    }

    private handleResize = (): void => {
        this.viewWidth = this.container.clientWidth;
        this.viewHeight = this.container.clientHeight;

        const aspect = this.viewWidth / this.viewHeight;
        const frustumSize = 600;

        this.camera.left = -frustumSize * aspect / 2;
        this.camera.right = frustumSize * aspect / 2;
        this.camera.top = frustumSize / 2;
        this.camera.bottom = -frustumSize / 2;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(this.viewWidth, this.viewHeight);
    };

    private startRenderLoop(): void {
        const render = () => {
            this.animationFrameId = requestAnimationFrame(render);
            this.renderer.render(this.scene, this.camera);
        };
        render();
    }

    /**
     * Charge et affiche une map Dofus
     */
    public async loadMap(imageUrl: string): Promise<void> {
        console.log(`🗺️ [DofusRenderer] Chargement map: ${imageUrl}`);

        // Supprimer l'ancienne map
        if (this.mapSprite) {
            this.scene.remove(this.mapSprite);
            this.mapSprite = null;
        }

        return new Promise((resolve, reject) => {
            const loader = new THREE.TextureLoader();
            loader.load(
                imageUrl,
                (texture) => {
                    texture.colorSpace = THREE.SRGBColorSpace;
                    texture.magFilter = THREE.LinearFilter;
                    texture.minFilter = THREE.LinearFilter;

                    // Créer un sprite pour la map (rendu 2D plat)
                    const material = new THREE.SpriteMaterial({
                        map: texture,
                        transparent: true
                    });
                    this.mapSprite = new THREE.Sprite(material);

                    // Calculer la taille basée sur l'image
                    const imgWidth = texture.image.width;
                    const imgHeight = texture.image.height;
                    const scale = 0.5; // Ajuster selon besoin

                    this.mapSprite.scale.set(imgWidth * scale, 1, imgHeight * scale);
                    this.mapSprite.position.set(0, 0, 0);

                    // Rotation pour afficher à plat (vue du dessus)
                    this.mapSprite.rotation.x = -Math.PI / 2;

                    this.scene.add(this.mapSprite);

                    console.log(`✅ [DofusRenderer] Map chargée: ${imgWidth}x${imgHeight}`);
                    resolve();
                },
                undefined,
                (error) => {
                    console.error(`❌ [DofusRenderer] Erreur chargement:`, error);
                    reject(error);
                }
            );
        });
    }

    /**
     * Affiche/masque la grille de debug
     */
    public showGrid(visible: boolean): void {
        this.gridGroup.visible = visible;

        if (visible && this.gridGroup.children.length === 0) {
            this.createGridOverlay();
        }
    }

    /**
     * Crée une grille isométrique de debug
     */
    private createGridOverlay(): void {
        const cellGeometry = new THREE.BufferGeometry();

        // Créer une forme de losange (diamant) pour chaque cellule
        const cellShape = new THREE.Shape();
        const hw = CELL_WIDTH / 2;
        const hh = CELL_HEIGHT / 2;
        cellShape.moveTo(0, -hh);
        cellShape.lineTo(hw, 0);
        cellShape.lineTo(0, hh);
        cellShape.lineTo(-hw, 0);
        cellShape.closePath();

        const edgesGeometry = new THREE.EdgesGeometry(new THREE.ShapeGeometry(cellShape));
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.3
        });

        // Ajouter une cellule pour chaque position
        for (const cell of this.cells) {
            if (cell.id % 10 === 0) { // Afficher 1 cellule sur 10 pour le debug
                const line = new THREE.LineSegments(edgesGeometry.clone(), lineMaterial);
                line.position.set(cell.screenX, 0.1, cell.screenY);
                line.rotation.x = -Math.PI / 2;
                this.gridGroup.add(line);
            }
        }

        console.log(`🔲 [DofusRenderer] Grille créée avec ${this.gridGroup.children.length} cellules visibles`);
    }

    /**
     * Obtient la cellule à une position écran donnée
     */
    public getCellAtScreen(screenX: number, screenY: number): DofusCell | null {
        const { x, y } = screenToGrid(screenX, screenY);
        return this.cells.find(c => c.x === x && c.y === y) || null;
    }

    /**
     * Obtient une cellule par son ID
     */
    public getCellById(cellId: number): DofusCell | null {
        return this.cells[cellId] || null;
    }

    /**
     * Obtient les cellules adjacentes
     */
    public getAdjacentCells(cellId: number): DofusCell[] {
        const cell = this.getCellById(cellId);
        if (!cell) return [];

        const adjacent: DofusCell[] = [];
        const directions = [
            { dx: 1, dy: 0 },   // Est
            { dx: 1, dy: -1 },  // Sud-Est
            { dx: 0, dy: -1 },  // Sud
            { dx: -1, dy: 0 },  // Ouest
            { dx: -1, dy: 1 },  // Nord-Ouest
            { dx: 0, dy: 1 },   // Nord
        ];

        for (const dir of directions) {
            const targetX = cell.x + dir.dx;
            const targetY = cell.y + dir.dy;
            const targetCell = this.cells.find(c => c.x === targetX && c.y === targetY);
            if (targetCell && targetCell.walkable) {
                adjacent.push(targetCell);
            }
        }

        return adjacent;
    }

    /**
     * Calcule la distance Manhattan entre deux cellules
     */
    public getDistance(cellA: number, cellB: number): number {
        const a = this.getCellById(cellA);
        const b = this.getCellById(cellB);
        if (!a || !b) return Infinity;

        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    /**
     * Obtient la position Monde 3D d'une cellule (pour placer les entités)
     */
    public cellIdToWorld(cellId: number): THREE.Vector3 {
        const cell = this.getCellById(cellId);
        if (!cell) return new THREE.Vector3(0, 0, 0);

        // Conversion Screen (Pixel) -> World (Three.js units)
        // Ratio hypothétique : 100 pixels = 1 unité, à ajuster selon le scale de la map
        const SCALE_FACTOR = 0.05;

        return new THREE.Vector3(
            cell.screenX * SCALE_FACTOR,
            0.5, // Légèrement au-dessus du sol
            cell.screenY * SCALE_FACTOR
        );
    }

    // Getters
    public getScene(): THREE.Scene { return this.scene; }
    public getCamera(): THREE.OrthographicCamera { return this.camera; }
    public getRenderer(): THREE.WebGLRenderer { return this.renderer; }
    public getCells(): DofusCell[] { return this.cells; }
}

export default DofusRenderer;
