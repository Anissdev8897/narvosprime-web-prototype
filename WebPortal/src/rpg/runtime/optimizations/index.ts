// ══════════════════════════════════════════════════════════════════════════════
// runtime/optimizations/index.ts — Point d'entrée des optimisations Three.js
//
// Regroupe toutes les optimisations de rendu :
//   - ShaderCache : cache de ShaderMaterial partagé
//   - ChunkLOD    : LOD progressif pour les chunks de map
//   - Benchmark   : mesures FPS / draw calls / mémoire
//   - BatchSystem : traitement par lots (animations, NPC, physique)
// ══════════════════════════════════════════════════════════════════════════════

export { ShaderCache, cloneWithUniforms } from "./ShaderCache";
export type { ShaderCacheKey } from "./ShaderCache";

export {
  createChunkLOD,
  createChunkLODSimple,
  lodVariantPath,
  updateChunkLOD,
  updateChunkLODWithFade,
  lodCrossFade,
  applyCrossFade,
  createBillboardSprite,
  extractDominantColor,
  estimateBillboardSize,
  clearCrossFade,
  LOD_NEAR,
  LOD_MEDIUM,
  LOD_FAR,
  LOD_CULL,
  LOD_FADE_DIST,
  LOD_FILE_SUFFIX_MED,
  LOD_FILE_SUFFIX_LOW,
} from "./ChunkLOD";
export type { ChunkLODLevels } from "./ChunkLOD";

export { useChunkLOD } from "./useChunkLOD";

export {
  LODBenchmark,
  captureLODComparison,
  formatLODReport,
} from "./LODBenchmark";
export type { LODComparisonReport, LODLevel } from "./LODBenchmark";

export { Benchmark, captureBenchmarkSnapshot } from "./Benchmark";
export type { BenchmarkOptions, BenchmarkReport } from "./Benchmark";

// ── Batch processing exports ──────────────────────────────────────────────────

export { BatchSystem, BatchProcessingProbe } from "./BatchSystem";
export type {
  BatchPass,
  BatchPassResult,
  BatchMeasureSample,
  BatchMeasureReport,
} from "./BatchSystem";

export { batchAnimationSystem } from "./BatchAnimationSystem";
export type { AnimationBatchContext } from "./BatchAnimationSystem";

export { batchNpcSystem } from "./BatchNpcSystem";
export type { NpcBatchContext, NpcDecisionBatch } from "./BatchNpcSystem";

export {
  batchPhysicsSystem,
  BatchQueryCollector,
} from "./BatchPhysicsSystem";
export type {
  LosQuery,
  GroundSnapQuery,
  RaycastQuery,
  PhysicsBatchContext,
} from "./BatchPhysicsSystem";
