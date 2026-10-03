// ══════════════════════════════════════════════════════════════════════════════
// cache/strategies.ts — Stratégies d'éviction LRU / LFU / FIFO / TTL
//
// Chaque stratégie implémente `EvictionPolicy<K>` : après chaque set(), le
// cache appelé `recordAccess()` puis `evict()` pour savoir quelles clés
// évincer quand la capacité est dépassée.
// ══════════════════════════════════════════════════════════════════════════════

import { EvictionStrategy, type CacheEntryMeta } from "./types";

/** Interface pour une politique d'éviction. */
export interface EvictionPolicy<K> {
  readonly strategy: EvictionStrategy;

  /** Notifie la politique qu'une clé a été accédée (get). */
  recordAccess(key: K): void;

  /** Notifie la politique qu'une clé a été insérée ou mise à jour (set). */
  recordSet(key: K): void;

  /** Notifie la politique qu'une clé a été supprimée. */
  recordDelete(key: K): void;

  /** Retourne la clé à évincer, ou undefined si rien à évincer. */
  getEvictionCandidate(metaMap: ReadonlyMap<K, CacheEntryMeta>): K | undefined;

  /** Réinitialise la politique. */
  clear(): void;

  /** Retourne l'ordre interne pour debug. */
  getOrder(): K[];

  /** Nombre d'entrées suivies par la politique. */
  get size(): number;
}

// ── LRU : Least Recently Used ───────────────────────────────────────────────
// Maintient une liste chaînée (tableau) : la fin = plus récent, le début = plus ancien.

export class LRUPolicy<K> implements EvictionPolicy<K> {
  readonly strategy = EvictionStrategy.LRU;
  private _order: K[] = [];

  recordAccess(key: K): void {
    const idx = this._order.indexOf(key);
    if (idx !== -1) {
      this._order.splice(idx, 1);
      this._order.push(key);
    }
  }

  recordSet(key: K): void {
    // Si déjà présent, on le déplace en fin
    const idx = this._order.indexOf(key);
    if (idx !== -1) {
      this._order.splice(idx, 1);
    }
    this._order.push(key);
  }

  recordDelete(key: K): void {
    const idx = this._order.indexOf(key);
    if (idx !== -1) {
      this._order.splice(idx, 1);
    }
  }

  getEvictionCandidate(_metaMap: ReadonlyMap<K, CacheEntryMeta>): K | undefined {
    return this._order.length > 0 ? this._order[0] : undefined;
  }

  clear(): void {
    this._order = [];
  }

  getOrder(): K[] {
    return [...this._order];
  }

  get size(): number {
    return this._order.length;
  }
}

// ── LFU : Least Frequently Used ─────────────────────────────────────────────
// Évince l'entrée avec le plus bas compteur d'accès.
// En cas d'égalité, évince la plus ancienne (FIFO parmi les égaux).

export class LFUPolicy<K> implements EvictionPolicy<K> {
  readonly strategy = EvictionStrategy.LFU;
  private _order: K[] = []; // ordre d'insertion pour départager les égalités

  recordAccess(key: K): void {
    // L'ordre d'insertion ne change pas à l'accès, seul le compteur dans metaMap compte
  }

  recordSet(key: K): void {
    const idx = this._order.indexOf(key);
    if (idx === -1) {
      this._order.push(key);
    }
  }

  recordDelete(key: K): void {
    const idx = this._order.indexOf(key);
    if (idx !== -1) {
      this._order.splice(idx, 1);
    }
  }

  getEvictionCandidate(metaMap: ReadonlyMap<K, CacheEntryMeta>): K | undefined {
    if (this._order.length === 0) return undefined;

    let candidate: K | undefined;
    let minCount = Infinity;
    let minInsertIdx = Infinity;

    for (let i = 0; i < this._order.length; i++) {
      const key = this._order[i];
      const meta = metaMap.get(key);
      if (!meta) continue;
      const count = meta.accessCount;
      if (count < minCount || (count === minCount && i < minInsertIdx)) {
        minCount = count;
        minInsertIdx = i;
        candidate = key;
      }
    }

    return candidate;
  }

  clear(): void {
    this._order = [];
  }

  getOrder(): K[] {
    return [...this._order];
  }

  get size(): number {
    return this._order.length;
  }
}

// ── FIFO : First In, First Out ───────────────────────────────────────────────
// Évince l'entrée la plus anciennement insérée (ordre d'insertion pur).

export class FIFOPolicy<K> implements EvictionPolicy<K> {
  readonly strategy = EvictionStrategy.FIFO;
  private _queue: K[] = [];

  recordAccess(_key: K): void {
    // FIFO pur : l'accès ne change pas l'ordre
  }

  recordSet(key: K): void {
    const idx = this._queue.indexOf(key);
    if (idx === -1) {
      this._queue.push(key);
    }
    // Si déjà présent, on ne change pas sa position (première insertion compte)
  }

  recordDelete(key: K): void {
    const idx = this._queue.indexOf(key);
    if (idx !== -1) {
      this._queue.splice(idx, 1);
    }
  }

  getEvictionCandidate(_metaMap: ReadonlyMap<K, CacheEntryMeta>): K | undefined {
    return this._queue.length > 0 ? this._queue[0] : undefined;
  }

  clear(): void {
    this._queue = [];
  }

  getOrder(): K[] {
    return [...this._queue];
  }

  get size(): number {
    return this._queue.length;
  }
}

// ── TTL : Time To Live ───────────────────────────────────────────────────────
// Pas d'ordre interne : l'éviction se base uniquement sur l'expiration.

export class TTLPolicy<K> implements EvictionPolicy<K> {
  readonly strategy = EvictionStrategy.TTL;
  private _keys = new Set<K>();

  recordAccess(_key: K): void {
    // Rien à faire : l'expiration est calculée depuis meta.createdAt + meta.ttl
  }

  recordSet(key: K): void {
    this._keys.add(key);
  }

  recordDelete(key: K): void {
    this._keys.delete(key);
  }

  getEvictionCandidate(metaMap: ReadonlyMap<K, CacheEntryMeta>): K | undefined {
    const now = performance.now();
    const keys = Array.from(this._keys);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const meta = metaMap.get(key);
      if (!meta) continue;
      if (meta.ttl > 0 && now - meta.createdAt > meta.ttl) {
        return key;
      }
    }
    return undefined;
  }

  /** Retourne toutes les clés expirées. */
  getExpiredKeys(metaMap: ReadonlyMap<K, CacheEntryMeta>): K[] {
    const now = performance.now();
    const expired: K[] = [];
    const keys = Array.from(this._keys);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const meta = metaMap.get(key);
      if (!meta) continue;
      if (meta.ttl > 0 && now - meta.createdAt > meta.ttl) {
        expired.push(key);
      }
    }
    return expired;
  }

  clear(): void {
    this._keys.clear();
  }

  getOrder(): K[] {
    return Array.from(this._keys);
  }

  get size(): number {
    return this._keys.size;
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createPolicy<K>(strategy: EvictionStrategy): EvictionPolicy<K> {
  switch (strategy) {
    case EvictionStrategy.LRU:
      return new LRUPolicy<K>();
    case EvictionStrategy.LFU:
      return new LFUPolicy<K>();
    case EvictionStrategy.FIFO:
      return new FIFOPolicy<K>();
    case EvictionStrategy.TTL:
      return new TTLPolicy<K>();
  }
}
