// ══════════════════════════════════════════════════════════════════════════════
// perf/chunkLoading.mjs — Benchmark du chargement de chunks
//
// Mesure :
//   - temps de chargement (simulé via cache + decodage)
//   - mémoire (empreinte estimée d'un chunk chargé)
//   - opérations de cache LRU
//
// Les benchmarks testent la logique de cache et d'indexation.
// Le chargement réseau/chunks GLB réel n'est pas testable sans DOM.
// ══════════════════════════════════════════════════════════════════════════════

import { performance } from 'perf_hooks';

// ── Cache LRU simplifié (équivalent à celui de chunkCache.ts) ───────────────

class LRUCache {
  constructor(maxEntries = 100) {
    this.max = maxEntries;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;
    const val = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, val); // Move to end (most recently used)
    return val;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.max) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  has(key) { return this.cache.has(key); }
  get size() { return this.cache.size; }
  clear() { this.cache.clear(); }
}

// ── Simulated chunk decoder ────────────────────────────────────────────────

function simulateChunkDecode(size = 'medium') {
  // Simule le temps de decodage KTX2 + chargement GLB
  const sizes = {
    small:  { byteSize: 256 * 1024, decodeMs: 0.3 },
    medium: { byteSize: 1024 * 1024, decodeMs: 1.2 },
    large:  { byteSize: 4 * 1024 * 1024, decodeMs: 4.5 },
    xlarge: { byteSize: 16 * 1024 * 1024, decodeMs: 18.0 },
  };
  const cfg = sizes[size] || sizes.medium;
  // Simule variation
  return cfg.decodeMs * (0.8 + Math.random() * 0.4);
}

function simulateChunkMemory(size = 'medium') {
  const sizes = {
    small:  { vertexCount: 500, indexCount: 1500, triCount: 750, approxBytes: 256 * 1024 },
    medium: { vertexCount: 2000, indexCount: 6000, triCount: 3000, approxBytes: 1024 * 1024 },
    large:  { vertexCount: 8000, indexCount: 24000, triCount: 12000, approxBytes: 4 * 1024 * 1024 },
  };
  return sizes[size] || sizes.medium;
}

// ══════════════════════════════════════════════════════════════════════════════
// Benchmarks
// ══════════════════════════════════════════════════════════════════════════════

export async function runBenchmark(options = {}) {
  const { verbose = false } = options;
  const results = [];

  // 1. Opérations cache LRU (get/set) — 10k opérations
  {
    const cache = new LRUCache(100);
    const times = [];

    // Remplir
    for (let i = 0; i < 100; i++) {
      cache.set(`chunk_${i}`, { data: `data_${i}` });
    }

    // Mesure des gets
    for (let k = 0; k < 1000; k++) {
      const key = `chunk_${k % 100}`;
      const t0 = performance.now();
      cache.get(key);
      times.push(performance.now() - t0);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    results.push({
      name: 'ChunkCache LRU get (10k ops)',
      group: 'chunkLoading',
      scenario: 'lruGet',
      samples: 1000,
      meanMs: avg,
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
      p50Ms: [...times].sort((a, b) => a - b)[Math.floor(times.length * 0.5)],
      unit: 'ms',
      iterations: 1000,
    });
    if (verbose) console.log(`[BENCH] Cache LRU get : ${avg.toFixed(4)}ms`);
  }

  // 2. Simulation chargement chunk (decode + parse)
  {
    const sizes = ['small', 'medium', 'large'];
    for (const size of sizes) {
      const times = [];
      for (let i = 0; i < 50; i++) {
        const t0 = performance.now();
        const result = simulateChunkDecode(size);
        // Attendre simulé
        const end = performance.now();
        times.push(end - t0 + result);
      }
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      const mem = simulateChunkMemory(size);
      results.push({
        name: `ChunkLoading decode (${size})`,
        group: 'chunkLoading',
        scenario: `decode_${size}`,
        samples: 50,
        meanMs: avg,
        minMs: Math.min(...times),
        maxMs: Math.max(...times),
        approxMemoryKB: Math.round(mem.approxBytes / 1024),
        vertexCount: mem.vertexCount,
        triCount: mem.triCount,
        unit: 'ms',
        iterations: 50,
      });
      if (verbose) console.log(`[BENCH] Chunk decode ${size} : ${avg.toFixed(2)}ms  (~${Math.round(mem.approxBytes / 1024)} KB)`);
    }
  }

  // 3. Cache LRU eviction — remplissage + dépassement
  {
    const cache = new LRUCache(50);
    const t0 = performance.now();
    for (let i = 0; i < 500; i++) {
      cache.set(`evict_${i}`, { data: i });
    }
    const elapsed = performance.now() - t0;
    results.push({
      name: 'ChunkCache LRU eviction (500 inserts, max=50)',
      group: 'chunkLoading',
      scenario: 'lruEviction',
      samples: 500,
      meanMs: elapsed / 500,
      totalMs: elapsed,
      finalSize: cache.size,
      unit: 'ms',
      iterations: 500,
    });
    if (verbose) console.log(`[BENCH] Cache LRU eviction : ${elapsed.toFixed(2)}ms total (${(elapsed / 500).toFixed(4)}ms/op)`);
  }

  // 4. Opérations IDB simulées (lecture)
  {
    const times = [];
    for (let i = 0; i < 200; i++) {
      const t0 = performance.now();
      // Simule désérialisation JSON d'un index
      const idx = Array.from({ length: 100 }, (_, j) => ({ id: `chunk_${j}`, offset: j * 1024, size: 1024 }));
      JSON.parse(JSON.stringify(idx));
      times.push(performance.now() - t0);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    results.push({
      name: 'Chunk index parse (100 entrées)',
      group: 'chunkLoading',
      scenario: 'indexParse',
      samples: 200,
      meanMs: avg,
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
      unit: 'ms',
      iterations: 200,
    });
    if (verbose) console.log(`[BENCH] Index parse : ${avg.toFixed(4)}ms`);
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
  const outPath = process.argv[2] || 'bench-chunkLoading.json';
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nRapport sauvegardé: ${outPath}`);
}
