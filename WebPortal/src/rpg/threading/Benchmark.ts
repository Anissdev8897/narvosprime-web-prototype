/**
 * Benchmark — Utilitaires de benchmarking FPS/Temps CPU.
 *
 * Mesure et compare les performances avec et sans workers :
 *   - FPS (frames par seconde) — réel, pas estimé
 *   - Temps de chargement des chunks
 *   - CPU time (main thread vs workers)
 *   - Usage mémoire
 *
 * Usage :
 *   const bench = new FpsBenchmark();
 *   bench.start();
 *   // ... pendant le rendu ...
 *   const stats = bench.stop();
 *   console.log(`FPS: ${stats.fps}`);
 *
 *   const chunkBench = new ChunkLoadBenchmark();
 *   await chunkBench.measureLoad('with-worker', () => loadWithWorker(url));
 *   await chunkBench.measureLoad('without-worker', () => loadWithoutWorker(url));
 *   chunkBench.report();
 */

export interface FpsStats {
  /** FPS moyen */
  fps: number;
  /** FPS minimum */
  fpsMin: number;
  /** FPS maximum */
  fpsMax: number;
  /** Nombre d'échantillons */
  samples: number;
  /** Durée totale de la mesure (ms) */
  durationMs: number;
  /** Variabilité (écart-type) */
  stdDev: number;
  /** Frame times bruts (ms) */
  frameTimes: number[];
  /** Nombre de frames lentes (< 30 FPS) */
  slowFrames: number;
}

export interface ChunkLoadMeasurement {
  label: string;
  totalMs: number;
  fetchMs: number;
  parseMs: number;
  bufferSize: number;
  /** true si un worker a été utilisé */
  usedWorker: boolean;
}

export interface BenchmarkReport {
  title: string;
  timestamp: number;
  measurements: ChunkLoadMeasurement[];
  fpsWith: FpsStats[];
  fpsWithout: FpsStats[];
}

// ── FPS Benchmark ─────────────────────────────────────────────────────────

export class FpsBenchmark {
  private frameTimes: number[] = [];
  private lastTime = 0;
  private animFrameId = 0;
  private running = false;
  private _onFrame?: (fps: number) => void;

  constructor(onFrame?: (fps: number) => void) {
    this._onFrame = onFrame;
  }

  /**
   * Démarre la mesure FPS.
   * @param durationMs Durée en ms (0 = indéfini)
   */
  start(durationMs = 0): void {
    if (this.running) return;
    this.running = true;
    this.frameTimes = [];
    this.lastTime = performance.now();

    const tick = (now: number) => {
      if (!this.running) return;
      const delta = now - this.lastTime;
      this.lastTime = now;
      if (delta > 0 && delta < 200) {
        // Ignorer les pauses > 200ms (tab switch, etc.)
        this.frameTimes.push(delta);
        const currentFps = 1000 / delta;
        this._onFrame?.(currentFps);
      }
      this.animFrameId = requestAnimationFrame(tick);
    };

    this.animFrameId = requestAnimationFrame(tick);

    if (durationMs > 0) {
      setTimeout(() => this.stop(), durationMs);
    }
  }

  /**
   * Arrête la mesure et retourne les statistiques.
   */
  stop(): FpsStats {
    this.running = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }

    if (this.frameTimes.length === 0) {
      return { fps: 0, fpsMin: 0, fpsMax: 0, samples: 0, durationMs: 0, stdDev: 0, frameTimes: [], slowFrames: 0 };
    }

    const fpsValues = this.frameTimes.map((t) => 1000 / t);
    const fpsSum = fpsValues.reduce((a, b) => a + b, 0);
    const fpsMean = fpsSum / fpsValues.length;
    const fpsMin = Math.min(...fpsValues);
    const fpsMax = Math.max(...fpsValues);
    const totalTime = this.frameTimes.reduce((a, b) => a + b, 0);

    // Écart-type
    const variance = fpsValues.reduce((sum, v) => sum + (v - fpsMean) ** 2, 0) / fpsValues.length;
    const stdDev = Math.sqrt(variance);

    // Frames lentes (< 30 = frame time > 33.3ms)
    const slowFrames = this.frameTimes.filter((t) => t > 33.33).length;

    return {
      fps: Math.round(fpsMean * 10) / 10,
      fpsMin: Math.round(fpsMin * 10) / 10,
      fpsMax: Math.round(fpsMax * 10) / 10,
      samples: fpsValues.length,
      durationMs: Math.round(totalTime),
      stdDev: Math.round(stdDev * 10) / 10,
      frameTimes: [...this.frameTimes],
      slowFrames,
    };
  }

  /** Mesure en temps réel jusqu'à l'arrêt manuel. */
  get isRunning(): boolean {
    return this.running;
  }
}

// ── Chunk Load Benchmark ──────────────────────────────────────────────────

export class ChunkLoadBenchmark {
  private measurements: ChunkLoadMeasurement[] = [];

  /**
   * Mesure le temps de chargement d'un chunk.
   * @param label Identifiant de la mesure
   * @param loadFn Fonction de chargement à mesurer
   * @param usedWorker true si la fonction utilise un worker
   */
  async measureLoad(
    label: string,
    loadFn: () => Promise<{ buffer?: ArrayBuffer; loadMs: number; fetchMs: number } | void>,
    usedWorker = false,
  ): Promise<ChunkLoadMeasurement> {
    const t0 = performance.now();
    let loadMs = 0;
    let fetchMs = 0;
    let bufferSize = 0;

    try {
      const result = await loadFn();
      if (result && 'loadMs' in result) {
        loadMs = result.loadMs;
        fetchMs = result.fetchMs ?? 0;
      } else {
        loadMs = performance.now() - t0;
        fetchMs = loadMs;
      }
      bufferSize = (result as { buffer?: ArrayBuffer })?.buffer?.byteLength ?? 0;
    } catch (err) {
      console.error(`[Benchmark] ${label} failed:`, err);
    }

    const measurement: ChunkLoadMeasurement = {
      label,
      totalMs: Math.round(loadMs),
      fetchMs: Math.round(fetchMs),
      parseMs: Math.round(Math.max(0, loadMs - fetchMs)),
      bufferSize,
      usedWorker,
    };

    this.measurements.push(measurement);
    return measurement;
  }

  /**
   * Génère un rapport comparatif.
   */
  report(): string {
    if (this.measurements.length === 0) return 'Aucune mesure.';

    const lines: string[] = [];
    lines.push('═'.repeat(60));
    lines.push('  BENCHMARK CHARGEMENT CHUNKS');
    lines.push('═'.repeat(60));

    for (const m of this.measurements) {
      const workerTag = m.usedWorker ? '🔷 Worker' : '◻️  Main';
      lines.push(
        `  ${workerTag} ${m.label}` +
        `  ${m.totalMs}ms total` +
        `  (fetch: ${m.fetchMs}ms` +
        `  parse: ${m.parseMs}ms)` +
        `  ${(m.bufferSize / 1024 / 1024).toFixed(1)} MB`,
      );
    }

    // Comparaison si on a avec et sans worker
    const withWorker = this.measurements.filter((m) => m.usedWorker);
    const withoutWorker = this.measurements.filter((m) => !m.usedWorker);

    if (withWorker.length > 0 && withoutWorker.length > 0) {
      const avgWith = withWorker.reduce((s, m) => s + m.totalMs, 0) / withWorker.length;
      const avgWithout = withoutWorker.reduce((s, m) => s + m.totalMs, 0) / withoutWorker.length;
      const gain = avgWithout > 0 ? ((avgWithout - avgWith) / avgWithout * 100).toFixed(0) : 'N/A';

      lines.push('─'.repeat(60));
      lines.push(`  Comparaison:`);
      lines.push(`    Sans worker : ${avgWithout.toFixed(0)}ms moyenne`);
      lines.push(`    Avec worker : ${avgWith.toFixed(0)}ms moyenne`);
      lines.push(`    Gain        : ${gain}%`);
    }

    lines.push('═'.repeat(60));
    return lines.join('\n');
  }

  /** Réinitialise toutes les mesures. */
  clear(): void {
    this.measurements = [];
  }

  /** Export JSON des mesures */
  toJSON(): BenchmarkReport {
    return {
      title: 'Chunk Benchmark',
      timestamp: Date.now(),
      measurements: this.measurements,
      fpsWith: [],
      fpsWithout: [],
    };
  }
}

// ── Utilitaires ───────────────────────────────────────────────────────────

/**
 * Mesure le temps CPU passé sur le main thread pendant une opération.
 * Utilise performance.mark + measure.
 */
export function traceMainThread(label: string): () => void {
  const markStart = `mt:${label}:start`;
  const markEnd = `mt:${label}:end`;
  performance.mark(markStart);
  return () => {
    performance.mark(markEnd);
    performance.measure(label, markStart, markEnd);
    performance.clearMarks(markStart);
    performance.clearMarks(markEnd);
  };
}

/**
 * Mesure le temps de traitement d'un worker.
 */
export function traceWorker(label: string, workerId: number): () => void {
  const markStart = `worker:${workerId}:${label}:start`;
  const markEnd = `worker:${workerId}:${label}:end`;
  performance.mark(markStart);
  return () => {
    performance.mark(markEnd);
    performance.measure(`worker:${label}`, markStart, markEnd);
    performance.clearMarks(markStart);
    performance.clearMarks(markEnd);
  };
}

/**
 * Récupère les mesures Performance API.
 */
export function getPerformanceMeasures(): PerformanceEntry[] {
  return performance.getEntriesByType('measure').filter(
    (e) => e.name.startsWith('mt:') || e.name.startsWith('worker:'),
  );
}

/** Efface les mesures. */
export function clearPerformanceMeasures(): void {
  performance.clearMeasures();
  performance.clearMarks();
}
