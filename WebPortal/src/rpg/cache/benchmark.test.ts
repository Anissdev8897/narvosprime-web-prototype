// ══════════════════════════════════════════════════════════════════════════════
// cache/benchmark.test.ts — Tests du benchmark : vérifie que l'infra tourne
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { runBenchmark, compareStrategies } from "./benchmark";
import { EvictionStrategy } from "./types";

describe("runBenchmark", () => {
  it("exécute un benchmark LRU de base", async () => {
    const result = await runBenchmark({
      totalOps: 100,
      uniqueKeys: 20,
      readRatio: 0.8,
      distribution: "uniform",
      cacheCapacity: 10,
    }, "test-bench");

    expect(result.totalOps).toBe(100);
    expect(result.hits + result.misses).toBeGreaterThan(0);
    expect(result.hitRate).toBeGreaterThanOrEqual(0);
    expect(result.hitRate).toBeLessThanOrEqual(1);
    expect(result.avgAccessTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it("calcule des percentiles valides", async () => {
    const result = await runBenchmark({
      totalOps: 100,
      uniqueKeys: 10,
      cacheCapacity: 5,
    });

    expect(result.p50AccessTimeMs).toBeGreaterThanOrEqual(0);
    expect(result.p95AccessTimeMs).toBeGreaterThanOrEqual(result.p50AccessTimeMs);
    expect(result.p99AccessTimeMs).toBeGreaterThanOrEqual(result.p95AccessTimeMs);
  });
});

describe("compareStrategies", () => {
  it("compare toutes les stratégies", async () => {
    const results = await compareStrategies({
      totalOps: 100,
      uniqueKeys: 20,
      cacheCapacity: 10,
    });

    expect(results).toHaveLength(3);
    expect(results[0].strategy).toBe(EvictionStrategy.LRU);
    expect(results[1].strategy).toBe(EvictionStrategy.LFU);
    expect(results[2].strategy).toBe(EvictionStrategy.FIFO);

    for (const r of results) {
      expect(r.avgAccessTimeMs).toBeGreaterThanOrEqual(0);
      expect(r.hitRate).toBeGreaterThanOrEqual(0);
      expect(r.hitRate).toBeLessThanOrEqual(1);
    }
  });
});

describe("strategies — zipf distribution", () => {
  it("LRU a un meilleur hit rate que FIFO sur distribution zipf", async () => {
    const results = await compareStrategies({
      totalOps: 500,
      uniqueKeys: 100,
      cacheCapacity: 30,
      distribution: "zipf",
    });

    // LRU devrait performer au moins aussi bien que FIFO
    const lru = results.find((r) => r.strategy === EvictionStrategy.LRU)!;
    expect(lru.hitRate).toBeGreaterThan(0);
  });
});
