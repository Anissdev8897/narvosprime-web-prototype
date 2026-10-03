
/**
 * Collision Types
 */
export enum CollisionType {
    WALKABLE = 0,    // SOL
    BLOCKED = 1,     // MUR
    TREE_TRUNK = 2,  // BLOQUE LE TRONC
    TREE_LEAVES = 3, // PASSABLE DERRIÈRE LE FEUILLAGE
    VOID = 9         // VIDE (Chute/Mort)
}

/**
 * Color mapping configuration
 */
export interface CollisionColorMap {
    [hex: string]: CollisionType;
}

const DEFAULT_COLOR_MAP: CollisionColorMap = {
    '#ffffff': CollisionType.WALKABLE,    // Blanc = Sol
    '#333333': CollisionType.BLOCKED,     // Gris foncé = Mur
    '#228b22': CollisionType.TREE_TRUNK,  // Vert forêt = Tronc d'arbre
    '#90ee90': CollisionType.TREE_LEAVES, // Vert clair = Feuillage
    '#000000': CollisionType.BLOCKED,     // Noir = Mur (souvent utilisé par défaut)
};

export class CollisionMap {
    private matrix: CollisionType[][] = [];
    private width: number = 0;
    private height: number = 0;
    private tileSize: number = 10; // Pixels per grid cell

    constructor(tileSize: number = 10) {
        this.tileSize = tileSize;
    }

    /**
     * Analyzes an image (URL or local path) and generates a collision matrix.
     * Uses a hidden canvas to read pixel data.
     */
    public async generateFromImage(imageUrl: string, colorMap: CollisionColorMap = DEFAULT_COLOR_MAP): Promise<CollisionType[][]> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = imageUrl;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) {
                    reject(new Error("Could not get canvas context"));
                    return;
                }

                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const cols = Math.ceil(img.width / this.tileSize);
                const rows = Math.ceil(img.height / this.tileSize);
                const matrix: CollisionType[][] = [];

                for (let y = 0; y < rows; y++) {
                    matrix[y] = [];
                    for (let x = 0; x < cols; x++) {
                        // Scan pixels in the tile and determine dominant collision
                        const pixelData = ctx.getImageData(
                            x * this.tileSize,
                            y * this.tileSize,
                            this.tileSize,
                            this.tileSize
                        ).data;

                        matrix[y][x] = this.getDominantCollisionType(pixelData, colorMap);
                    }
                }

                this.matrix = matrix;
                this.width = cols;
                this.height = rows;

                console.log(`[CollisionMap] Generated ${cols}x${rows} matrix from ${imageUrl}`);
                resolve(matrix);
            };

            img.onerror = (err) => reject(new Error(`Failed to load image: ${err}`));
        });
    }

    /**
     * Determines the collision type for a set of pixels (a tile).
     */
    private getDominantCollisionType(pixelData: Uint8ClampedArray, colorMap: CollisionColorMap): CollisionType {
        const counts: Record<number, number> = {};

        for (let i = 0; i < pixelData.length; i += 4) {
            const r = pixelData[i];
            const g = pixelData[i + 1];
            const b = pixelData[i + 2];
            const a = pixelData[i + 3];

            // 1. Transparency check (Alpha < 10)
            if (a < 10) {
                counts[CollisionType.VOID] = (counts[CollisionType.VOID] || 0) + 1;
                continue;
            }

            // 2. Color check
            const hex = this.rgbToHex(r, g, b);
            const type = colorMap[hex] ?? CollisionType.WALKABLE; // Default to walkable if not in map
            counts[type] = (counts[type] || 0) + 1;
        }

        // Return the type with most occurrences in this tile
        return Object.entries(counts).reduce((a, b) => b[1] > a[1] ? b : a, ['0', 0])[0] as any as CollisionType;
    }

    private rgbToHex(r: number, g: number, b: number): string {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toLowerCase();
    }

    /**
     * Checks collision at world coordinates
     * @param x Coordinate in % (0 to 100) or pixels
     * @param y Coordinate in % (0 to 100) or pixels
     * @param isPercent If true, input is 0-100. If false, input is pixels.
     */
    public checkCollision(x: number, y: number, isPercent: boolean = true): CollisionType {
        if (!this.matrix.length) return CollisionType.WALKABLE;

        let gridX: number;
        let gridY: number;

        if (isPercent) {
            gridX = Math.floor((x / 100) * this.width);
            gridY = Math.floor((y / 100) * this.height);
        } else {
            gridX = Math.floor(x / this.tileSize);
            gridY = Math.floor(y / this.tileSize);
        }

        // Bounds check
        if (gridY < 0 || gridY >= this.matrix.length || gridX < 0 || gridX >= this.matrix[0].length) {
            return CollisionType.VOID;
        }

        return this.matrix[gridY][gridX];
    }

    public getMatrix(): CollisionType[][] {
        return this.matrix;
    }
}

/**
 * DEMONSTRATION FUNCTION
 */
export const demoCollisionSystem = async () => {
    const colMap = new CollisionMap(16); // 16px grid

    // Config colors
    const customConfig: CollisionColorMap = {
        '#ffffff': CollisionType.WALKABLE,
        '#ff0000': CollisionType.BLOCKED,      // Rouge = Mur
        '#00ff00': CollisionType.TREE_TRUNK,   // Vert = Arbre
        '#0000ff': CollisionType.VOID          // Bleu = Vide
    };

    try {
        // In a real scenario, you'd load a dedicated "collision mask" image
        // const matrix = await colMap.generateFromImage('/textures/maps/map_01_collision.png', customConfig);

        console.log("Collision system initialized. Ready to check collisions.");

        // Example usage:
        // const type = colMap.checkCollision(50, 50); // Checks middle of the map
        // if (type === CollisionType.BLOCKED) console.log("Blocked!");

    } catch (e) {
        console.error("Collision Demo Error:", e);
    }
};
