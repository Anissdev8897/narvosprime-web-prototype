/**
 * threading/index — Baril d'export pour le module multithreading P2.
 *
 * Ce module regroupe :
 *   - ChunkWorkerPool — Pool de Web Workers pour chargement chunks
 *   - TaskGraph — Ordonnanceur avec priorité + dépendances
 *   - ParallelFor — Itération parallèle sur tableaux
 *   - WasmPthreads — Gestion pthreads WASM pour calculs IA
 *   - Benchmark — Outils de mesure FPS/temps CPU
 */

export { ChunkWorkerPool } from './ChunkWorkerPool';
export type {
  ChunkLoadResult,
  ChunkWorkerPoolOptions,
} from './ChunkWorkerPool';

export { TaskGraph } from './TaskGraph';
export type {
  TaskGraphOptions,
  TaskOptions,
  TaskInfo,
} from './TaskGraph';

export { ParallelFor } from './ParallelFor';
export type {
  ParallelForOptions,
} from './ParallelFor';

export { WasmPthreadsManager, wasmPthreads } from './WasmPthreads';
export type {
  WasmPthreadsConfig,
  PthreadsStatus,
} from './WasmPthreads';

export {
  FpsBenchmark,
  ChunkLoadBenchmark,
  traceMainThread,
  traceWorker,
  getPerformanceMeasures,
  clearPerformanceMeasures,
} from './Benchmark';
export type {
  FpsStats,
  ChunkLoadMeasurement,
  BenchmarkReport,
} from './Benchmark';

/**
 * Résumé diagnostic du threading.
 */
export function threadingSummary(): string {
  const lines: string[] = [];
  lines.push('═'.repeat(50));
  lines.push('  MULTITHREADING P2 — Diagnostic');
  lines.push('═'.repeat(50));

  // Environnement
  try {
    const hc = navigator.hardwareConcurrency;
    lines.push(`  CPU cores        : ${hc ?? 'N/A'}`);
  } catch {
    lines.push('  CPU cores        : N/A');
  }

  // Web Workers
  try {
    const hasWorker = typeof Worker !== 'undefined';
    lines.push(`  Web Workers      : ${hasWorker ? '✅ Supporté' : '❌ Non supporté'}`);
  } catch {
    lines.push('  Web Workers      : N/A');
  }

  // SharedArrayBuffer (nécessaire pour pthreads WASM)
  try {
    const hasSab = typeof SharedArrayBuffer !== 'undefined';
    lines.push(`  SharedArrayBuffer: ${hasSab ? '✅ OK (COOP/COEP)' : '❌ Manquant'}`);
  } catch {
    lines.push('  SharedArrayBuffer: N/A');
  }

  // requestIdleCallback
  try {
    lines.push(`  requestIdleCallback: ${typeof requestIdleCallback !== 'undefined' ? '✅' : '◻️'}`);
  } catch {
    lines.push('  requestIdleCallback: N/A');
  }

  // OffscreenCanvas
  try {
    lines.push(`  OffscreenCanvas  : ${typeof OffscreenCanvas !== 'undefined' ? '✅' : '◻️'}`);
  } catch {
    lines.push('  OffscreenCanvas  : N/A');
  }

  lines.push('═'.repeat(50));
  return lines.join('\n');
}
