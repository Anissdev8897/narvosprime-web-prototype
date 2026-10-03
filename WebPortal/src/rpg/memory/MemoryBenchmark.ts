// ══════════════════════════════════════════════════════════════════════════════
// memory/MemoryBenchmark.ts — Before/after memory benchmark tool
//
// Runs a timed test (default 3 min) and captures memory snapshots before and
// after. Reports deltas for JS heap, GPU textures, geometries, WASM heap, IDB.
//
// Usage:
//   const bench = new MemoryBenchmark();
//   await bench.run("3 min de jeu", async () => {
//     // play the game for 3 minutes
//     await sleep(180_000);
//   });
//   console.log(bench.report());
// ══════════════════════════════════════════════════════════════════════════════

import { takeSnapshotAsync, diffSnapshots, formatDelta, type MemorySnapshot, type MemoryDelta } from "./MemoryTracker";
import { getDisposeInfo, type DisposeInfo } from "./DisposeTracker";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BenchmarkResult {
  label: string;
  durationMs: number;
  before: MemorySnapshot;
  after: MemorySnapshot;
  delta: MemoryDelta;
  disposeBefore: DisposeInfo;
  disposeAfter: DisposeInfo;
}

// ── Benchmark class ──────────────────────────────────────────────────────────

export class MemoryBenchmark {
  private _before: MemorySnapshot | null = null;
  private _after: MemorySnapshot | null = null;
  private _disposeBefore: DisposeInfo | null = null;
  private _disposeAfter: DisposeInfo | null = null;
  private _label = "";
  private _durationMs = 0;

  /**
   * Run a benchmark: captures before snapshot, executes the action,
   * captures after snapshot, returns the result.
   *
   * @param label Human-readable label for this benchmark
   * @param action Async function to run between snapshots
   */
  async run(label: string, action: () => Promise<void>): Promise<BenchmarkResult> {
    this._label = label;

    // ── Phase 1: Before ──
    if (typeof globalThis !== "undefined" && typeof (globalThis as Record<string, unknown>).gc === "function") {
      (globalThis as Record<string, unknown> as { gc: () => void }).gc();
    }
    // Brief pause for GC to settle
    await sleep(100);
    this._before = await takeSnapshotAsync();
    this._disposeBefore = getDisposeInfo();

    // ── Phase 2: Execute ──
    const t0 = performance.now();
    await action();
    this._durationMs = performance.now() - t0;

    // ── Phase 3: After ──
    if (typeof globalThis !== "undefined" && typeof (globalThis as Record<string, unknown>).gc === "function") {
      (globalThis as Record<string, unknown> as { gc: () => void }).gc();
    }
    await sleep(100);
    this._after = await takeSnapshotAsync();
    this._disposeAfter = getDisposeInfo();

    const delta = diffSnapshots(this._before, this._after);

    return {
      label,
      durationMs: this._durationMs,
      before: this._before,
      after: this._after,
      delta,
      disposeBefore: this._disposeBefore,
      disposeAfter: this._disposeAfter,
    };
  }

  /**
   * Generate a formatted text report of the last benchmark run.
   */
  report(): string {
    if (!this._before || !this._after) return "No benchmark data. Call run() first.";

    const delta = diffSnapshots(this._before, this._after);
    const lines: string[] = [];

    lines.push("═══════════════════════════════════════════════════");
    lines.push(`  MEMORY BENCHMARK: ${this._label}`);
    lines.push(`  Duration: ${(this._durationMs / 1000).toFixed(1)}s`);
    lines.push("─────────────────────────────────────────────────");
    lines.push("  Memory metrics         Before     After      Δ");
    lines.push(`  JS Heap (MB)           ${this._before.jsHeapUsedMB.toFixed(1).padStart(7)}  ${this._after.jsHeapUsedMB.toFixed(1).padStart(7)}  ${(delta.jsHeapUsedMB >= 0 ? "+" : "")}${delta.jsHeapUsedMB.toFixed(1)}`);
    lines.push(`  GPU Textures           ${this._before.texturesGPU.toString().padStart(7)}  ${this._after.texturesGPU.toString().padStart(7)}  ${(delta.texturesGPU >= 0 ? "+" : "")}${delta.texturesGPU}`);
    lines.push(`  GPU Geometries         ${this._before.geometriesGPU.toString().padStart(7)}  ${this._after.geometriesGPU.toString().padStart(7)}  ${(delta.geometriesGPU >= 0 ? "+" : "")}${delta.geometriesGPU}`);
    lines.push(`  Draw Calls             ${this._before.drawCalls.toString().padStart(7)}  ${this._after.drawCalls.toString().padStart(7)}  ${(delta.drawCalls >= 0 ? "+" : "")}${delta.drawCalls}`);
    lines.push(`  Triangles (K)          ${(this._before.triangles / 1000).toFixed(0).padStart(7)}  ${(this._after.triangles / 1000).toFixed(0).padStart(7)}`);
    lines.push(`  WASM Heap (MB)         ${this._before.wasmHeapMB.toFixed(1).padStart(7)}  ${this._after.wasmHeapMB.toFixed(1).padStart(7)}  ${(delta.wasmHeapMB >= 0 ? "+" : "")}${delta.wasmHeapMB.toFixed(1)}`);
    lines.push(`  IndexedDB (MB)         ${this._before.indexedDBSizeMB.toFixed(1).padStart(7)}  ${this._after.indexedDBSizeMB.toFixed(1).padStart(7)}`);
    lines.push("─────────────────────────────────────────────────");

    // Dispose tracker info
    if (this._disposeBefore && this._disposeAfter) {
      lines.push("  Dispose tracker:");
      lines.push(`    Textures created: ${this._disposeBefore.texturesCreated} → ${this._disposeAfter.texturesCreated}`);
      lines.push(`    Textures disposed: ${this._disposeBefore.texturesDisposed} → ${this._disposeAfter.texturesDisposed}`);
      lines.push(`    Geometries created: ${this._disposeBefore.geometriesCreated} → ${this._disposeAfter.geometriesCreated}`);
      lines.push(`    Geometries disposed: ${this._disposeBefore.geometriesDisposed} → ${this._disposeAfter.geometriesDisposed}`);
    }

    // Leak detection
    const texLeak = this._after.texturesGPU - (this._disposeAfter?.texturesCreated ?? 0);
    const geoLeak = this._after.geometriesGPU - (this._disposeAfter?.geometriesCreated ?? 0);
    if (texLeak > 10) lines.push(`  ⚠ Warning: ${texLeak} GPU textures not tracked (pre-date tracker install?)`);
    if (geoLeak > 10) lines.push(`  ⚠ Warning: ${geoLeak} GPU geometries not tracked (pre-date tracker install?)`);

    lines.push("═══════════════════════════════════════════════════\n");
    return lines.join("\n");
  }

  /**
   * Quick summary line.
   */
  summary(): string {
    if (!this._after || !this._before) return "N/A";
    const delta = diffSnapshots(this._before, this._after);
    return `[BENCH] ${this._label}: ${formatDelta(delta)}`;
  }
}

// ── Utility ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run a quick memory benchmark: measures current baseline without any action.
 * Useful as a one-shot diagnostic.
 */
export async function quickBenchmark(label = "snapshot"): Promise<BenchmarkResult> {
  const bench = new MemoryBenchmark();
  return bench.run(label, async () => {
    await sleep(50); // just for GC settling
  });
}
