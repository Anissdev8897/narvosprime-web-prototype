
import * as THREE from 'three';
import { GridType } from '../types';

export interface GridNode {
    x: number; // Grille X
    z: number; // Grille Z
    walkable: boolean;
    cost: number;
    parent?: GridNode;
    g?: number;
    h?: number;
    f?: number;
}

/**
 * Système de Grille Tactique (Grid System)
 * Gère le pathfinding A* et la navigation par cases (Orthogonal ou Isometric).
 * Inspiré par IsoForge AI pour la partie Isométrique.
 */
export class GridSystem {
    private nodes: GridNode[][] = [];
    private gridSize: number;
    private cellSize: number;
    private worldOffset: THREE.Vector3;
    private aspectRatio: number = 1.0;
    private gridType: GridType = GridType.ISOMETRIC; // Par défaut Isométrique pour le style Dofus

    constructor(
        gridSize: number = 20,
        cellSize: number = 6.4,
        worldOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0),
        type: GridType = GridType.ISOMETRIC
    ) {
        this.gridSize = gridSize;
        this.cellSize = cellSize;
        this.worldOffset = worldOffset;
        this.gridType = type;
        this.initializeGrid();
    }

    public setAspectRatio(aspect: number): void {
        this.aspectRatio = aspect;
    }

    public setGridType(type: GridType): void {
        this.gridType = type;
    }

    private initializeGrid(): void {
        this.nodes = [];
        for (let x = 0; x < this.gridSize; x++) {
            this.nodes[x] = [];
            for (let z = 0; z < this.gridSize; z++) {
                this.nodes[x][z] = {
                    x, z,
                    walkable: true,
                    cost: 1
                };
            }
        }
    }

    /**
     * Convertit une position monde en coordonnées grille
     */
    public worldToGrid(pos: THREE.Vector3): { x: number, z: number } {
        const localX = pos.x - this.worldOffset.x;
        const localZ = pos.z - this.worldOffset.z;

        if (this.gridType === GridType.ISOMETRIC) {
            // Transformation inverse de l'isométrie (Diamant)
            // worldX = (gridX - gridZ) * (cellSizeX / 2)
            // worldZ = (gridX + gridZ) * (cellSizeZ / 2)

            const cellW = this.cellSize;
            const cellH = this.cellSize / 2; // Ratio 2:1 standard Dofus

            // Résolution du système d'équations:
            // gridX = (worldX / cellW) + (worldZ / cellH)
            // gridZ = (worldZ / cellH) - (worldX / cellW)

            const gx = (localX / cellW) + (localZ / cellH);
            const gz = (localZ / cellH) - (localX / cellW);

            return {
                x: Math.round(gx / 1), // Ajusté pour le centrage
                z: Math.round(gz / 1)
            };
        } else {
            // Orthogonal classique
            const totalHeight = this.gridSize * this.cellSize;
            const totalWidth = totalHeight * this.aspectRatio;

            const lx = localX + totalWidth / 2;
            const lz = localZ + totalHeight / 2;

            return {
                x: Math.floor(lx / (this.cellSize * this.aspectRatio)),
                z: Math.floor(lz / this.cellSize)
            };
        }
    }

    /**
     * Convertit des coordonnées grille en position monde (centre de la case)
     */
    public gridToWorld(x: number, z: number): THREE.Vector3 {
        if (this.gridType === GridType.ISOMETRIC) {
            // Logique IsoForge AI / Dofus
            // x, z sont les coordonnées du diamant
            const cellW = this.cellSize;
            const cellH = this.cellSize / 2;

            // worldX = (x - z) * (cellW / 2)
            // worldZ = (x + z) * (cellH / 2)
            const worldX = (x - z) * (cellW / 2);
            const worldZ = (x + z) * (cellH / 2);

            return new THREE.Vector3(
                worldX + this.worldOffset.x,
                this.worldOffset.y,
                worldZ + this.worldOffset.z
            );
        } else {
            // Orthogonal classique centré
            const totalHeight = this.gridSize * this.cellSize;
            const totalWidth = totalHeight * this.aspectRatio;
            const effectiveCellSizeX = this.cellSize * this.aspectRatio;

            return new THREE.Vector3(
                (x * effectiveCellSizeX) - totalWidth / 2 + effectiveCellSizeX / 2 + this.worldOffset.x,
                this.worldOffset.y,
                (z * this.cellSize) - totalHeight / 2 + this.cellSize / 2 + this.worldOffset.z
            );
        }
    }

    /**
     * Pathfinding A* (Style Dofus)
     */
    public findPath(startPos: THREE.Vector3, endPos: THREE.Vector3): THREE.Vector3[] {
        const start = this.worldToGrid(startPos);
        const end = this.worldToGrid(endPos);

        if (!this.isValid(start.x, start.z) || !this.isValid(end.x, end.z)) return [];
        if (!this.nodes[end.x][end.z].walkable) return [];

        // Reset nodes for new search
        for (let i = 0; i < this.gridSize; i++) {
            for (let j = 0; j < this.gridSize; j++) {
                this.nodes[i][j].parent = undefined;
                this.nodes[i][j].g = undefined;
                this.nodes[i][j].f = undefined;
            }
        }

        const openList: GridNode[] = [];
        const closedList: Set<string> = new Set();

        const startNode = this.nodes[start.x][start.z];
        startNode.g = 0;
        startNode.h = this.heuristic(start, end);
        startNode.f = startNode.g + startNode.h;

        openList.push(startNode);

        while (openList.length > 0) {
            openList.sort((a, b) => (a.f || 0) - (b.f || 0));
            const current = openList.shift()!;

            if (current.x === end.x && current.z === end.z) {
                return this.reconstructPath(current);
            }

            closedList.add(`${current.x},${current.z}`);

            const neighbors = this.getNeighbors(current);
            for (const neighbor of neighbors) {
                if (closedList.has(`${neighbor.x},${neighbor.z}`) || !neighbor.walkable) continue;

                const tentativeG = (current.g || 0) + neighbor.cost;

                if (!openList.includes(neighbor) || tentativeG < (neighbor.g || 9999)) {
                    neighbor.parent = current;
                    neighbor.g = tentativeG;
                    neighbor.h = this.heuristic(neighbor, end);
                    neighbor.f = neighbor.g + neighbor.h;

                    if (!openList.includes(neighbor)) {
                        openList.push(neighbor);
                    }
                }
            }
        }

        return [];
    }

    private heuristic(a: { x: number, z: number }, b: { x: number, z: number }): number {
        return Math.abs(a.x - b.x) + Math.abs(a.z - b.z); // Manhattan distance
    }

    private isValid(x: number, z: number): boolean {
        return x >= 0 && x < this.gridSize && z >= 0 && z < this.gridSize;
    }

    private getNeighbors(node: GridNode): GridNode[] {
        const neighbors: GridNode[] = [];
        const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        for (const [dx, dz] of dirs) {
            if (this.isValid(node.x + dx, node.z + dz)) {
                neighbors.push(this.nodes[node.x + dx][node.z + dz]);
            }
        }
        return neighbors;
    }

    private reconstructPath(node: GridNode): THREE.Vector3[] {
        const path: THREE.Vector3[] = [];
        let curr: GridNode | undefined = node;
        while (curr) {
            path.push(this.gridToWorld(curr.x, curr.z));
            curr = curr.parent;
        }
        return path.reverse();
    }

    public setWalkable(worldPos: THREE.Vector3, walkable: boolean): void {
        const coords = this.worldToGrid(worldPos);
        if (this.isValid(coords.x, coords.z)) {
            this.nodes[coords.x][coords.z].walkable = walkable;
        }
    }

    public getGridSize() { return this.gridSize; }
    public getCellSize() { return this.cellSize; }
    public getGridType() { return this.gridType; }
}
