// ══════════════════════════════════════════════════════════════════════════════
// perf/navMesh.mjs — Benchmark du NavMesh (calculs préparatoires)
//
// Mesure :
//   - bake time : computeGrid, computeAdaptiveCellSize
//   - pathfind time : A* simplifié sur grille
//   - mémoire : empreinte de la grille pour différentes tailles de map
//
// Les benchmarks testent les fonctions extraites du NavMeshBaker TS.
// Le vrai bake WASM nécessite un module WASM chargé (non testable ici).
// ══════════════════════════════════════════════════════════════════════════════

import { performance } from 'perf_hooks';

// ── Fonctions extraites du NavMeshBaker (src/rpg/wasm/NavMeshBaker.ts) ─────

const MAX_CELLS = 40_000;

function computeGridDims(bounds, cellSize) {
  const width = Math.ceil((bounds.max.x - bounds.min.x) / cellSize);
  const depth = Math.ceil((bounds.max.z - bounds.min.z) / cellSize);
  const total = width * depth;
  return { width, depth, total };
}

function computeAdaptiveCellSize(bounds, maxCells = MAX_CELLS) {
  const area = (bounds.max.x - bounds.min.x) * (bounds.max.z - bounds.min.z);
  return Math.sqrt(area / maxCells);
}

// ── A* simplifié sur grille navmesh ─────────────────────────────────────────

function manhattan(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
}

function pathfindAStar(grid, start, end, obstacles) {
  // grid: { width, depth, cells }
  // obstacles: Set<string> de "x,z" bloqués
  const open = [{ x: start.x, z: start.z, g: 0, f: manhattan(start, end), parent: null }];
  const closed = new Set();
  const cameFrom = new Map();
  const gScore = new Map();
  const key = (x, z) => `${x},${z}`;

  gScore.set(key(start.x, start.z), 0);

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift();
    const ck = key(current.x, current.z);

    if (current.x === end.x && current.z === end.z) {
      // Reconstruire chemin
      const path = [];
      let node = current;
      while (node) {
        path.unshift({ x: node.x, z: node.z });
        node = node.parent;
      }
      return path;
    }

    closed.add(ck);

    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
    for (const [dx, dz] of dirs) {
      const nx = current.x + dx;
      const nz = current.z + dz;
      const nk = key(nx, nz);

      if (nx < 0 || nx >= grid.width || nz < 0 || nz >= grid.depth) continue;
      if (closed.has(nk)) continue;
      if (obstacles.has(nk)) continue;

      const tentativeG = current.g + (dx !== 0 && dz !== 0 ? 1.414 : 1);
      if (tentativeG >= (gScore.get(nk) ?? Infinity)) continue;

      gScore.set(nk, tentativeG);
      const f = tentativeG + manhattan({ x: nx, z: nz }, end);
      open.push({ x: nx, z: nz, g: tentativeG, f, parent: current });
    }
  }

  return null; // Pas de chemin
}

// ── Génération de grille d'obstacles pour pathfinding test ──────────────────

function generateGrid(width, depth, obstacleRatio = 0.15) {
  const obstacles = new Set();
  const rng = seed => {
    let s = seed;
    return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  };
  const rand = rng(42);
  for (let x = 0; x < width; x++) {
    for (let z = 0; z < depth; z++) {
      if (rand() < obstacleRatio) {
        obstacles.add(`${x},${z}`);
      }
    }
  }
  return obstacles;
}

// ══════════════════════════════════════════════════════════════════════════════
// Benchmarks individuels
// ══════════════════════════════════════════════════════════════════════════════

export async function runBenchmark(options = {}) {
  const { verbose = false } = options;
  const results = [];

  // 1. computeGridDims — map taille forge (400×400)
  {
    const bounds = { min: { x: -200, z: -200 }, max: { x: 200, z: 200 } };
    const times = [];
    for (let i = 0; i < 100; i++) {
      const t0 = performance.now();
      computeGridDims(bounds, 1.0);
      times.push(performance.now() - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const result = {
      name: 'NavMesh computeGrid (400×400)',
      group: 'navMesh',
      scenario: 'computeGrid',
      samples: 100,
      meanMs: avg,
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
      unit: 'ms',
      iterations: 100,
    };
    results.push(result);
    if (verbose) console.log(`[BENCH] computeGrid 400×400 : ${avg.toFixed(4)}ms`);
  }

  // 2. computeAdaptiveCellSize — grande map (2000×2000)
  {
    const bounds = { min: { x: -1000, z: -1000 }, max: { x: 1000, z: 1000 } };
    const times = [];
    for (let i = 0; i < 1000; i++) {
      const t0 = performance.now();
      computeAdaptiveCellSize(bounds);
      times.push(performance.now() - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const result = {
      name: 'NavMesh computeAdaptiveCellSize (2000×2000)',
      group: 'navMesh',
      scenario: 'computeAdaptive',
      samples: 1000,
      meanMs: avg,
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
      unit: 'ms',
      iterations: 1000,
    };
    results.push(result);
    if (verbose) console.log(`[BENCH] computeAdaptiveCellSize 2000×2000 : ${avg.toFixed(6)}ms`);
  }

  // 3. Grille max cells check — map extrême 10km
  {
    const bounds = { min: { x: -5000, z: -5000 }, max: { x: 5000, z: 5000 } };
    const cellSize = computeAdaptiveCellSize(bounds);
    const grid = computeGridDims(bounds, cellSize);
    const result = {
      name: 'NavMesh grid bounds (10km)',
      group: 'navMesh',
      scenario: 'gridBounds',
      samples: 1,
      meanMs: 0,
      gridWidth: grid.width,
      gridDepth: grid.depth,
      gridTotal: grid.total,
      cellSize: cellSize,
      underLimit: grid.total <= MAX_CELLS + 1000,
      unit: 'cells',
      iterations: 1,
    };
    results.push(result);
    if (verbose) console.log(`[BENCH] Grid 10km : ${grid.width}×${grid.depth}=${grid.total} cells (cellSize=${cellSize.toFixed(2)}m)`);
  }

  // 4. Pathfinding A* — temps de pathfind sur grille 50×50
  {
    const grid = { width: 50, depth: 50 };
    const obstacles = generateGrid(50, 50, 0.2);
    const times = [];
    for (let i = 0; i < 50; i++) {
      const start = { x: 0, z: 0 };
      const end = { x: 49, z: 49 };
      const t0 = performance.now();
      pathfindAStar(grid, start, end, obstacles);
      times.push(performance.now() - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const result = {
      name: 'NavMesh pathfind A* (50×50)',
      group: 'navMesh',
      scenario: 'pathfind',
      samples: 50,
      meanMs: avg,
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
      unit: 'ms',
      iterations: 50,
    };
    results.push(result);
    if (verbose) console.log(`[BENCH] Pathfind A* 50×50 : ${avg.toFixed(4)}ms`);
  }

  // 5. Pathfinding sur grande grille (100×100)
  {
    const grid = { width: 100, depth: 100 };
    const obstacles = generateGrid(100, 100, 0.15);
    const times = [];
    for (let i = 0; i < 20; i++) {
      const start = { x: 0, z: 0 };
      const end = { x: 99, z: 99 };
      const t0 = performance.now();
      pathfindAStar(grid, start, end, obstacles);
      times.push(performance.now() - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const result = {
      name: 'NavMesh pathfind A* (100×100)',
      group: 'navMesh',
      scenario: 'pathfindLarge',
      samples: 20,
      meanMs: avg,
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
      unit: 'ms',
      iterations: 20,
    };
    results.push(result);
    if (verbose) console.log(`[BENCH] Pathfind A* 100×100 : ${avg.toFixed(4)}ms`);
  }

  return results;
}

export async function runSuite(options = {}) {
  return await runBenchmark(options);
}

// Exécution directe
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const { writeFileSync } = await import('fs');
  const results = await runSuite({ verbose: true });
  const outPath = process.argv[2] || 'bench-navMesh.json';
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nRapport sauvegardé: ${outPath}`);
}
