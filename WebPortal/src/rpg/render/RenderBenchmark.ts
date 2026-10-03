// ══════════════════════════════════════════════════════════════════════════════
// render/RenderBenchmark.ts — Benchmark de performance rendu
//
// Objectif : Mesurer et comparer les métriques de rendu AVANT/APRÈS
// les optimisations (draw calls, FPS, mémoire GPU).
//
// Métriques mesurées :
//   - Draw calls (via renderer.info)
//   - Triangles (via renderer.info)
//   - FPS (via compteur de frames)
//   - Mémoire GPU (via renderer.info.memory si dispo, sinon estimation)
//   - Temps CPU par frame
//
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";

/** Résultat d'un benchmark snapshot. */
export interface BenchmarkSnapshot {
  /** Horodatage (ms). */
  timestamp: number;
  /** Nombre de draw calls (total). */
  drawCalls: number;
  /** Nombre de triangles rendus. */
  triangles: number;
  /** Points rendus (particules). */
  points: number;
  /** Nombre de lignes rendues. */
  lines: number;
  /** FPS instantané. */
  fps: number;
  /** Frame count cumulé. */
  frameCount: number;
  /** Temps CPU pour cette frame (ms). */
  frameTimeMs: number;
  /** Mémoire GPU estimée (MB, 0 si indisponible). */
  gpuMemoryMB: number;
  /** Nombre de textures chargées. */
  textures: number;
  /** Nombre de geometries chargées. */
  geometries: number;
  /** Nombre de programmes shader. */
  programs: number;
  /** Nombre d'instances InstancedMesh. */
  instanceCount: number;
}

/** Résultat complet d'un benchmark. */
export interface BenchmarkResult {
  /** Étiquette (ex: "AVANT optimisation", "APRÈS InstancedMesh"). */
  label: string;
  /** Durée du benchmark (ms). */
  durationMs: number;
  /** Nombre d'échantillons. */
  samples: number;
  /** Valeurs moyennes. */
  average: BenchmarkSnapshot;
  /** Valeurs min. */
  min: BenchmarkSnapshot;
  /** Valeurs max. */
  max: BenchmarkSnapshot;
  /** Série temporelle complète. */
  timeline: BenchmarkSnapshot[];
}

/** Comparaison AVANT / APRÈS. */
export interface BenchmarkComparison {
  /** Résultat AVANT. */
  before: BenchmarkResult;
  /** Résultat APRÈS. */
  after: BenchmarkResult;
  /** Amélioration relative (ratio, négatif = régression). */
  improvement: {
    drawCalls: number;    // ratio (ex: 0.5 = 50% de draw calls en moins)
    fps: number;          // ratio (ex: 1.5 = 50% plus de FPS)
    triangles: number;    // ratio
    gpuMemoryMB: number;  // différence absolue (négatif = moins de mémoire)
  };
}

// ── Helper : moyenne/min/max ──────────────────────────────────────────────

function averageSnapshots(snapshots: BenchmarkSnapshot[]): BenchmarkSnapshot {
  const n = snapshots.length;
  if (n === 0) return createEmptySnapshot();

  const sum = (key: keyof BenchmarkSnapshot) =>
    snapshots.reduce((s, snap) => s + (snap[key] as number), 0);

  return {
    timestamp: 0,
    drawCalls: sum("drawCalls") / n,
    triangles: sum("triangles") / n,
    points: sum("points") / n,
    lines: sum("lines") / n,
    fps: sum("fps") / n,
    frameCount: snapshots[n - 1].frameCount - snapshots[0].frameCount,
    frameTimeMs: sum("frameTimeMs") / n,
    gpuMemoryMB: sum("gpuMemoryMB") / n,
    textures: sum("textures") / n,
    geometries: sum("geometries") / n,
    programs: sum("programs") / n,
    instanceCount: sum("instanceCount") / n,
  };
}

function minMaxSnapshots(
  snapshots: BenchmarkSnapshot[],
  reduceFn: (a: number, b: number) => number,
): BenchmarkSnapshot {
  if (snapshots.length === 0) return createEmptySnapshot();

  const keys: (keyof BenchmarkSnapshot)[] = [
    "drawCalls", "triangles", "points", "lines", "fps",
    "frameTimeMs", "gpuMemoryMB", "textures", "geometries",
    "programs", "instanceCount",
  ];

  const result = { ...snapshots[0] };
  for (const snap of snapshots.slice(1)) {
    for (const key of keys) {
      result[key] = reduceFn(result[key] as number, snap[key] as number) as any;
    }
  }
  return result;
}

function createEmptySnapshot(): BenchmarkSnapshot {
  return {
    timestamp: 0, drawCalls: 0, triangles: 0, points: 0, lines: 0,
    fps: 0, frameCount: 0, frameTimeMs: 0, gpuMemoryMB: 0,
    textures: 0, geometries: 0, programs: 0, instanceCount: 0,
  };
}

// ── Calculateur de FPS lissé ──────────────────────────────────────────────

class FpsCounter {
  private _frames = 0;
  private _lastTime = performance.now();
  private _fps = 60;

  /** Appeler 1× par frame. */
  tick(): number {
    this._frames++;
    const now = performance.now();
    const dt = now - this._lastTime;
    if (dt >= 1000) {
      // Mise à jour toutes les secondes
      this._fps = (this._frames * 1000) / dt;
      this._frames = 0;
      this._lastTime = now;
    }
    return this._fps;
  }

  get fps(): number {
    return this._fps;
  }
}

// ── Benchmark Runner ──────────────────────────────────────────────────────

/**
 * Runner de benchmark.
 *
 * Usage :
 *   const bench = new RenderBenchmark(renderer);
 *   await bench.snapshot("AVANT");
 *   // ... faire des modifications ...
 *   await bench.snapshot("APRÈS");
 *   const comparison = bench.compare("AVANT", "APRÈS");
 *   console.table(comparison.improvement);
 */
export class RenderBenchmark {
  private _renderer: THREE.WebGLRenderer | null;
  private _results: Map<string, BenchmarkResult> = new Map();
  private _fpsCounter = new FpsCounter();
  private _snapshotBuffer: BenchmarkSnapshot[] = [];
  private _isRunning = false;
  private _animFrameId: number | null = null;
  private _resolvePromise: ((value: BenchmarkResult) => void) | null = null;
  private _currentLabel = "";
  private _startTime = 0;

  constructor(renderer?: THREE.WebGLRenderer | null) {
    this._renderer = renderer ?? null;
  }

  /** Définit (ou change) le renderer. */
  setRenderer(renderer: THREE.WebGLRenderer): void {
    this._renderer = renderer;
  }

  /** Capture un snapshot instantané des métriques. */
  snapshotInstant(): BenchmarkSnapshot {
    const info = this._renderer?.info ?? null;
    const mem = info?.memory ?? null;

    const snap: BenchmarkSnapshot = {
      timestamp: performance.now(),
      drawCalls: info?.render?.calls ?? 0,
      triangles: info?.render?.triangles ?? 0,
      points: info?.render?.points ?? 0,
      lines: info?.render?.lines ?? 0,
      fps: this._fpsCounter.fps,
      frameCount: info?.render?.frame ?? 0,
      frameTimeMs: 0, // Sera rempli par le sample suivant
      gpuMemoryMB: mem
        ? Math.round(
            ((mem.geometries * 0.05 + mem.textures * 0.5) * 2) / (1024 * 1024),
          )
        : 0,
      textures: mem?.textures ?? 0,
      geometries: mem?.geometries ?? 0,
      programs: info?.programs?.length ?? 0,
      instanceCount: this.countInstances(),
    };

    return snap;
  }

  /** Compte le nombre d'instances InstancedMesh dans la scène. */
  private countInstances(): number {
    if (!this._renderer) return 0;
    // On ne peut pas accéder à la scène depuis le renderer facilement.
    // Cette valeur est un indicateur, pas une mesure exacte.
    return 0;
  }

  /**
   * Lance un benchmark d'une durée donnée.
   * Remplit le buffer de snapshots à chaque animation frame.
   */
  async snapshot(
    label: string,
    durationMs: number = 3000,
  ): Promise<BenchmarkResult> {
    if (this._isRunning) {
      throw new Error("Un benchmark est déjà en cours. Appelez abort() d'abord.");
    }

    this._currentLabel = label;
    this._snapshotBuffer = [];
    this._isRunning = true;
    this._startTime = performance.now();

    return new Promise<BenchmarkResult>((resolve) => {
      this._resolvePromise = resolve;
      this._tickSnapshot(durationMs);
    });
  }

  private _tickSnapshot(durationMs: number): void {
    if (!this._isRunning) return;

    const elapsed = performance.now() - this._startTime;
    if (elapsed >= durationMs) {
      this._finishSnapshot();
      return;
    }

    this._fpsCounter.tick();
    const snap = this.snapshotInstant();

    // Calculer le frame time à partir de l'écart entre snapshots
    if (this._snapshotBuffer.length > 0) {
      const prev = this._snapshotBuffer[this._snapshotBuffer.length - 1];
      const dt = snap.timestamp - prev.timestamp;
      // Si > 100ms, le rendu a été interrompu (tab switch, etc.) → ignorer
      if (dt < 100) {
        snap.frameTimeMs = dt;
        this._snapshotBuffer.push(snap);
      }
    } else {
      this._snapshotBuffer.push(snap);
    }

    this._animFrameId = requestAnimationFrame(() => this._tickSnapshot(durationMs));
  }

  private _finishSnapshot(): void {
    this._isRunning = false;
    if (this._animFrameId !== null) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }

    const data = this._snapshotBuffer;
    const result: BenchmarkResult = {
      label: this._currentLabel,
      durationMs: performance.now() - this._startTime,
      samples: data.length,
      average: averageSnapshots(data),
      min: minMaxSnapshots(data, Math.min),
      max: minMaxSnapshots(data, Math.max),
      timeline: data,
    };

    this._results.set(this._currentLabel, result);

    if (this._resolvePromise) {
      this._resolvePromise(result);
      this._resolvePromise = null;
    }
  }

  /** Stoppe un benchmark en cours. */
  abort(): void {
    this._isRunning = false;
    if (this._animFrameId !== null) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }
    if (this._resolvePromise) {
      this._resolvePromise({
        label: this._currentLabel + " (ABORTED)",
        durationMs: performance.now() - this._startTime,
        samples: this._snapshotBuffer.length,
        average: averageSnapshots(this._snapshotBuffer),
        min: minMaxSnapshots(this._snapshotBuffer, Math.min),
        max: minMaxSnapshots(this._snapshotBuffer, Math.max),
        timeline: this._snapshotBuffer,
      });
      this._resolvePromise = null;
    }
  }

  /**
   * Compare deux résultats de benchmark.
   * Les ratios > 1 = amélioration.
   */
  compare(labelBefore: string, labelAfter: string): BenchmarkComparison | null {
    const before = this._results.get(labelBefore);
    const after = this._results.get(labelAfter);
    if (!before || !after) return null;

    return {
      before,
      after,
      improvement: {
        drawCalls: before.average.drawCalls > 0
          ? (before.average.drawCalls - after.average.drawCalls) / before.average.drawCalls
          : 0,
        fps: before.average.fps > 0
          ? (after.average.fps - before.average.fps) / before.average.fps
          : 0,
        triangles: before.average.triangles > 0
          ? (before.average.triangles - after.average.triangles) / before.average.triangles
          : 0,
        gpuMemoryMB: after.average.gpuMemoryMB - before.average.gpuMemoryMB,
      },
    };
  }

  /** Récupère un résultat par étiquette. */
  get(label: string): BenchmarkResult | undefined {
    return this._results.get(label);
  }

  /** Liste toutes les étiquettes de benchmark. */
  get labels(): string[] {
    return Array.from(this._results.keys());
  }

  /** Réinitialise tous les résultats. */
  reset(): void {
    this._results.clear();
    this._snapshotBuffer = [];
  }

  /**
   * Génère un rapport textuel formaté pour la console.
   */
  formatComparison(
    labelBefore: string,
    labelAfter: string,
  ): string {
    const comp = this.compare(labelBefore, labelAfter);
    if (!comp) return `Benchmark introuvable : "${labelBefore}" / "${labelAfter}"`;

    const lines: string[] = [];
    lines.push(`╔══════════════════════════════════════════════════╗`);
    lines.push(`║        BENCHMARK : ${comp.after.label.padEnd(22)} ║`);
    lines.push(`╠══════════════════════════════════════════════════╣`);
    lines.push(`║ Métrique          | Avant      | Après    | Δ   ║`);
    lines.push(`╠══════════════════════════════════════════════════╣`);

    const fmt = (val: number, suffix = "", decimals = 1): string => {
      return `${val.toFixed(decimals)}${suffix}`;
    };
    const fmtPct = (ratio: number): string => {
      const sign = ratio >= 0 ? "+" : "";
      return `${sign}${(ratio * 100).toFixed(1)}%`;
    };

    const b = comp.before.average;
    const a = comp.after.average;
    const impr = comp.improvement;

    lines.push(`║ Draw Calls       | ${fmt(b.drawCalls, "", 0).padStart(8)} | ${fmt(a.drawCalls, "", 0).padStart(8)} | ${fmtPct(-impr.drawCalls).padStart(6)} ║`);
    lines.push(`║ FPS              | ${fmt(b.fps, "", 1).padStart(8)} | ${fmt(a.fps, "", 1).padStart(8)} | ${fmtPct(impr.fps).padStart(6)} ║`);
    lines.push(`║ Triangles        | ${fmt(b.triangles, "", 0).padStart(8)} | ${fmt(a.triangles, "", 0).padStart(8)} | ${fmtPct(-impr.triangles).padStart(6)} ║`);
    lines.push(`║ Frame Time (ms)  | ${fmt(b.frameTimeMs, "", 2).padStart(8)} | ${fmt(a.frameTimeMs, "", 2).padStart(8)} | ${fmtPct((b.frameTimeMs - a.frameTimeMs) / Math.max(b.frameTimeMs, 0.001)).padStart(6)} ║`);
    lines.push(`║ GPU Memory (MB)  | ${fmt(b.gpuMemoryMB, "", 0).padStart(8)} | ${fmt(a.gpuMemoryMB, "", 0).padStart(8)} | ${fmt(impr.gpuMemoryMB, "", 0).padStart(6)} ║`);
    lines.push(`║ Échantillons     | ${fmt(b.drawCalls === 0 ? comp.before.samples : comp.before.samples, "", 0).padStart(8)} | ${fmt(a.drawCalls === 0 ? comp.after.samples : comp.after.samples, "", 0).padStart(8)} |         ║`);
    lines.push(`╚══════════════════════════════════════════════════╝`);

    return lines.join("\n");
  }
}

// ── Hook d'intégration pour diagnostic rapide ─────────────────────────────

/**
 * Mesure les draw calls actuels du renderer.
 * Simple fonction utilitaire pour un check rapide.
 */
export function measureDrawCalls(
  renderer: THREE.WebGLRenderer,
): number {
  return renderer.info?.render?.calls ?? 0;
}

/**
 * Mesure la mémoire GPU estimée à partir des infos renderer.
 */
export function measureGPUMemory(
  renderer: THREE.WebGLRenderer,
): { textures: number; geometries: number; estimatedMB: number } {
  const mem = renderer.info?.memory;
  if (!mem) return { textures: 0, geometries: 0, estimatedMB: 0 };

  // Estimation très approximative
  const estimatedMB = Math.round(
    ((mem.geometries * 0.1 + mem.textures * 1.0)) / (1024 * 1024),
  );

  return {
    textures: mem.textures,
    geometries: mem.geometries,
    estimatedMB,
  };
}
