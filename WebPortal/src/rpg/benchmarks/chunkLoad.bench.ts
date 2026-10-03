// ══════════════════════════════════════════════════════════════════════════════
// benchmarks/chunkLoad.bench.ts — Benchmark du partitionnement spatial (chunkStream)
//
// Mesure les performances de cellKey(), chunkObjects(), et activeCells() sur
// des configurations réalistes :
//   • 10 000 objets répartis aléatoirement (map forge densité moyenne)
//   • 100 000 objets (map très dense, limite haute)
//   • Rayons de chargement variables (50m, 100m, 200m)
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { cellKey, chunkObjects, activeCells } from "../forge/chunkStream";

// ══════════════════════════════════════════════════════════════════════════════
// Génération de données artificielles
// ══════════════════════════════════════════════════════════════════════════════

function generateObjects(n: number, spread: number): Array<{ pos: [number, number, number] }> {
  const out: Array<{ pos: [number, number, number] }> = [];
  for (let i = 0; i < n; i++) {
    out.push({
      pos: [
        (Math.random() - 0.5) * spread,
        Math.random() * 20,
        (Math.random() - 0.5) * spread,
      ] as [number, number, number],
    });
  }
  return out;
}

describe("chunkStream — benchmark partitionnement", () => {
  const cellSize = 8; // taille de cellule standard forge

  it("cellKey 100k appels — temps < 20 ms", () => {
    const t0 = performance.now();
    for (let i = 0; i < 100_000; i++) {
      cellKey(Math.random() * 2000 - 1000, Math.random() * 2000 - 1000, cellSize);
    }
    const total = performance.now() - t0;
    console.log(`[BENCH] cellKey ×100k : ${total.toFixed(2)}ms`);
    expect(total).toBeLessThan(20);
  });

  it("chunkObjects 10 000 objets — temps < 50 ms", () => {
    const objs = generateObjects(10_000, 400);
    const t0 = performance.now();
    const map = chunkObjects(objs, cellSize);
    const elapsed = performance.now() - t0;
    console.log(`[BENCH] chunkObjects 10k : ${elapsed.toFixed(2)}ms  → ${map.size} cellules`);
    expect(elapsed).toBeLessThan(50);
  });

  it("chunkObjects 100 000 objets — temps < 1000 ms (limite haute)", () => {
    const objs = generateObjects(100_000, 1000);
    const t0 = performance.now();
    const map = chunkObjects(objs, cellSize);
    const elapsed = performance.now() - t0;
    console.log(`[BENCH] chunkObjects 100k : ${elapsed.toFixed(2)}ms  → ${map.size} cellules`);
    expect(elapsed).toBeLessThan(1000);
  });

  it("activeCells rayon=50m — temps < 1 ms", () => {
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) {
      activeCells(Math.random() * 400 - 200, Math.random() * 400 - 200, cellSize, 50);
    }
    const total = performance.now() - t0;
    const avg = total / 100;
    console.log(`[BENCH] activeCells r=50 : ${avg.toFixed(4)}ms (moyenne sur 100)`);
    expect(avg).toBeLessThan(1);
  });

  it("activeCells rayon=200m — temps < 5 ms (grand map)", () => {
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) {
      activeCells(Math.random() * 4000 - 2000, Math.random() * 4000 - 2000, 8, 200);
    }
    const total = performance.now() - t0;
    const avg = total / 100;
    console.log(`[BENCH] activeCells r=200 : ${avg.toFixed(4)}ms (moyenne sur 100)`);
    expect(avg).toBeLessThan(5);
  });
});
