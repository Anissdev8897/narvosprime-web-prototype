// ══════════════════════════════════════════════════════════════════════════════
// cache/chunkCacheAdapter.ts — Adaptateur unifié pour chunkCache existant
//
// Remplace progressivement l'ancien chunkCache.ts en utilisant le nouveau
// système de cache unifié (L1 Map + L2 IDB + LRU) tout en conservant
// l'API publique existante (getCachedChunk, storeCachedChunk, etc.).
// ══════════════════════════════════════════════════════════════════════════════

import { UnifiedCache } from "./unifiedCache";
import { EvictionStrategy } from "./types";

// ── Singleton du cache unifié pour les chunks ─────────────────────────────────

const CHUNK_CACHE_NAME = "narvos-chunk-cache";
const CHUNK_STORE_NAME = "chunks";

// Cache principal pour les chunks (ArrayBuffer)
const chunkCache = new UnifiedCache<string, ArrayBuffer>({
  l1Capacity: 50,
  strategy: EvictionStrategy.LRU,
  defaultTtl: 0,
  name: "ChunkCache",
  levels: { l1: true, l2: true, l3: false },
  l2: {
    dbName: CHUNK_CACHE_NAME,
    storeName: CHUNK_STORE_NAME,
    serialize: (buf: ArrayBuffer) => buf,
    deserialize: (raw: unknown) => raw as ArrayBuffer,
  },
  promoteToL1: true,
});

// Cache séparé pour les fingerprints (nombres)
const fingerprintCache = new UnifiedCache<string, number>({
  l1Capacity: 20,
  strategy: EvictionStrategy.LRU,
  name: "FingerprintCache",
  levels: { l1: true, l2: true, l3: false },
  l2: {
    dbName: CHUNK_CACHE_NAME,
    storeName: "fingerprints",
    serialize: (n: number) => n,
    deserialize: (raw: unknown) => raw as number,
  },
  promoteToL1: true,
});

// ── API publique (compatible avec l'ancienne chunkCache.ts) ──────────────────

/**
 * Récupère un chunk depuis le cache unifié (L1 mémoire -> L2 IDB).
 * Retourne null si absent (compatible avec l'API existante).
 */
export async function getCachedChunk(url: string): Promise<ArrayBuffer | null> {
  const result = await chunkCache.get(url);
  if (result && result.value !== undefined) {
    return result.value;
  }
  return null;
}

/**
 * Stocke un chunk dans le cache unifié (L1 + L2 write-through).
 */
export async function storeCachedChunk(url: string, data: ArrayBuffer): Promise<void> {
  await chunkCache.set(url, data);
}

/**
 * Vide entièrement le cache des chunks.
 */
export async function clearChunkCache(): Promise<void> {
  await chunkCache.clear();
  await fingerprintCache.clear();
}

const FINGERPRINT_KEY = "__narvos_chunk_fingerprint__";

export async function validateCacheFingerprint(
  currentFingerprint: number,
): Promise<boolean> {
  const stored = await fingerprintCache.get(FINGERPRINT_KEY);
  const storedFp = stored?.value;

  if (storedFp !== undefined && storedFp !== currentFingerprint) {
    console.warn(
      `[ChunkCache] fingerprint mismatch (stored=${storedFp}, current=${currentFingerprint}) -> purge`,
    );
    await clearChunkCache();
    await fingerprintCache.set(FINGERPRINT_KEY, currentFingerprint);
    return false;
  }
  if (storedFp === undefined) {
    await fingerprintCache.set(FINGERPRINT_KEY, currentFingerprint);
  }
  return true;
}

// ── Alias assets (compatibilité) ──────────────────────────────────────────────

export const getCachedAsset = getCachedChunk;
export const storeCachedAsset = storeCachedChunk;

const ASSET_FINGERPRINT_KEY = "__narvos_asset_fingerprint__";

export async function validateAssetFingerprint(
  currentFingerprint: number,
): Promise<boolean> {
  const stored = await fingerprintCache.get(ASSET_FINGERPRINT_KEY);
  const storedFp = stored?.value;

  if (storedFp !== undefined && storedFp !== currentFingerprint) {
    console.warn(
      `[AssetCache] asset fingerprint mismatch (stored=${storedFp}, current=${currentFingerprint}) -> purge`,
    );
    await clearChunkCache();
    await fingerprintCache.set(ASSET_FINGERPRINT_KEY, currentFingerprint);
    return false;
  }
  if (storedFp === undefined) {
    await fingerprintCache.set(ASSET_FINGERPRINT_KEY, currentFingerprint);
  }
  return true;
}

// ── Debug window (compatibilité) ──────────────────────────────────────────────

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__clearChunkCache = clearChunkCache;
}

// ── Stats pour le monitoring ───────────────────────────────────────────────────

export function getChunkCacheStats() {
  return chunkCache.getStats();
}

export function getChunkCacheLevelStats() {
  return chunkCache.getLevelStats();
}
