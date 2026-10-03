// ══════════════════════════════════════════════════════════════════════════════
// runtime/optimizations/BatchSystem.ts — Generic batch processing system
//
// Collects entities into batches and processes them as a group instead of
// individually, reducing per-entity overhead (function calls, WASM crossings,
// allocations).
//
// Batcher registries (singletons):
//   • batchAnimationSystem — batches ALL AnimationController.update() calls
//   • batchNpcSystem       — batches ALL NpcController.update() calls
//   • batchPhysicsSystem   — batches ALL raycast/LOS queries
//
// Usage:
//   // Register items (typically in a useEffect)
//   batchAnimationSystem.register("npc_01", { controller, dt: 0 });
//
//   // In a single useFrame (or game loop tick):
//   const bp = batchAnimationSystem.begin();
//   bp.processAll((items) => {
//     for (const [id, ctx] of items) {
//       ctx.controller.update(ctx.dt);
//     }
//   });
//   bp.end();
//
//   // Or with implicit begin/end via the BatchSystem directly:
//   batchAnimationSystem.measure("individual", (sys) => { sys.processIndividual(...); });
//   batchAnimationSystem.measure("batch", (sys) => { sys.processBatch(...); });
//   const report = batchAnimationSystem.getReport("individual", "batch");
// ══════════════════════════════════════════════════════════════════════════════

// ── Types ─────────────────────────────────────────────────────────────────────

/** Context for a single batch-processing pass. */
export interface BatchPass {
  /** Unique pass id (monotonic counter). */
  readonly passId: number;
  /** Timestamp at pass start (performance.now()). */
  readonly timestamp: number;
  /** Number of items in this pass. */
  readonly size: number;
  /** Process all items in one callback. */
  processAll(fn: (items: Map<string, unknown>) => void): void;
  /** Mark the pass as ended and collect timing. */
  end(): BatchPassResult;
}

export interface BatchPassResult {
  passId: number;
  size: number;
  elapsedMs: number;
  itemsPerMs: number;
}

/** Measurement sample for comparison. */
export interface BatchMeasureSample {
  label: string;
  passCount: number;
  totalElapsedMs: number;
  avgElapsedMs: number;
  avgItemsPerMs: number;
}

/** Comparison report between two approaches. */
export interface BatchMeasureReport {
  baseline: BatchMeasureSample;
  optimized: BatchMeasureSample;
  speedup: number;          // ratio (optimized / baseline), > 1 = faster
  overheadPct: number;      // batch overhead relative to baseline (%)
  recommendation: string;
}

// ── BatchProcessingProbe (minimal timing) ─────────────────────────────────────

/**
 * Lightweight pass-through probe that measures execution time of any
 * callback. Zero overhead when disabled. Used for A/B timing comparisons
 * without restructuring code.
 */
export class BatchProcessingProbe {
  private _enabled = true;
  private _log: { label: string; elapsedMs: number; itemCount: number }[] = [];

  get enabled(): boolean { return this._enabled; }
  set enabled(v: boolean) { this._enabled = v; }

  /**
   * Wraps a callback with timing measurement.
   * @returns the callback's return value.
   */
  measure<T>(label: string, itemCount: number, fn: () => T): T {
    if (!this._enabled) return fn();
    const t0 = performance.now();
    const result = fn();
    const elapsed = performance.now() - t0;
    this._log.push({ label, elapsedMs: elapsed, itemCount });
    return result;
  }

  /** Clear all samples. */
  clear(): void { this._log.length = 0; }

  /** Number of samples collected. */
  get sampleCount(): number { return this._log.length; }

  /**
   * Get raw samples for external analysis.
   */
  getSamples(): ReadonlyArray<{ label: string; elapsedMs: number; itemCount: number }> {
    return this._log;
  }

  /**
   * Compare two labels and return a report.
   */
  compare(labelA: string, labelB: string): BatchMeasureReport | null {
    const a = this._log.filter((s) => s.label === labelA);
    const b = this._log.filter((s) => s.label === labelB);
    if (a.length === 0 || b.length === 0) return null;

    const avg = (samples: typeof a) => ({
      label: samples[0].label,
      passCount: samples.length,
      totalElapsedMs: samples.reduce((s, x) => s + x.elapsedMs, 0),
      avgElapsedMs: samples.reduce((s, x) => s + x.elapsedMs, 0) / samples.length,
      avgItemsPerMs: samples.reduce((s, x) => s + x.itemCount / Math.max(x.elapsedMs, 0.001), 0) / samples.length,
    });

    const baseline = avg(a);
    const optimized = avg(b);

    const speedup = optimized.avgElapsedMs > 0
      ? baseline.avgElapsedMs / optimized.avgElapsedMs
      : 1;

    const overheadPct = ((optimized.avgElapsedMs - baseline.avgElapsedMs) / Math.max(baseline.avgElapsedMs, 0.001)) * 100;

    let recommendation: string;
    if (speedup > 1.2) {
      recommendation = `✅ Batch processing is ${speedup.toFixed(2)}× faster (${overheadPct.toFixed(1)}% overhead). Use batch mode.`;
    } else if (speedup > 0.9) {
      recommendation = `➡️ Batch processing is comparable (${speedup.toFixed(2)}×). Keep whichever is cleaner.`;
    } else {
      recommendation = `❌ Batch processing is ${(1 / speedup).toFixed(2)}× slower (${overheadPct.toFixed(1)}% overhead). Stick with individual processing.`;
    }

    return {
      baseline,
      optimized,
      speedup,
      overheadPct,
      recommendation,
    };
  }

  /**
   * Generate a formatted report string.
   */
  formatReport(labelA: string, labelB: string): string {
    const r = this.compare(labelA, labelB);
    if (!r) return `[BatchProbe] Insufficient data for "${labelA}" vs "${labelB}".`;

    const lines: string[] = [];
    lines.push(`╔══════════════════════════════════════════════════╗`);
    lines.push(`║     BATCH BENCHMARK REPORT                      ║`);
    lines.push(`╠══════════════════════════════════════════════════╣`);
    // En-têtes tirés des labels RÉELLEMENT comparés. Ils étaient figés à
    // « Individual │ Batch » : dès qu'on comparait autre chose (deux variantes
    // de LOD, deux tailles de lot), le tableau annonçait la mauvaise colonne.
    // Largeurs alignées sur celles des lignes de données (10 et 8).
    lines.push(`║ Metric               │ ${labelA.slice(0, 10).padStart(10)} │ ${labelB.slice(0, 8).padStart(8)} ║`);
    lines.push(`╠══════════════════════════════════════════════════╣`);
    lines.push(`║ Passes               │ ${String(r.baseline.passCount).padStart(10)} │ ${String(r.optimized.passCount).padStart(8)} ║`);
    lines.push(`║ Avg elapsed (ms)     │ ${r.baseline.avgElapsedMs.toFixed(3).padStart(10)} │ ${r.optimized.avgElapsedMs.toFixed(3).padStart(8)} ║`);
    lines.push(`║ Total elapsed (ms)   │ ${r.baseline.totalElapsedMs.toFixed(2).padStart(10)} │ ${r.optimized.totalElapsedMs.toFixed(2).padStart(8)} ║`);
    lines.push(`║ Avg items/ms         │ ${r.baseline.avgItemsPerMs.toFixed(2).padStart(10)} │ ${r.optimized.avgItemsPerMs.toFixed(2).padStart(8)} ║`);
    lines.push(`╠══════════════════════════════════════════════════╣`);
    lines.push(`║ Speedup              │ ${r.speedup.toFixed(3).padStart(10)}×         ║`);
    lines.push(`║ Overhead             │ ${r.overheadPct.toFixed(1).padStart(9)}%         ║`);
    lines.push(`╠══════════════════════════════════════════════════╣`);
    lines.push(`║ ${r.recommendation.padEnd(49)}║`);
    lines.push(`╚══════════════════════════════════════════════════╝`);
    return lines.join("\n");
  }
}

// ── BatchSystem<T> — Generic registry + batch processor ──────────────────────

export class BatchSystem<T extends Record<string, unknown>> {
  private items = new Map<string, T>();
  private passCounter = 0;
  private _enabled = true;
  private probe: BatchProcessingProbe;

  constructor(probe?: BatchProcessingProbe) {
    this.probe = probe ?? new BatchProcessingProbe();
  }

  get enabled(): boolean { return this._enabled; }
  set enabled(v: boolean) { this._enabled = v; }

  get size(): number { return this.items.size; }

  /** Returns the internal probe for measurement. */
  getProbe(): BatchProcessingProbe { return this.probe; }

  register(id: string, item: T): void {
    this.items.set(id, item);
  }

  unregister(id: string): void {
    this.items.delete(id);
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  get(id: string): T | undefined {
    return this.items.get(id);
  }

  getAll(): ReadonlyMap<string, T> {
    return this.items;
  }

  clear(): void {
    this.items.clear();
  }

  /** Begin a batch pass. Call .end() on the returned object to get timing. */
  begin(): BatchPass {
    const passId = ++this.passCounter;
    const timestamp = performance.now();
    const size = this.items.size;

    let ended = false;
    let endTs = 0;

    return {
      passId,
      timestamp,
      size,
      processAll: (fn: (items: Map<string, unknown>) => void) => {
        fn(this.items as unknown as Map<string, unknown>);
      },
      end: (): BatchPassResult => {
        if (ended) throw new Error("BatchPass already ended.");
        ended = true;
        endTs = performance.now();
        const elapsedMs = endTs - timestamp;
        return {
          passId,
          size,
          elapsedMs,
          itemsPerMs: elapsedMs > 0 ? size / elapsedMs : 0,
        };
      },
    };
  }

  /**
   * Process all items individually (baseline for benchmarks).
   * Each item gets its own callback invocation.
   */
  processIndividual(fn: (id: string, item: T) => void): number {
    if (!this._enabled || this.items.size === 0) return 0;
    const entries = Array.from(this.items);
    for (let i = 0; i < entries.length; i++) {
      fn(entries[i][0], entries[i][1]);
    }
    return this.items.size;
  }

  /**
   * Process all items in a single batch callback.
   * The callback receives the full map.
   */
  processBatch(fn: (items: Map<string, T>) => void): number {
    if (!this._enabled || this.items.size === 0) return 0;
    fn(this.items);
    return this.items.size;
  }

  /**
   * Measure and compare individual vs batch processing.
   * Runs `individualFn` N times individually, then `batchFn` N times in batch.
   */
  measure(
    labelIndividual: string,
    labelBatch: string,
    individualFn: (sys: this) => void,
    batchFn: (sys: this) => void,
    passes: number = 10,
  ): BatchMeasureReport | null {
    this.probe.clear();

    // Warmup pass
    individualFn(this);
    batchFn(this);
    this.probe.clear();

    // Measured passes
    for (let i = 0; i < passes; i++) {
      this.probe.measure(labelIndividual, this.items.size, () => {
        individualFn(this);
      });
      this.probe.measure(labelBatch, this.items.size, () => {
        batchFn(this);
      });
    }

    return this.probe.compare(labelIndividual, labelBatch);
  }

  get entries(): ReadonlyArray<[string, T]> {
    return Array.from(this.items);
  }

  /** Get a formatted benchmark report. */
  formatMeasureReport(
    labelIndividual: string,
    labelBatch: string,
  ): string {
    return this.probe.formatReport(labelIndividual, labelBatch);
  }
}
