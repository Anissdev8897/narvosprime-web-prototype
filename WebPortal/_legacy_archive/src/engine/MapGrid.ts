/**
 * MapGrid.ts
 * Core logic for Dofus-style isometric diamond grid cells.
 */

export interface MapCell {
  id: number;
  x: number; // Grid X (Isometric)
  y: number; // Grid Y (Isometric)
  walkable: boolean;
  los: boolean;    // Line of Sight
  height: number; // Ground level
}

export class MapGrid {
  private static readonly GRID_WIDTH = 14; 
  private static readonly GRID_HEIGHT = 20;
  private static readonly CELL_COUNT = 560; // 14 * 2 * 20 (roughly)

  // Dofus Diamond Grid constants
  private static readonly MAP_WIDTH = 14.5;
  private static readonly MAP_HEIGHT = 20;

  /**
   * Converts a Cell ID to grid coordinates [X, Y].
   * This follow the standard Dofus coordinate mapping.
   */
  public static cellIdToCoord(cellId: number): { x: number; y: number } {
    const x = cellId % 14;
    const y = Math.floor(cellId / 14);
    
    // In a staggered diamond grid, every second row is offset
    // This is a simplified version. Dofus uses a more complex 1D to 2D mapping
    // for its 560-cell layout.
    return { x, y };
  }

  /**
   * Converts grid coordinates [X, Y] to Screen coordinates [PX, PY].
   * ISO Projection:
   * screenX = (x - y) * (tileWidth / 2)
   * screenY = (x + y) * (tileHeight / 2)
   */
  public static coordToScreen(x: number, y: number, tileWidth: number = 86, tileHeight: number = 43): { px: number; py: number } {
    const px = (x - y) * (tileWidth / 2);
    const py = (x + y) * (tileHeight / 2);
    return { px, py };
  }

  /**
   * Converts Screen coordinates [PX, PY] back to Grid [X, Y].
   */
  public static screenToCoord(px: number, py: number, tileWidth: number = 86, tileHeight: number = 43): { x: number; y: number } {
    const x = (py / (tileHeight / 2) + px / (tileWidth / 2)) / 2;
    const y = (py / (tileHeight / 2) - px / (tileWidth / 2)) / 2;
    return { x: Math.round(x), y: Math.round(y) };
  }

  /**
   * Gets the Cell ID from grid coordinates.
   */
  public static coordToCellId(x: number, y: number): number {
    return y * 14 + x;
  }

  /**
   * Calculates the distance between two cells.
   */
  public static getDistance(c1: number, c2: number): number {
    const p1 = this.cellIdToCoord(c1);
    const p2 = this.cellIdToCoord(c2);
    return Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
  }
}
