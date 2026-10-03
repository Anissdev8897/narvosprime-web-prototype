// ══════════════════════════════════════════════════════════════════════════════
// cache/memoize.ts — Mémoïsation automatique pour fonctions pures
//
// Utilise UnifiedCache en interne pour le stockage. Supporte :
//   - fonctions synchrones et asynchrones
//   - clé de cache personnalisée (ou par défaut JSON.stringify des arguments)
//   - TTL configurable
//   - WeakMap pour les fonctions récursives / cycles de vie
// ══════════════════════════════════════════════════════════════════════════════

import { UnifiedCache, type UnifiedCacheConfig } from "./unifiedCache";
import { EvictionStrategy } from "./types";

export interface MemoizeOptions {
  /** Nom du cache interne (debug). */
  name?: string;
  /** TTL en ms. 0 = pas de TTL. Défaut: 0. */
  ttl?: number;
  /** Capacité maximale du cache de mémoïsation. Défaut: 500. */
  capacity?: number;
  /** Stratégie d'éviction. Défaut: LRU. */
  strategy?: EvictionStrategy;
  /** Fonction de génération de clé à partir des arguments. Défaut: JSON.stringify. */
  keyFn?: (...args: unknown[]) => string;
  /** Activer le cache L2 (IndexedDB). Défaut: false (la mémoïsation est volatile). */
  enableL2?: boolean;
}

// Cache global pour les fonctions mémoïsées, partagé par toutes les instances.
// Permet d'éviter de recréer un cache par fonction.
const _globalMemoCaches = new Map<string, UnifiedCache<string, unknown>>();

/**
 * Mémoïse une fonction asynchrone.
 *
 * Exemple:
 * ```
 * const cachedFn = memoize(async (x: number) => x * 2);
 * await cachedFn(5); // calcule et stocke
 * await cachedFn(5); // retourne depuis le cache
 * ```
 */
export function memoize<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  opts: MemoizeOptions = {},
): (...args: A) => Promise<R> {
  const cache = _getOrCreateCache(opts);
  const keyFn = opts.keyFn ?? defaultKeyFn;

  const memoized = async (...args: A): Promise<R> => {
    const key = keyFn(args);
    const result = await cache.get(key);
    if (result?.value !== undefined) {
      return result.value as R;
    }
    const value = await fn(...args);
    await cache.set(key, value, opts.ttl);
    return value;
  };

  // Attacher le cache pour inspection / purge
  (memoized as unknown as { cache: UnifiedCache<string, unknown> }).cache = cache;

  return memoized;
}

/**
 * Mémoïse une fonction synchrone (la transforme en fonction asynchrone retournant une Promise).
 */
export function memoizeSync<A extends unknown[], R>(
  fn: (...args: A) => R,
  opts: MemoizeOptions = {},
): (...args: A) => Promise<R> {
  return memoize(async (...args: A) => fn(...args), opts);
}

/**
 * Mémoïse une fonction synchrone pure (retour synchrone direct, sans Promise).
 * ATTENTION: le cache est synchrone, pas de TTL, pas de L2.
 * Utile pour les calculs coûteux en animation (blend weights, etc.).
 */
export function memoizeSyncPure<A extends unknown[], R>(
  fn: (...args: A) => R,
  opts: { capacity?: number; keyFn?: (...args: unknown[]) => string } = {},
): (...args: A) => R {
  const keyFn = opts.keyFn ?? defaultKeyFn;
  const capacity = opts.capacity ?? 500;
  const cache = new Map<string, R>();

  return (...args: A): R => {
    const key = keyFn(args);
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    const value = fn(...args);

    // Éviction si capacité atteinte
    if (cache.size >= capacity) {
      const firstKey = cache.keys().next();
      if (!firstKey.done) cache.delete(firstKey.value);
    }

    cache.set(key, value);
    return value;
  };
}

/**
 * Nettoie tous les caches de mémoïsation.
 */
export function clearAllMemoCaches(): void {
  const caches = Array.from(_globalMemoCaches.values());
  for (let i = 0; i < caches.length; i++) {
    caches[i].clear();
  }
  _globalMemoCaches.clear();
}

/**
 * Nettoie le cache d'une fonction mémoïsée spécifique.
 */
export function clearMemoCache<R>(
  memoizedFn: (...args: unknown[]) => Promise<R> | R,
): void {
  const cache = (memoizedFn as unknown as { cache?: UnifiedCache<string, unknown> }).cache;
  if (cache) cache.clear();
}

// ── Helpers internes ─────────────────────────────────────────────────────────

function defaultKeyFn(args: unknown[]): string {
  return args
    .map((a) => {
      if (a === undefined) return "__undefined__";
      if (a === null) return "__null__";
      if (typeof a === "object") {
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      }
      return String(a);
    })
    .join("|");
}

function _getOrCreateCache(opts: MemoizeOptions): UnifiedCache<string, unknown> {
  const name = opts.name ?? `memo:${Math.random().toString(36).slice(2, 8)}`;

  // Vérifier si un cache existe déjà pour ce nom
  const existing = _globalMemoCaches.get(name);
  if (existing) return existing;

  const config: UnifiedCacheConfig<string, unknown> = {
    l1Capacity: opts.capacity ?? 500,
    strategy: opts.strategy ?? EvictionStrategy.LRU,
    defaultTtl: opts.ttl ?? 0,
    name: `Memoize:${name}`,
    levels: {
      l1: true,
      l2: opts.enableL2 ?? false,
      l3: false,
    },
  };

  const cache = new UnifiedCache<string, unknown>(config);
  _globalMemoCaches.set(name, cache);
  return cache;
}
