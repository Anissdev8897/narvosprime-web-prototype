// ══════════════════════════════════════════════════════════════════════════════
// cache/levels.ts — Niveaux de cache : L1 (Map mémoire), L2 (IndexedDB), L3 (Réseau)
//
// Chaque niveau implémente ICacheLevel<K, V> et peut être utilisé seul ou
// chaîné dans UnifiedCache.
// ══════════════════════════════════════════════════════════════════════════════

import {
  CacheLevel,
  type CacheEntry,
  type CacheEntryMeta,
  type CacheOptions,
  type CacheResult,
  type CacheStats,
  type ICacheLevel,
} from "./types";

// ── L1 : Cache mémoire (Map) ─────────────────────────────────────────────────
// Le plus rapide. Volatil (disparaît au rechargement de la page).

export class MemoryCacheLevel<K, V> implements ICacheLevel<K, V> {
  readonly level = CacheLevel.L1_MEMORY;
  readonly name: string;
  private _map = new Map<K, CacheEntry<V>>();
  private _capacity: number;
  private _hits = 0;
  private _misses = 0;
  private _evictions = 0;
  private _expired = 0;

  constructor(opts: CacheOptions = {}) {
    this._capacity = opts.capacity ?? 0;
    this.name = opts.name ?? "L1_Memory";
  }

  async get(key: K): Promise<CacheResult<V> | undefined> {
    const t0 = performance.now();
    const entry = this._map.get(key);
    if (!entry) {
      this._misses++;
      return undefined;
    }

    // Vérification TTL
    if (
      entry.meta.ttl > 0 &&
      performance.now() - entry.meta.createdAt > entry.meta.ttl
    ) {
      this._map.delete(key);
      this._expired++;
      this._misses++;
      return undefined;
    }

    entry.meta.lastAccessedAt = performance.now();
    entry.meta.accessCount++;
    this._hits++;
    return { value: entry.value, level: this.level, accessTimeMs: performance.now() - t0 };
  }

  async set(key: K, value: V, ttl = 0): Promise<void> {
    // Éviction si capacité atteinte (sauf si l'entrée existe déjà = update)
    if (this._capacity > 0 && !this._map.has(key) && this._map.size >= this._capacity) {
      // On évince une entrée au hasard (la politique d'éviction est gérée par UnifiedCache)
      // Pour MemoryCacheLevel, on supprime la plus ancienne
      const oldest = this._map.keys().next();
      if (!oldest.done && oldest.value !== undefined) {
        this._map.delete(oldest.value);
        this._evictions++;
      }
    }

    const now = performance.now();
    const existing = this._map.get(key);
    this._map.set(key, {
      value,
      meta: {
        createdAt: existing?.meta.createdAt ?? now,
        lastAccessedAt: now,
        accessCount: existing ? existing.meta.accessCount + 1 : 1,
        ttl,
      },
    });
  }

  async has(key: K): Promise<boolean> {
    const entry = this._map.get(key);
    if (!entry) return false;
    if (entry.meta.ttl > 0 && performance.now() - entry.meta.createdAt > entry.meta.ttl) {
      this._map.delete(key);
      this._expired++;
      return false;
    }
    return true;
  }

  async delete(key: K): Promise<boolean> {
    return this._map.delete(key);
  }

  async clear(): Promise<void> {
    this._map.clear();
    this._hits = 0;
    this._misses = 0;
    this._evictions = 0;
    this._expired = 0;
  }

  getStats(): CacheStats {
    const total = this._hits + this._misses;
    return {
      size: this._map.size,
      capacity: this._capacity,
      hits: this._hits,
      misses: this._misses,
      hitRate: total > 0 ? this._hits / total : 0,
      evictions: this._evictions,
      expired: this._expired,
    };
  }

  get size(): Promise<number> {
    return Promise.resolve(this._map.size);
  }

  /** Accès direct aux métadonnées (pour les politiques d'éviction). */
  getMetaMap(): ReadonlyMap<K, CacheEntryMeta> {
    const metaMap = new Map<K, CacheEntryMeta>();
    const entries = Array.from(this._map.entries());
    for (let i = 0; i < entries.length; i++) {
      metaMap.set(entries[i][0], entries[i][1].meta);
    }
    return metaMap;
  }
}

// ── L2 : Cache IndexedDB ─────────────────────────────────────────────────────
// Persistant entre les sessions de navigation.
// Note : en environnement Node (tests), on utilise un fallback Map.

export class IndexedDBCacheLevel<K, V> implements ICacheLevel<K, V> {
  readonly level = CacheLevel.L2_INDEXED_DB;
  readonly name: string;
  private _dbName: string;
  private _storeName: string;
  private _dbPromise: Promise<IDBDatabase> | null = null;
  private _version = 1;
  private _serialize: (value: V) => unknown;
  private _deserialize: (raw: unknown) => V;

  // Fallback mémoire pour Node/SSR (quand indexedDB n'existe pas)
  private _fallbackMap = new Map<string, CacheEntry<V>>();
  private _useFallback = false;

  private _hits = 0;
  private _misses = 0;
  private _evictions = 0;
  private _expired = 0;
  private _capacity: number;

  constructor(opts: CacheOptions & {
    dbName?: string;
    storeName?: string;
    serialize?: (value: V) => unknown;
    deserialize?: (raw: unknown) => V;
  } = {}) {
    this._dbName = opts.dbName ?? "narvos-unified-cache";
    this._storeName = opts.storeName ?? "cache_store";
    this.name = opts.name ?? "L2_IDB";
    this._capacity = opts.capacity ?? 0;

    this._serialize = opts.serialize ?? ((v: V) => v as unknown);
    this._deserialize = opts.deserialize ?? ((raw: unknown) => raw as V);

    this._useFallback = typeof indexedDB === "undefined";
  }

  private async _getDb(): Promise<IDBDatabase> {
    if (this._useFallback) throw new Error("IndexedDB not available");
    if (this._dbPromise) return this._dbPromise;

    this._dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(this._dbName, this._version);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(this._storeName)) {
          db.createObjectStore(this._storeName);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        this._dbPromise = null;
        reject(req.error);
      };
    });

    return this._dbPromise;
  }

  private _idbKey(key: K): string {
    return typeof key === "string" ? key : JSON.stringify(key);
  }

  async get(key: K): Promise<CacheResult<V> | undefined> {
    const t0 = performance.now();

    if (this._useFallback) {
      return this._fallbackGet(key, t0);
    }

    try {
      const db = await this._getDb();
      const skey = this._idbKey(key);
      const result = await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction(this._storeName, "readonly");
        const store = tx.objectStore(this._storeName);
        const req = store.get(skey);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (result == null) {
        this._misses++;
        return undefined;
      }

      const entry = result as unknown as CacheEntry<V>;
      // Vérification TTL
      if (entry.meta.ttl > 0 && performance.now() - entry.meta.createdAt > entry.meta.ttl) {
        this._expired++;
        this._misses++;
        // Supprimer l'entrée expirée
        this.delete(key).catch(() => {});
        return undefined;
      }

      // Mettre à jour les métadonnées
      entry.meta.lastAccessedAt = performance.now();
      entry.meta.accessCount++;
      this._hits++;

      // Écrire les métadonnées mises à jour
      this._writeEntry(skey, entry).catch(() => {});

      return {
        value: this._deserialize(entry.value),
        level: this.level,
        accessTimeMs: performance.now() - t0,
      };
    } catch {
      this._misses++;
      return undefined;
    }
  }

  private async _fallbackGet(key: K, t0: number): Promise<CacheResult<V> | undefined> {
    const skey = this._idbKey(key);
    const entry = this._fallbackMap.get(skey);
    if (!entry) {
      this._misses++;
      return undefined;
    }
    if (entry.meta.ttl > 0 && performance.now() - entry.meta.createdAt > entry.meta.ttl) {
      this._fallbackMap.delete(skey);
      this._expired++;
      this._misses++;
      return undefined;
    }
    entry.meta.lastAccessedAt = performance.now();
    entry.meta.accessCount++;
    this._hits++;
    return { value: this._deserialize(entry.value), level: this.level, accessTimeMs: performance.now() - t0 };
  }

  private async _writeEntry(key: string, entry: CacheEntry<V>): Promise<void> {
    if (this._useFallback) {
      this._fallbackMap.set(key, entry);
      return;
    }
    try {
      const db = await this._getDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(this._storeName, "readwrite");
        const store = tx.objectStore(this._storeName);
        store.put(entry, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // Non-fatal
    }
  }

  async set(key: K, value: V, ttl = 0): Promise<void> {
    const skey = this._idbKey(key);
    const now = performance.now();
    const existing = this._useFallback
      ? this._fallbackMap.get(skey)
      : undefined;

    const entry: CacheEntry<V> = {
      value: this._serialize(value) as unknown as V,
      meta: {
        createdAt: existing?.meta.createdAt ?? now,
        lastAccessedAt: now,
        accessCount: existing ? existing.meta.accessCount + 1 : 1,
        ttl,
      },
    };

    await this._writeEntry(skey, entry);
  }

  async has(key: K): Promise<boolean> {
    if (this._useFallback) {
      const skey = this._idbKey(key);
      const entry = this._fallbackMap.get(skey);
      if (!entry) return false;
      if (entry.meta.ttl > 0 && performance.now() - entry.meta.createdAt > entry.meta.ttl) {
        this._fallbackMap.delete(skey);
        return false;
      }
      return true;
    }

    try {
      const db = await this._getDb();
      const skey = this._idbKey(key);
      const result = await new Promise<unknown>((resolve, reject) => {
        const tx = db.transaction(this._storeName, "readonly");
        const store = tx.objectStore(this._storeName);
        const req = store.get(skey);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (!result) return false;
      const entry = result as unknown as CacheEntry<V>;
      if (entry.meta.ttl > 0 && performance.now() - entry.meta.createdAt > entry.meta.ttl) {
        this.delete(key).catch(() => {});
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: K): Promise<boolean> {
    const skey = this._idbKey(key);
    if (this._useFallback) {
      return this._fallbackMap.delete(skey);
    }
    try {
      const db = await this._getDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(this._storeName, "readwrite");
        const store = tx.objectStore(this._storeName);
        store.delete(skey);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return true;
    } catch {
      return false;
    }
  }

  async clear(): Promise<void> {
    if (this._useFallback) {
      this._fallbackMap.clear();
    } else {
      try {
        const db = await this._getDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(this._storeName, "readwrite");
          const store = tx.objectStore(this._storeName);
          store.clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch {
        // Non-fatal
      }
    }
    this._hits = 0;
    this._misses = 0;
    this._evictions = 0;
    this._expired = 0;
  }

  getStats(): CacheStats {
    const total = this._hits + this._misses;
    const sz = this._useFallback ? this._fallbackMap.size : 0;
    return {
      size: sz,
      capacity: this._capacity,
      hits: this._hits,
      misses: this._misses,
      hitRate: total > 0 ? this._hits / total : 0,
      evictions: this._evictions,
      expired: this._expired,
    };
  }

  get size(): Promise<number> {
    if (this._useFallback) {
      return Promise.resolve(this._fallbackMap.size);
    }
    return Promise.resolve(0); // IDB ne permet pas de compter facilement
  }
}

// ── L3 : Cache Réseau (Network) ──────────────────────────────────────────────
// Pas de stockage local : fetch à chaque miss, mais résultats mis en cache
// dans le niveau L1 (via le chaînage UnifiedCache).

export class NetworkCacheLevel<K, V> implements ICacheLevel<K, V> {
  readonly level = CacheLevel.L3_NETWORK;
  readonly name: string;
  private _fetcher: (key: K) => Promise<V | undefined>;
  private _hits = 0;
  private _misses = 0;

  constructor(fetcher: (key: K) => Promise<V | undefined>, opts: CacheOptions = {}) {
    this._fetcher = fetcher;
    this.name = opts.name ?? "L3_Network";
  }

  async get(key: K): Promise<CacheResult<V> | undefined> {
    const t0 = performance.now();
    try {
      const value = await this._fetcher(key);
      if (value === undefined) {
        this._misses++;
        return undefined;
      }
      this._hits++;
      return {
        value,
        level: this.level,
        accessTimeMs: performance.now() - t0,
      };
    } catch {
      this._misses++;
      return undefined;
    }
  }

  // Ces opérations sont des no-op pour le réseau : on ne peut pas écrire sur le réseau
  async set(_key: K, _value: V, _ttl?: number): Promise<void> {}
  async has(_key: K): Promise<boolean> { return false; }
  async delete(_key: K): Promise<boolean> { return false; }
  async clear(): Promise<void> {}
  getStats(): CacheStats {
    const total = this._hits + this._misses;
    return {
      size: 0,
      capacity: 0,
      hits: this._hits,
      misses: this._misses,
      hitRate: total > 0 ? this._hits / total : 0,
      evictions: 0,
      expired: 0,
    };
  }
  get size(): Promise<number> { return Promise.resolve(0); }
}
