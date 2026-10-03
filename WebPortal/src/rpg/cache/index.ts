// ══════════════════════════════════════════════════════════════════════════════
// cache/index.ts — Barrel export du système de cache unifié
// ══════════════════════════════════════════════════════════════════════════════

export {
  EvictionStrategy,
  CacheLevel,
} from "./types";
export type {
  CacheEntryMeta,
  CacheEntry,
  CacheStats,
  CacheOptions,
  CacheResult,
  ICacheLevel,
  Serializer,
} from "./types";

export {
  MemoryCacheLevel,
  IndexedDBCacheLevel,
  NetworkCacheLevel,
} from "./levels";

export { UnifiedCache } from "./unifiedCache";
export type { UnifiedCacheConfig } from "./unifiedCache";

export {
  memoize,
  memoizeSync,
  memoizeSyncPure,
  clearAllMemoCaches,
  clearMemoCache,
} from "./memoize";
export type { MemoizeOptions } from "./memoize";

export {
  runBenchmark,
  compareStrategies,
  benchFullChain,
} from "./benchmark";
export type { BenchmarkResult, BenchmarkConfig } from "./benchmark";

export {
  WasmCache,
  wasmBlendCache,
  navMeshWalkableCache,
  navMeshBakeCache,
} from "./wasmCache";

export {
  cachedBlendWeightsForAngle,
  cachedSolveLocomotion,
  createCachedSolveLocomotion,
  memoizedMaskClipToBones,
} from "./animationBlendCache";
export type { BlendWeightCache, LocomotionInputKey } from "./animationBlendCache";
