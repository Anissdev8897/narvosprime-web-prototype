/**
 * NavMeshBridge — pont TS pour le navmesh WASM (grille A*) et le PathManager.
 * Upload des données de collision → grille navmesh, requêtes de chemin par entité,
 * lecture bulk des waypoints actifs.
 */
import { getEngine } from "./WasmBridge";

export interface NavMeshConfig {
  originX: number;
  originZ: number;
  cellSize: number;
  width: number;
  depth: number;
}

export interface WaypointEntry {
  entity: number;
  x: number;
  y: number;
  z: number;
  hasPath: boolean;
  currentIndex: number;
}

let waypointBufPtr = 0;
let waypointCountPtr = 0;
const MAX_WAYPOINT_ENTRIES = 256;
const FLOATS_PER_ENTRY = 6;

export function initNavMesh(config: NavMeshConfig): boolean {
  const engine = getEngine();
  if (!engine) return false;
  engine.navInit(config.originX, config.originZ, config.cellSize, config.width, config.depth);

  if (!waypointBufPtr) {
    waypointBufPtr = engine._malloc(MAX_WAYPOINT_ENTRIES * FLOATS_PER_ENTRY * 4);
    waypointCountPtr = engine._malloc(4);
  }
  return true;
}

export function bakeNavMeshFromHeightmap(
  heights: Float32Array,
  walkFlags: Uint8Array,
): void {
  const engine = getEngine();
  if (!engine) return;

  const count = Math.min(heights.length, walkFlags.length);
  const hPtr = engine._malloc(count * 4);
  const wPtr = engine._malloc(count);

  engine.HEAPF32.set(heights, hPtr >> 2);
  new Uint8Array(engine.HEAPF32.buffer).set(walkFlags, wPtr);

  engine.navBakeFromHeightmap(hPtr, wPtr, count);

  engine._free(hPtr);
  engine._free(wPtr);
}

export function setNavCell(x: number, z: number, y: number, walkable: boolean): void {
  const engine = getEngine();
  if (!engine) return;
  engine.navSetCell(x, z, y, walkable);
}

export function isNavWalkable(x: number, z: number): boolean {
  const engine = getEngine();
  if (!engine) return false;
  return engine.navIsWalkable(x, z);
}

export function snapToNavMesh(x: number, y: number, z: number): [number, number, number] {
  const engine = getEngine();
  if (!engine) return [x, y, z];
  return engine.navSnapToNavMesh(x, y, z);
}

export function requestPath(entity: number, tx: number, ty: number, tz: number): void {
  const engine = getEngine();
  if (!engine) return;
  engine.navRequestPath(entity, tx, ty, tz);
}

export function cancelPath(entity: number): void {
  const engine = getEngine();
  if (!engine) return;
  engine.navCancelPath(entity);
}

export function clearAllPaths(): void {
  const engine = getEngine();
  if (!engine) return;
  engine.navClearAllPaths();
}

export function hasPath(entity: number): boolean {
  const engine = getEngine();
  if (!engine) return false;
  return engine.navHasPath(entity);
}

export function isPathComplete(entity: number): boolean {
  const engine = getEngine();
  if (!engine) return true;
  return engine.navIsPathComplete(entity);
}

export function getNextWaypoint(entity: number): [number, number, number] {
  const engine = getEngine();
  if (!engine) return [0, 0, 0];
  return engine.navGetNextWaypoint(entity);
}

export function readAllWaypoints(): WaypointEntry[] {
  const engine = getEngine();
  if (!engine || !waypointBufPtr) return [];

  engine.navReadWaypoints(waypointBufPtr, waypointCountPtr, MAX_WAYPOINT_ENTRIES);
  const count = engine.HEAPU32[waypointCountPtr >> 2];
  if (count === 0) return [];

  const entries: WaypointEntry[] = [];
  const baseOffset = waypointBufPtr >> 2;
  for (let i = 0; i < count; i++) {
    const off = baseOffset + i * FLOATS_PER_ENTRY;
    entries.push({
      entity: engine.HEAPF32[off],
      x: engine.HEAPF32[off + 1],
      y: engine.HEAPF32[off + 2],
      z: engine.HEAPF32[off + 3],
      hasPath: engine.HEAPF32[off + 4] > 0.5,
      currentIndex: engine.HEAPF32[off + 5],
    });
  }
  return entries;
}

export function getNavMeshStats(): { width: number; depth: number; cellSize: number; activePaths: number } {
  const engine = getEngine();
  if (!engine) return { width: 0, depth: 0, cellSize: 0, activePaths: 0 };
  return {
    width: engine.navWidth(),
    depth: engine.navDepth(),
    cellSize: engine.navCellSize(),
    activePaths: engine.navActivePathCount(),
  };
}

export function clearNavMesh(): void {
  const engine = getEngine();
  if (!engine) return;
  engine.navClear();
  engine.navClearAllPaths();
}

export function freeNavBuffers(): void {
  const engine = getEngine();
  if (!engine) return;
  if (waypointBufPtr) { engine._free(waypointBufPtr); waypointBufPtr = 0; }
  if (waypointCountPtr) { engine._free(waypointCountPtr); waypointCountPtr = 0; }
}
