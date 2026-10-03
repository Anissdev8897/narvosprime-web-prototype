// ══════════════════════════════════════════════════════════════════════════════
// memory/index.ts — MEMOIRE P2 public API
//
// Re-exports everything from the memory optimization modules.
// NOTE: MemoryDebugHud is a React component — import directly from
//       'src/rpg/memory/MemoryDebugHud' when needed to avoid jsx-tsx resolution.
// ══════════════════════════════════════════════════════════════════════════════

export {
  setRenderer,
  setWasmModule,
  takeSnapshot,
  takeSnapshotAsync,
  diffSnapshots,
  formatDelta,
  formatSnapshot,
  subscribe,
  startPolling,
  stopPolling,
} from "./MemoryTracker";
export type { MemorySnapshot, MemoryDelta, MemoryListener } from "./MemoryTracker";

export {
  installDisposeTracker,
  uninstallDisposeTracker,
  isInstalled,
  trackTexture,
  trackGeometry,
  getDisposeInfo,
  resetCounters,
  getLeakReport,
  formatDisposeInfo,
} from "./DisposeTracker";
export type { DisposeInfo } from "./DisposeTracker";

export {
  configureBudget,
  getBudgetConfig,
  checkBudget,
  subscribeBudget,
  startBudgetChecks,
  stopBudgetChecks,
  getLastBudgetStatus,
  formatBudgetStatus,
  setOnBudgetExceeded,
  setOnBudgetRecovered,
} from "./MemoryBudget";
export type { BudgetConfig, BudgetLevel, BudgetStatus, BudgetListener } from "./MemoryBudget";

export {
  acquireVector3,
  releaseVector3,
  acquireVector2,
  releaseVector2,
  acquireQuaternion,
  releaseQuaternion,
  acquireMatrix4,
  releaseMatrix4,
  acquireColor,
  releaseColor,
  ScopedPool,
  getPoolMetrics,
  formatPoolMetrics,
  resetPools,
  warmupPool,
} from "./ObjectPool";
export type { PoolMetrics } from "./ObjectPool";

export { MemoryBenchmark, quickBenchmark } from "./MemoryBenchmark";
export type { BenchmarkResult } from "./MemoryBenchmark";
