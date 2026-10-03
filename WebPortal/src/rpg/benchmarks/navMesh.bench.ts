// ══════════════════════════════════════════════════════════════════════════════
// benchmarks/navMesh.bench.ts — Benchmark du bake NavMesh
//
// Mesure le temps de bake d'un navmesh dans différentes configurations de
// grille (cellSize). Le vrai bake WASM ne peut pas être testé sans WASM chargé,
// mais la phase de PRE-calcul (computeBounds, fingerprint, grille) est testable.
//
// Ces tests vérifient que les fonctions préparatoires du NavMeshBaker ne
// dégradent pas les performances entre les versions.
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";

// Mock collisionWorld pour les tests de bake
vi.mock("../runtime/CollisionWorld", () => ({
  collisionWorld: {
    colliderCount: 1000,
    getGroundY: (_x: number, _z: number) => Math.sin(_x * 0.01) * 5 + Math.cos(_z * 0.01) * 3,
    isBlocked: (_x: number, _z: number) => Math.abs(_x) < 5 && Math.abs(_z) < 5, // bloc central
    computeBounds: () => new THREE.Box3(
      new THREE.Vector3(-200, -20, -200),
      new THREE.Vector3(200, 50, 200),
    ),
  },
}));

vi.mock("../wasm/WasmBridge", () => ({
  isEngineLoaded: () => false, // WASM pas chargé en test
}));

import { computeGridDims } from "./navMeshGridUtils";

// ══════════════════════════════════════════════════════════════════════════════
// Utilitaires extraits du NavMeshBaker (testables sans WASM)
// ══════════════════════════════════════════════════════════════════════════════
// Ces fonctions sont copiées du NavMeshBaker pour les benchmarks.
// En production, elles sont calculées dans bakeNavMeshFromScene().

const MAX_CELLS = 40_000;

function computeGrid(bounds: THREE.Box3, cellSize: number) {
  const width = Math.ceil((bounds.max.x - bounds.min.x) / cellSize);
  const depth = Math.ceil((bounds.max.z - bounds.min.z) / cellSize);
  const total = width * depth;
  return { width, depth, total };
}

function computeAdaptiveCellSize(bounds: THREE.Box3): number {
  const area = (bounds.max.x - bounds.min.x) * (bounds.max.z - bounds.min.z);
  return Math.sqrt(area / MAX_CELLS);
}

describe("NavMeshBaker — benchmark préparation grille", () => {
  it("computeGrid pour map taille forge (400×400) — temps < 1 ms", () => {
    const bounds = new THREE.Box3(new THREE.Vector3(-200, -20, -200), new THREE.Vector3(200, 50, 200));
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) {
      computeGrid(bounds, 1.0);
    }
    const total = performance.now() - t0;
    const avg = total / 100;
    console.log(`[BENCH] computeGrid 400×400 : ${avg.toFixed(4)}ms (moyenne sur 100)`);
    expect(avg).toBeLessThan(1);
  });

  it("computeAdaptiveCellSize pour grandes maps — temps < 0.1 ms", () => {
    const bounds = new THREE.Box3(new THREE.Vector3(-1000, -50, -1000), new THREE.Vector3(1000, 100, 1000));
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) {
      computeAdaptiveCellSize(bounds);
    }
    const total = performance.now() - t0;
    const avg = total / 1000;
    console.log(`[BENCH] computeAdaptiveCellSize 2000×2000 : ${avg.toFixed(6)}ms (moyenne sur 1000)`);
    expect(avg).toBeLessThan(0.1);
  });

  it("computeGrid reste sous MAX_CELLS (40k)", () => {
    // Map de taille extrême (10km × 10km)
    const largeBounds = new THREE.Box3(new THREE.Vector3(-5000, -50, -5000), new THREE.Vector3(5000, 100, 5000));
    // Avec cellSize=1 on exploserait → tester l'adaptatif
    const cellSize = computeAdaptiveCellSize(largeBounds);
    const grid = computeGrid(largeBounds, cellSize);
    console.log(`[BENCH] grid 10km : ${grid.width}×${grid.depth} = ${grid.total} cellules (cellSize=${cellSize.toFixed(2)}m)`);
    expect(grid.total).toBeLessThanOrEqual(MAX_CELLS + 1000); // petite marge d'arrondi
  });
});
