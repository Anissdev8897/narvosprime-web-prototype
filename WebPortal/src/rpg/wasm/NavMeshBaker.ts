/**
 * NavMeshBaker — échantillonne la CollisionWorld pour construire un navmesh
 * grille A* dans le WASM. Appelé une fois après le chargement de la map.
 *
 * Pipeline :
 *   1. computeBounds() → AABB de la géométrie collidable
 *   2. Grille régulière (cellSize m) dans l'AABB
 *   3. Par cellule : getGroundY → hauteur, isBlocked → walkability
 *   4. initNavMesh + bakeNavMeshFromHeightmap → A* prêt
 */
import * as THREE from "three";
import { collisionWorld } from "../runtime/CollisionWorld";
import { isEngineLoaded } from "./WasmBridge";
import { initNavMesh, bakeNavMeshFromHeightmap, clearNavMesh } from "./NavMeshBridge";
import type { NavMeshConfig } from "./NavMeshBridge";

export interface BakeResult {
  ok: boolean;
  gridWidth: number;
  gridDepth: number;
  walkableCells: number;
  totalCells: number;
  elapsedMs: number;
}

const DEFAULT_CELL_SIZE = 1.0;
const PADDING = 2.0;
// PLAFOND DE CELLULES — mesuré, pas estimé.
//
// À 500 000 cellules, le bake faisait DEUX raycasts par cellule (getGroundY +
// isBlocked) sur une scène à ~4 500 textures : 1 million de raycasts dans une
// boucle synchrone, chronométré à 357 SECONDES sur la forge. Le thread principal
// restait bloqué tout ce temps, ce qui déclenchait le filet de sécurité de 2 min
// et empêchait la map de se révéler.
//
// 40 000 cellules suffisent largement : sur une carte de 3,4 km ça donne une
// maille d'environ 17 m, assez fine pour du pathfinding de PNJ qui se déplacent
// par waypoints — la précision finale vient du contrôleur, pas de la grille.
const MAX_CELLS = 40_000;

const _probeFrom = new THREE.Vector3();
const _probeDelta = new THREE.Vector3();

// === Cache de bake par empreinte de scène ===
//
// Problème : WasmWorldTicker a un useEffect dépendant de [enabled], donc
// chaque démontage/remontage (changement de personnage, sortie vaisseau)
// efface le navmesh WASM (clearBakedNavMesh) puis relance un bake complet.
// Sur la Forge, ça prend ~16s alors que la scène de collision n'a pas changé.
//
// Solution : on mémorise le résultat du dernier bake (heights, walkFlags,
// config) indexé par une empreinte légère de la scène de collision. Si
// l'empreinte est identique, on ré-upload directement les données au
// lieu de refaire tous les raycasts.
interface CachedBake {
  fingerprint: string;
  config: NavMeshConfig;
  heights: Float32Array;
  walkFlags: Uint8Array;
  walkableCells: number;
  totalCells: number;
}
let _cachedBake: CachedBake | null = null;

function computeCollisionFingerprint(): string {
  // Empreinte légère : nombre de colliders + AABB serialisé.
  // Si un chunk est ajouté/retiré, le nombre ou les bornes changent → rebake.
  const bounds = collisionWorld.computeBounds();
  return `${collisionWorld.colliderCount}|${bounds.min.x.toFixed(1)},${bounds.min.z.toFixed(1)}-${bounds.max.x.toFixed(1)},${bounds.max.z.toFixed(1)}`;
}

export async function bakeNavMeshFromScene(): Promise<BakeResult> {
  const fail: BakeResult = { ok: false, gridWidth: 0, gridDepth: 0, walkableCells: 0, totalCells: 0, elapsedMs: 0 };
  if (!isEngineLoaded()) return fail;
  if (collisionWorld.colliderCount === 0) return fail;

  const t0 = performance.now();

  // === Cache hit : ré-upload direct, aucun raycast ===
  const fingerprint = computeCollisionFingerprint();
  if (_cachedBake && _cachedBake.fingerprint === fingerprint) {
    const ok = initNavMesh(_cachedBake.config);
    if (ok) {
      bakeNavMeshFromHeightmap(_cachedBake.heights, _cachedBake.walkFlags);
      const elapsedMs = performance.now() - t0;
      console.info(
        `[NavMeshBaker] cache hit — ${_cachedBake.config.width}×${_cachedBake.config.depth} ré-uploadé en ${elapsedMs.toFixed(0)}ms ` +
        `(${_cachedBake.walkableCells}/${_cachedBake.totalCells} walkable)`,
      );
      return {
        ok: true,
        gridWidth: _cachedBake.config.width,
        gridDepth: _cachedBake.config.depth,
        walkableCells: _cachedBake.walkableCells,
        totalCells: _cachedBake.totalCells,
        elapsedMs,
      };
    }
    // Si initNavMesh échoue (ne devrait pas arriver), on tombe sur le full bake.
    console.warn('[NavMeshBaker] échec initNavMesh depuis cache, full bake de secours');
  }

  const bounds = collisionWorld.computeBounds();
  if (bounds.isEmpty()) return fail;

  const originX = bounds.min.x - PADDING;
  const originZ = bounds.min.z - PADDING;
  const extentX = bounds.max.x - bounds.min.x + PADDING * 2;
  const extentZ = bounds.max.z - bounds.min.z + PADDING * 2;

  let cellSize = DEFAULT_CELL_SIZE;
  let gridWidth = Math.ceil(extentX / cellSize);
  let gridDepth = Math.ceil(extentZ / cellSize);
  let totalCells = gridWidth * gridDepth;

  if (totalCells > MAX_CELLS) {
    cellSize = Math.sqrt((extentX * extentZ) / MAX_CELLS);
    gridWidth = Math.ceil(extentX / cellSize);
    gridDepth = Math.ceil(extentZ / cellSize);
    totalCells = gridWidth * gridDepth;
    console.info(`[NavMeshBaker] grille adaptée : cellSize ${cellSize.toFixed(2)} m (${gridWidth}×${gridDepth} = ${totalCells} cells)`);
  }

  const ok = initNavMesh({ originX, originZ, cellSize, width: gridWidth, depth: gridDepth });
  if (!ok) return fail;

  const heights = new Float32Array(totalCells);
  const walkFlags = new Uint8Array(totalCells);
  let walkableCells = 0;

  const probeHeight = bounds.max.y + 5;
  const halfCell = cellSize * 0.5;

  // BUDGET DE TEMPS, PAS COMPTEUR DE RANGÉES.
  //
  // C'était « rendre la main toutes les 16 rangées ». Le coût d'une rangée
  // dépend entièrement de la scène : mesuré sur la Forge (959 colliders,
  // grille 204×197), le bake entier prend 22 395 ms, soit ~114 ms par rangée
  // — donc ~1,8 s de blocage entre deux respirations, douze fois de suite.
  // Un compteur de rangées ne peut pas s'adapter : il donne le même nombre de
  // pauses sur une map vide que sur la Forge.
  //
  // On mesure donc le temps réellement écoulé et on rend la main dès qu'une
  // frame est consommée. Le bake dure aussi longtemps, mais il ne bloque plus
  // jamais l'affichage plus d'une frame d'affilée.
  // Le test doit être au niveau CELLULE, pas rangée : une rangée coûte à elle
  // seule ~114 ms sur la Forge, donc un contrôle en début de rangée laisserait
  // encore passer un blocage de 114 ms. À ~0,28 ms la cellule, on respire tous
  // les ~21 probes.
  const BUDGET_MS = 6;
  let dernierYield = performance.now();
  for (let iz = 0; iz < gridDepth; iz++) {
    const wz = originZ + iz * cellSize + halfCell;
    for (let ix = 0; ix < gridWidth; ix++) {
      if (performance.now() - dernierYield >= BUDGET_MS) {
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
        dernierYield = performance.now();
      }
      const idx = iz * gridWidth + ix;
      const wx = originX + ix * cellSize + halfCell;

      const gy = collisionWorld.getGroundY(wx, wz, probeHeight);
      if (gy === null) {
        heights[idx] = -9999;
        walkFlags[idx] = 0;
        continue;
      }
      heights[idx] = gy;

      _probeFrom.set(wx, gy + 0.5, wz);
      _probeDelta.set(0, 0, 0);
      const blocked = collisionWorld.isBlocked(
        _probeFrom,
        _probeDelta.set(cellSize * 0.3, 0, 0),
        0.2,
      );
      walkFlags[idx] = blocked ? 0 : 1;
      if (!blocked) walkableCells++;
    }
  }

  bakeNavMeshFromHeightmap(heights, walkFlags);
  const elapsedMs = performance.now() - t0;

  // Stocke dans le cache pour les ré-uploads futurs (changement de perso,
  // sortie vaisseau…). Les tableaux sont clonés pour éviter que le cache
  // ne référence des buffers WASM libérés par un clear ultérieur.
  _cachedBake = {
    fingerprint,
    config: { originX, originZ, cellSize, width: gridWidth, depth: gridDepth },
    heights: new Float32Array(heights),
    walkFlags: new Uint8Array(walkFlags),
    walkableCells,
    totalCells,
  };

  console.info(
    `[NavMeshBaker] ${gridWidth}×${gridDepth} grille baked en ${elapsedMs.toFixed(0)}ms ` +
    `(${walkableCells}/${totalCells} walkable, cell=${cellSize}m)`,
  );

  return { ok: true, gridWidth, gridDepth, walkableCells, totalCells, elapsedMs };
}

export function clearBakedNavMesh(): void {
  if (!isEngineLoaded()) return;
  clearNavMesh();
}
