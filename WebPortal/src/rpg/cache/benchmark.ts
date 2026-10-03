// ══════════════════════════════════════════════════════════════════════════════
// cache/benchmark.ts — Benchmark du cache : hit rate, temps d'accès
//
// Simule des patterns d'accès réalistes pour mesurer les performances
// de chaque stratégie et niveau de cache.
// ══════════════════════════════════════════════════════════════════════════════

import { UnifiedCache, type UnifiedCacheConfig } from "./unifiedCache";
import { EvictionStrategy } from "./types";

export interface BenchmarkResult {
  name: string;
  strategy: EvictionStrategy;
  totalOps: number;
  hits: number;
  misses: number;
  hitRate: number;
  avgAccessTimeMs: number;
  p50AccessTimeMs: number;
  p95AccessTimeMs: number;
  p99AccessTimeMs: number;
  durationMs: number;
}

export interface BenchmarkConfig {
  /** Nombre total d'opérations (get + set). */
  totalOps: number;
  /** Nombre de clés uniques dans le workload. */
  uniqueKeys: number;
  /** Ratio de get vs set (0.8 = 80% get, 20% set). */
  readRatio: number;
  /** Distribution des accès : "uniform" | "zipf" (80/20). */
  distribution: "uniform" | "zipf";
  /** Capacité du cache (taille max). */
  cacheCapacity: number;
}

const DEFAULT_CONFIG: BenchmarkConfig = {
  totalOps: 10_000,
  uniqueKeys: 1000,
  readRatio: 0.8,
  distribution: "zipf",
  cacheCapacity: 200,
};

/**
 * Génère une séquence de clés selon une distribution Zipf (80% des accès
 * sur 20% des clés — loi de puissance réaliste).
 */
function generateKeys(total: number, uniqueKeys: number, distribution: "uniform" | "zipf"): number[] {
  const keys: number[] = [];
  for (let i = 0; i < total; i++) {
    if (distribution === "uniform") {
      keys.push(Math.floor(Math.random() * uniqueKeys));
    } else {
      // Distribution Zipf simplifiée
      const r = Math.random();
      // 80% des accès sur les 20% premiers
      if (r < 0.8) {
        keys.push(Math.floor(Math.random() * (uniqueKeys * 0.2)));
      } else {
        keys.push(Math.floor(Math.random() * (uniqueKeys * 0.8)) + Math.floor(uniqueKeys * 0.2));
      }
    }
  }
  return keys;
}

/**
 * Exécute un benchmark complet sur une configuration de cache.
 */
export async function runBenchmark(
  config: Partial<BenchmarkConfig> = {},
  cacheName = "benchmark",
): Promise<BenchmarkResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const keys = generateKeys(cfg.totalOps, cfg.uniqueKeys, cfg.distribution);

  const cache = new UnifiedCache<number, number>({
    l1Capacity: cfg.cacheCapacity,
    strategy: EvictionStrategy.LRU,
    name: cacheName,
    levels: { l1: true, l2: false, l3: false },
    promoteToL1: true,
  });

  const accessTimes: number[] = [];
  let hits = 0;
  let misses = 0;

  const t0 = performance.now();

  for (let i = 0; i < cfg.totalOps; i++) {
    const key = keys[i];

    if (Math.random() < cfg.readRatio) {
      // GET
      const tStart = performance.now();
      const result = await cache.get(key);
      const elapsed = performance.now() - tStart;
      accessTimes.push(elapsed);

      if (result && result.value !== undefined) {
        hits++;
      } else {
        misses++;
        // Set sur miss (remplissage)
        await cache.set(key, Math.random());
      }
    } else {
      // SET
      await cache.set(key, Math.random());
    }
  }

  const durationMs = performance.now() - t0;

  // Statistiques des temps d'accès
  accessTimes.sort((a, b) => a - b);
  const avg = accessTimes.reduce((s, t) => s + t, 0) / accessTimes.length;
  const p50 = accessTimes[Math.floor(accessTimes.length * 0.5)] ?? 0;
  const p95 = accessTimes[Math.floor(accessTimes.length * 0.95)] ?? 0;
  const p99 = accessTimes[Math.floor(accessTimes.length * 0.99)] ?? 0;

  return {
    name: cacheName,
    strategy: EvictionStrategy.LRU,
    totalOps: cfg.totalOps,
    hits,
    misses,
    hitRate: hits / (hits + misses),
    avgAccessTimeMs: avg,
    p50AccessTimeMs: p50,
    p95AccessTimeMs: p95,
    p99AccessTimeMs: p99,
    durationMs,
  };
}

/**
 * Compare plusieurs stratégies d'éviction sur le même workload.
 */
export async function compareStrategies(
  config: Partial<BenchmarkConfig> = {},
): Promise<BenchmarkResult[]> {
  const strategies = [
    EvictionStrategy.LRU,
    EvictionStrategy.LFU,
    EvictionStrategy.FIFO,
  ];

  const results: BenchmarkResult[] = [];

  for (const strategy of strategies) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const keys = generateKeys(cfg.totalOps, cfg.uniqueKeys, cfg.distribution);

    const cache = new UnifiedCache<number, number>({
      l1Capacity: cfg.cacheCapacity,
      strategy,
      name: `bench:${strategy}`,
      levels: { l1: true, l2: false, l3: false },
    });

    const accessTimes: number[] = [];
    let hits = 0;
    let misses = 0;
    const t0 = performance.now();

    for (let i = 0; i < cfg.totalOps; i++) {
      const key = keys[i];
      if (Math.random() < cfg.readRatio) {
        const tStart = performance.now();
        const result = await cache.get(key);
        accessTimes.push(performance.now() - tStart);
        if (result && result.value !== undefined) {
          hits++;
        } else {
          misses++;
          await cache.set(key, Math.random());
        }
      } else {
        await cache.set(key, Math.random());
      }
    }

    const durationMs = performance.now() - t0;
    accessTimes.sort((a, b) => a - b);
    const avg = accessTimes.reduce((s, t) => s + t, 0) / accessTimes.length;

    results.push({
      name: `Stratégie ${strategy.toUpperCase()}`,
      strategy,
      totalOps: cfg.totalOps,
      hits,
      misses,
      hitRate: hits / (hits + misses),
      avgAccessTimeMs: avg,
      p50AccessTimeMs: accessTimes[Math.floor(accessTimes.length * 0.5)] ?? 0,
      p95AccessTimeMs: accessTimes[Math.floor(accessTimes.length * 0.95)] ?? 0,
      p99AccessTimeMs: accessTimes[Math.floor(accessTimes.length * 0.99)] ?? 0,
      durationMs,
    });
  }

  return results;
}

/**
 * Benchmark chaîne complète (L1+L2+L3).
 */
export async function benchFullChain(
  fetcher: (key: number) => Promise<number | undefined>,
  config: Partial<BenchmarkConfig> = {},
): Promise<BenchmarkResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const keys = generateKeys(cfg.totalOps, cfg.uniqueKeys, cfg.distribution);

  const cache = new UnifiedCache<number, number>({
    l1Capacity: cfg.cacheCapacity,
    strategy: EvictionStrategy.LRU,
    name: "full-chain",
    levels: { l1: true, l2: true, l3: true },
    fetcher,
    l2: { dbName: "bench-idb", storeName: "bench" },
  });

  const accessTimes: number[] = [];
  let hits = 0;
  let misses = 0;
  const t0 = performance.now();

  for (let i = 0; i < cfg.totalOps; i++) {
    const key = keys[i];
    const tStart = performance.now();
    const result = await cache.get(key);
    accessTimes.push(performance.now() - tStart);
    if (result && result.value !== undefined) {
      hits++;
    } else {
      misses++;
    }
  }

  const durationMs = performance.now() - t0;
  accessTimes.sort((a, b) => a - b);

  return {
    name: "Full Chain (L1+L2+L3)",
    strategy: EvictionStrategy.LRU,
    totalOps: cfg.totalOps,
    hits,
    misses,
    hitRate: hits / (hits + misses),
    avgAccessTimeMs: accessTimes.reduce((s, t) => s + t, 0) / accessTimes.length,
    p50AccessTimeMs: accessTimes[Math.floor(accessTimes.length * 0.5)] ?? 0,
    p95AccessTimeMs: accessTimes[Math.floor(accessTimes.length * 0.95)] ?? 0,
    p99AccessTimeMs: accessTimes[Math.floor(accessTimes.length * 0.99)] ?? 0,
    durationMs,
  };
}
