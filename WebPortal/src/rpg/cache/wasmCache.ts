// ══════════════════════════════════════════════════════════════════════════════
// cache/wasmCache.ts — Cache spécialisé pour les requêtes WASM
//
// Mémoïse les appels WASM coûteux (navMesh, raycast, calculs de blend)
// en utilisant le cache unifié L1+L2.
// ══════════════════════════════════════════════════════════════════════════════

import { UnifiedCache } from "./unifiedCache";
import { EvictionStrategy } from "./types";

/**
 * Cache spécialisé pour les résultats de requêtes WASM (pathfinding, raycast).
 * Utilise L1 (mémoire) + L2 (IDB) avec stratégie LRU.
 *
 * Exemple d'utilisation :
 * ```
 * const navCache = createWasmCache<number, boolean>(
 *   "navmesh_walkable", 500, 5 * 60 * 1000  // 5 min TTL
 * );
 * const walkable = await navCache.getOrFetch(cellId, () => navIsWalkable(x, z));
 * ```
 */
export class WasmCache<K, V> {
  private _cache: UnifiedCache<K, V>;

  constructor(
    name: string,
    capacity = 500,
    ttlMs = 0,
    strategy = EvictionStrategy.LRU,
    enableL2 = false,
  ) {
    this._cache = new UnifiedCache<K, V>({
      l1Capacity: capacity,
      strategy,
      defaultTtl: ttlMs,
      name: `WasmCache:${name}`,
      levels: { l1: true, l2: enableL2, l3: false },
      promoteToL1: true,
    });
  }

  async get(key: K): Promise<V | undefined> {
    const result = await this._cache.get(key);
    return result?.value;
  }

  async set(key: K, value: V, ttl?: number): Promise<void> {
    await this._cache.set(key, value, ttl);
  }

  /**
   * Récupère une valeur du cache, ou l'exécute si absente.
   */
  async getOrFetch(key: K, fetcher: () => Promise<V>, ttl?: number): Promise<V> {
    const cached = await this.get(key);
    if (cached !== undefined) return cached;
    const value = await fetcher();
    await this.set(key, value, ttl);
    return value;
  }

  async has(key: K): Promise<boolean> {
    return this._cache.has(key);
  }

  async clear(): Promise<void> {
    await this._cache.clear();
  }

  getStats() {
    return this._cache.getStats();
  }

  get size(): Promise<number> {
    return this._cache.size;
  }
}

// ── Caches partagés pour les différents systèmes WASM ──────────────────────────

/** Cache pour les calculs de blend weights WASM (calcBlendWeights). */
export const wasmBlendCache = new WasmCache<string, Float32Array>(
  "wasm_blend_weights",
  200,
  5_000, // 5s TTL (les blends changent avec la frame)
  EvictionStrategy.LRU,
);

/** Cache pour les résultats de pathfinding navMesh. */
export const navMeshWalkableCache = new WasmCache<string, boolean>(
  "navmesh_walkable",
  1000,
  30_000, // 30s TTL (le navmesh change rarement)
  EvictionStrategy.LFU,
);

/** Cache pour les fingerprints de bake navmesh. */
export const navMeshBakeCache = new WasmCache<string, {
  heights: Float32Array;
  walkFlags: Uint8Array;
  walkableCells: number;
  totalCells: number;
}>("navmesh_bake_data", 10, 0, EvictionStrategy.LRU);
