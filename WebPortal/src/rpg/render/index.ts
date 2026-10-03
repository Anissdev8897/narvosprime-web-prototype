// ══════════════════════════════════════════════════════════════════════════════
// render/index.ts — Barrel exports pour le système de rendu optimisé
//
// Regroupe toutes les optimisations de rendu :
//   - InstancedMesh (objets répétés)
//   - GPU Culling (Transform Feedback + Frustum)
//   - Occlusion Culling (raycast-based)
//   - Benchmark (draw calls, FPS, mémoire)
// ══════════════════════════════════════════════════════════════════════════════

// ── Instancing ─────────────────────────────────────────────────────────────
export {
  InstancedMeshSystem,
  optimizeChunkScene,
} from "./InstancedMeshSystem";
export type {
  InstancingConfig,
  MeshGroup,
  InstancingStats,
} from "./InstancedMeshSystem";

// ── GPU Culling ───────────────────────────────────────────────────────────
export {
  FrustumCullingSystem,
  InstanceCullingBattery,
  supportsTransformFeedback,
  detectBestCullingBackend,
  createCullingProgram,
} from "./GPUCullingTransformFeedback";
export type {
  CullingBackend,
  GPUCullingConfig,
  CullingFrameStats,
  CullingReport,
  GPUCullInstanceData,
} from "./GPUCullingTransformFeedback";

// ── Occlusion Culling ─────────────────────────────────────────────────────
export {
  OcclusionCullingSystem,
  applyOcclusionCulling,
} from "./OcclusionCulling";
export type {
  OcclusionCullingConfig,
  OcclusionResult,
  OcclusionStats,
  Occluder,
} from "./OcclusionCulling";

// ── Benchmark ─────────────────────────────────────────────────────────────
export {
  RenderBenchmark,
  measureDrawCalls,
  measureGPUMemory,
} from "./RenderBenchmark";
export type {
  BenchmarkSnapshot,
  BenchmarkResult,
  BenchmarkComparison,
} from "./RenderBenchmark";
