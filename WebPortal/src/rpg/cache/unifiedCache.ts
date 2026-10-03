// ══════════════════════════════════════════════════════════════════════════════
// cache/unifiedCache.ts — Cache unifié à 3 niveaux avec stratégie d'éviction
//
// Orchestre L1 (Map mémoire) -> L2 (IndexedDB) -> L3 (Réseau) en chaîne.
// La politique d'éviction (LRU/LFU/FIFO/TTL) est appliquée sur le niveau L1.
// ══════════════════════════════════════════════════════════════════════════════

import {
  CacheLevel,
  EvictionStrategy,
  type CacheOptions,
  type CacheEntryMeta,
  type CacheResult,
  type CacheStats,
  type ICacheLevel,
} from "./types";
import { MemoryCacheLevel, IndexedDBCacheLevel, NetworkCacheLevel } from "./levels";
import { createPolicy, type EvictionPolicy } from "./strategies";

export interface UnifiedCacheConfig<K, V> {
  l1Capacity?: number;
  strategy?: EvictionStrategy;
  defaultTtl?: number;
  levels?: {
    l1?: boolean;
    l2?: boolean;
    l3?: boolean;
  };
  l2?: {
    dbName?: string;
    storeName?: string;
    serialize?: (value: V) => unknown;
    deserialize?: (raw: unknown) => V;
    capacity?: number;
  };
  fetcher?: (key: K) => Promise<V | undefined>;
  name?: string;
  promoteToL1?: boolean;
}

/**
 * Cache unifié à 3 niveaux.
 *
 * Lookup chain: L1 (Map mémoire) -> L2 (IndexedDB) -> L3 (Réseau)
 * Write chain: L1 + L2 (write-through). L3 est read-only (via fetcher).
 * Eviction L1 configurable (LRU, LFU, FIFO, TTL).
 */
export class UnifiedCache<K, V> {
  readonly name: string;
  private _l1: ICacheLevel<K, V>;
  private _l2: ICacheLevel<K, V> | null = null;
  private _l3: ICacheLevel<K, V> | null = null;
  private _policy: EvictionPolicy<K>;
  private _defaultTtl: number;
  private _promoteToL1: boolean;
  private _strategy: EvictionStrategy;
  private _l1Capacity: number;

  private _totalHits = 0;
  private _totalMisses = 0;
  private _totalEvictions = 0;

  constructor(config: UnifiedCacheConfig<K, V> = {}) {
    this.name = config.name ?? "UnifiedCache";
    this._defaultTtl = config.defaultTtl ?? 0;
    this._promoteToL1 = config.promoteToL1 ?? true;
    this._strategy = config.strategy ?? EvictionStrategy.LRU;
    this._l1Capacity = config.l1Capacity ?? 500;

    const levels = config.levels ?? { l1: true, l2: true, l3: true };

    this._l1 = new MemoryCacheLevel<K, V>({
      capacity: 0, // Pas d'éviction interne : c'est UnifiedCache qui gère la politique LRU/LFU/FIFO/TTL
      name: `${this.name}:L1`,
    });

    if (levels.l2 !== false) {
      this._l2 = new IndexedDBCacheLevel<K, V>({
        dbName: config.l2?.dbName ?? "narvos-unified-cache",
        storeName: config.l2?.storeName ?? "cache_store",
        serialize: config.l2?.serialize,
        deserialize: config.l2?.deserialize,
        capacity: config.l2?.capacity ?? 0,
        name: `${this.name}:L2`,
      });
    }

    if (levels.l3 !== false && config.fetcher) {
      this._l3 = new NetworkCacheLevel<K, V>(config.fetcher, {
        name: `${this.name}:L3`,
      });
    }

    this._policy = createPolicy<K>(this._strategy);
  }

  async get(key: K): Promise<CacheResult<V> | undefined> {
    const l1Result = await this._l1.get(key);
    if (l1Result) {
      this._policy.recordAccess(key);
      this._totalHits++;
      return l1Result;
    }

    if (this._l2) {
      const l2Result = await this._l2.get(key);
      if (l2Result) {
        this._policy.recordAccess(key);
        if (this._promoteToL1) {
          await this._l1.set(key, l2Result.value, this._defaultTtl);
        }
        this._totalHits++;
        return l2Result;
      }
    }

    if (this._l3) {
      const l3Result = await this._l3.get(key);
      if (l3Result) {
        this._policy.recordSet(key);
        const ttl = this._defaultTtl;
        await this._l1.set(key, l3Result.value, ttl);
        if (this._l2) {
          await this._l2.set(key, l3Result.value, ttl);
        }
        this._totalHits++;
        return l3Result;
      }
    }

    this._totalMisses++;
    return undefined;
  }

  async set(key: K, value: V, ttl?: number): Promise<void> {
    const effectiveTtl = ttl ?? this._defaultTtl;

    await this._l1.set(key, value, effectiveTtl);
    this._policy.recordSet(key);

    await this._enforceL1Capacity();

    if (this._l2) {
      await this._l2.set(key, value, effectiveTtl);
    }
  }

  async has(key: K): Promise<boolean> {
    if (await this._l1.has(key)) return true;
    if (this._l2 && (await this._l2.has(key))) return true;
    return false;
  }

  async delete(key: K): Promise<boolean> {
    this._policy.recordDelete(key);
    let deleted = false;
    if (await this._l1.delete(key)) deleted = true;
    if (this._l2 && (await this._l2.delete(key))) deleted = true;
    this._l3?.delete(key);
    return deleted;
  }

  async clear(): Promise<void> {
    this._policy.clear();
    await this._l1.clear();
    if (this._l2) await this._l2.clear();
    if (this._l3) await this._l3.clear();
    this._totalHits = 0;
    this._totalMisses = 0;
    this._totalEvictions = 0;
  }

  private async _enforceL1Capacity(): Promise<void> {
    if (this._l1Capacity <= 0) return;
    if (!(this._l1 instanceof MemoryCacheLevel)) return;

    const l1Meta = this._l1.getMetaMap();

    while (l1Meta.size > this._l1Capacity) {
      const candidate = this._policy.getEvictionCandidate(l1Meta);
      if (candidate === undefined) break;

      await this._l1.delete(candidate);
      this._policy.recordDelete(candidate);
      this._totalEvictions++;

      (l1Meta as Map<K, CacheEntryMeta>).delete(candidate);
    }
  }

  async evict(key: K): Promise<boolean> {
    return this.delete(key);
  }

  async cleanExpired(): Promise<number> {
    if (!(this._l1 instanceof MemoryCacheLevel)) return 0;
    const l1Meta = this._l1.getMetaMap();
    const now = performance.now();
    let cleaned = 0;

    const keysToDelete: K[] = [];
    const metaEntries = Array.from(l1Meta.entries());
    for (let i = 0; i < metaEntries.length; i++) {
      const [key, meta] = metaEntries[i];
      if (meta.ttl > 0 && now - meta.createdAt > meta.ttl) {
        keysToDelete.push(key);
      }
    }

    for (let i = 0; i < keysToDelete.length; i++) {
      const key = keysToDelete[i];
      await this._l1.delete(key);
      this._policy.recordDelete(key);
      cleaned++;
    }
    return cleaned;
  }

  getStats(): CacheStats {
    const l1Stats = this._l1.getStats();
    const total = this._totalHits + this._totalMisses;
    return {
      size: l1Stats.size,
      capacity: this._l1Capacity,
      hits: this._totalHits,
      misses: this._totalMisses,
      hitRate: total > 0 ? this._totalHits / total : 0,
      evictions: this._totalEvictions,
      expired: l1Stats.expired,
    };
  }

  getLevelStats(): { l1: CacheStats; l2?: CacheStats; l3?: CacheStats } {
    return {
      l1: this._l1.getStats(),
      l2: this._l2?.getStats(),
      l3: this._l3?.getStats(),
    };
  }

  get size(): Promise<number> {
    return this._l1.size;
  }

  get strategy(): EvictionStrategy {
    return this._strategy;
  }

  getPolicyOrder(): K[] {
    return this._policy.getOrder();
  }

  setStrategy(strategy: EvictionStrategy): void {
    this._strategy = strategy;
    this._policy = createPolicy<K>(strategy);
    if (this._l1 instanceof MemoryCacheLevel) {
      const metaMap = this._l1.getMetaMap();
      metaMap.forEach((_val, key) => {
        this._policy.recordSet(key);
      });
    }
  }
}
