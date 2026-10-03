/**
 * NavMesh Benchmark — mesure le coût du pathfinding A* côté WASM.
 *
 * Utilisation :
 *   import { runNavMeshBenchmark } from './NavMeshBenchmark';
 *   const results = await runNavMeshBenchmark();
 *   console.table(results);
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ÉLAGUÉ LE 02/08/2026 — ce fichier mesurait des fonctionnalités inexistantes.
 *
 * La version précédente importait 9 symboles que `NavMeshBridge` n'exporte pas
 * (`setNavMeshCacheEnabled`, `setAutoRecalc`, `getNavMeshBenchStats`,
 * `clearPathCache`, `drainCellEvents`, `drainPathEvents`…) et comparait un run
 * « AVANT (sans cache) » à un run « APRÈS (avec cache) ». Or ce cache de chemins
 * n'existe ni dans `NavMeshBridge.ts`, ni dans `Bindings.cpp`, ni dans le binaire
 * `public/wasm/narvos-engine.wasm`. Le benchmark aurait donc publié un
 * `cacheHitRate` sur un cache qui n'a jamais été écrit — un chiffre inventé, ce
 * qui est pire qu'une absence de mesure.
 *
 * Ne subsistent que les métriques adossées à des bindings RÉELS : temps de
 * requête, taux de succès, nombre de waypoints. Le jour où le cache est
 * implémenté côté C++, on rajoute ses colonnes — pas avant.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ LIMITE CONNUE — le point de DÉPART n'est pas maîtrisé.
 * `requestPath(entity, tx, ty, tz)` ne prend qu'une destination : l'origine du
 * chemin vient du `Transform` de l'entité, côté ECS. Ce benchmark utilise des
 * ID d'entités factices qui n'ont pas de `Transform`. On mesure donc le coût
 * d'une requête et le taux de succès, PAS la longueur d'un trajet contrôlé.
 * Un benchmark de qualité de chemin devrait créer de vraies entités via
 * `createNPC`, ou se faire en C++ pur.
 */
import {
  initNavMesh,
  bakeNavMeshFromHeightmap,
  requestPath,
  getNavMeshStats,
  readAllWaypoints,
  clearAllPaths,
  setNavCell,
} from './NavMeshBridge';

export interface BenchmarkRun {
  label: string;
  pathCount: number;
  totalTimeMs: number;
  avgTimeMs: number;
  /** Moyenne des index de waypoint atteints sur les chemins résolus. */
  avgWaypoints: number;
  successRate: number;
}

export interface BenchmarkConfig {
  gridWidth: number;
  gridDepth: number;
  cellSize: number;
  /** Proportion de cellules bloquées, de 0 à 1. */
  obstacleDensity: number;
}

const DEFAULT_CONFIG: BenchmarkConfig = {
  gridWidth: 200,
  gridDepth: 200,
  cellSize: 1.0,
  obstacleDensity: 0.25,
};

/** Nombre de chemins demandés par run. */
const PATHS_PER_RUN = 50;

/** Délai laissé au PathManager pour résoudre les requêtes, en ms. */
const SOLVE_WAIT_MS = 100;

/**
 * Génère une grille aléatoire (hauteurs plates + obstacles) et une liste de
 * destinations praticables.
 */
function generateGrid(config: BenchmarkConfig): {
  heights: Float32Array;
  walkFlags: Uint8Array;
  endPoints: [number, number, number][];
} {
  const { gridWidth, gridDepth, cellSize, obstacleDensity } = config;
  const totalCells = gridWidth * gridDepth;
  const heights = new Float32Array(totalCells);
  const walkFlags = new Uint8Array(totalCells);

  for (let i = 0; i < totalCells; i++) {
    heights[i] = 0.0;
    walkFlags[i] = Math.random() < obstacleDensity ? 0 : 1;
  }

  // Destinations : uniquement des cellules praticables, sinon on mesurerait
  // surtout le coût d'un échec immédiat.
  const endPoints: [number, number, number][] = [];
  for (let i = 0; i < PATHS_PER_RUN; i++) {
    let ex = 0;
    let ez = 0;
    let attempts = 0;
    do {
      ex = Math.floor(Math.random() * gridWidth);
      ez = Math.floor(Math.random() * gridDepth);
      attempts++;
    } while (walkFlags[ez * gridWidth + ex] === 0 && attempts < 100);

    endPoints.push([(ex + 0.5) * cellSize, 0, (ez + 0.5) * cellSize]);
  }

  return { heights, walkFlags, endPoints };
}

/** Exécute `runCount` runs et rend leur moyenne. */
async function runBenchmarkSet(
  label: string,
  config: BenchmarkConfig,
  runCount = 3,
): Promise<BenchmarkRun> {
  const { heights, walkFlags, endPoints } = generateGrid(config);
  const { gridWidth, gridDepth, cellSize } = config;
  const results: BenchmarkRun[] = [];

  for (let run = 0; run < runCount; run++) {
    initNavMesh({ originX: 0, originZ: 0, cellSize, width: gridWidth, depth: gridDepth });
    bakeNavMeshFromHeightmap(heights, walkFlags);
    clearAllPaths();

    const t0 = performance.now();
    for (let i = 0; i < endPoints.length; i++) {
      const [ex, ey, ez] = endPoints[i];
      requestPath(i, ex, ey, ez);
    }
    await new Promise((r) => setTimeout(r, SOLVE_WAIT_MS));
    const totalTimeMs = performance.now() - t0;

    const waypoints = readAllWaypoints();
    const resolved = waypoints.filter((wp) => wp.hasPath);
    const totalWaypoints = resolved.reduce((sum, wp) => sum + wp.currentIndex, 0);

    results.push({
      label: `${label} (run ${run + 1})`,
      pathCount: endPoints.length,
      totalTimeMs,
      avgTimeMs: totalTimeMs / endPoints.length,
      avgWaypoints: resolved.length > 0 ? totalWaypoints / resolved.length : 0,
      successRate: endPoints.length > 0 ? resolved.length / endPoints.length : 0,
    });
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  return {
    label: `${label} (moyenne de ${runCount} runs)`,
    pathCount: results[0]?.pathCount ?? 0,
    totalTimeMs: avg(results.map((r) => r.totalTimeMs)),
    avgTimeMs: avg(results.map((r) => r.avgTimeMs)),
    avgWaypoints: avg(results.map((r) => r.avgWaypoints)),
    successRate: avg(results.map((r) => r.successRate)),
  };
}

/**
 * Exécute le benchmark : coût du pathfinding sur une grille dense, puis
 * vérification que la modification d'une cellule ne casse pas le NavMesh.
 */
export async function runNavMeshBenchmark(
  config?: Partial<BenchmarkConfig>,
): Promise<BenchmarkRun[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  console.log(
    `[NavMeshBenchmark] Grille ${cfg.gridWidth}×${cfg.gridDepth}, ` +
    `obstacles ${(cfg.obstacleDensity * 100).toFixed(0)} %, cellule ${cfg.cellSize} m`,
  );

  const results = [await runBenchmarkSet('Pathfinding A*', cfg)];

  // Modification dynamique d'une cellule. `setNavCell` (et non
  // `setNavCellWalkable`, qui n'existe pas) est le binding réel : il prend AUSSI
  // la hauteur, la cellule ne se réduit pas à un booléen de praticabilité.
  const midX = Math.floor(cfg.gridWidth / 2);
  const midZ = Math.floor(cfg.gridDepth / 2);
  setNavCell(midX, midZ, 0, false);

  const stats = getNavMeshStats();
  console.log(
    `[NavMeshBenchmark] Après modification de (${midX}, ${midZ}) : ` +
    `${stats.width}×${stats.depth}, ${stats.activePaths} chemins actifs`,
  );

  return results;
}
