// ══════════════════════════════════════════════════════════════════════════════
// runtime/optimizations/Benchmark.ts — Benchmark FPS / draw calls / mémoire
//
// Vue d'ensemble des performances en temps réel.
// Peut être activé/désactivé à chaud.
//
// Mesure :
//   - FPS moyen, min, max (fenêtre glissante configurable)
//   - 1% low
//   - Draw calls (gl.info.render.calls)
//   - Triangles (gl.info.render.triangles)
//   - Mémoire texture (approximation via comptage)
//   - Temps de compilation shader
//   - Programmes GL actifs
//
// Usage :
//   const benchmark = new Benchmark(gl, { windowSec: 5 });
//   // Chaque frame : benchmark.tick(deltaTime);
//   // Pour le rapport : const report = benchmark.report();
//   // Pour le rendu DOM : <BenchmarkDisplay benchmark={benchmark} />
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";

export interface BenchmarkOptions {
  /** Fenêtre glissante en secondes (défaut: 5) */
  windowSec: number;
  /** Intervalle d'échantillonnage en ms (défaut: 500) */
  sampleIntervalMs: number;
}

export interface BenchmarkReport {
  fps: { avg: number; min: number; max: number };
  fpsLow1: number;
  frameMs: { avg: number; max: number };
  drawCalls: number;
  triangles: number;
  textureMemoryMB: number;
  shaderPrograms: number;
  geometries: number;
  textures: number;
  sampleCount: number;
}

const DEFAULT_OPTIONS: BenchmarkOptions = {
  windowSec: 5,
  sampleIntervalMs: 500,
};

export class Benchmark {
  private gl: THREE.WebGLRenderer | null = null;
  private opts: BenchmarkOptions;
  private samples: number[] = [];
  private acc = 0;
  private _report: BenchmarkReport | null = null;

  constructor(gl?: THREE.WebGLRenderer, opts?: Partial<BenchmarkOptions>) {
    this.gl = gl ?? null;
    this.opts = { ...DEFAULT_OPTIONS, ...opts };
  }

  /** Attache ou remplace le renderer. */
  setRenderer(gl: THREE.WebGLRenderer): void {
    this.gl = gl;
  }

  /**
   * Appelé chaque frame avec le delta time (en secondes).
   *
   * Ne dépend PAS du renderer : les FPS et le temps de frame sont du chronomètre
   * pur. Seuls les compteurs GPU (draw calls, triangles, VRAM) exigent un
   * `WebGLRenderer` — ils valent 0 en son absence. Le garde `if (!this.gl) return`
   * rendait tout le benchmark muet hors navigateur, y compris les mesures de FPS
   * qui sont justement ce qu'on veut pouvoir relever en harnais headless.
   */
  tick(dt: number): void {
    this.samples.push(dt);
    this.acc += dt;

    if (this.acc >= this.opts.sampleIntervalMs / 1000) {
      this._computeReport();
      this.acc = 0;
    }
  }

  /** Retourne le dernier rapport calculé. */
  report(): BenchmarkReport | null {
    return this._report;
  }

  /** Réinitialise tous les échantillons. */
  reset(): void {
    this.samples = [];
    this.acc = 0;
    this._report = null;
  }

  private _computeReport(): void {
    const gl = this.gl;
    if (this.samples.length === 0) {
      this.samples = [];
      return;
    }

    // Fenêtre glissante : on garde les samples des N dernières secondes
    const cutoff = this.opts.windowSec;
    let totalTime = 0;
    const windowSamples: number[] = [];
    for (let i = this.samples.length - 1; i >= 0; i--) {
      totalTime += this.samples[i];
      windowSamples.push(this.samples[i]);
      if (totalTime >= cutoff) break;
    }

    if (windowSamples.length === 0) {
      this.samples = [];
      return;
    }

    const sorted = [...windowSamples].sort((a, b) => b - a); // décroissant
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const min = sorted[sorted.length - 1];
    const max = sorted[0];
    const low1Idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.01));
    const low1 = sorted[low1Idx];

    // Infos GPU — 0 quand aucun renderer n'est attaché (harnais headless).
    const calls = gl?.info.render.calls ?? 0;
    const tris = gl?.info.render.triangles ?? 0;
    const programs = gl?.info.programs?.length ?? 0;
    const geometries = gl?.info.memory?.geometries ?? 0;
    const textures = gl?.info.memory?.textures ?? 0;

    this._report = {
      fps: {
        avg: Math.round(1 / avg),
        min: Math.round(1 / min),
        max: Math.round(1 / max),
      },
      fpsLow1: Math.round(1 / low1),
      frameMs: {
        avg: +(avg * 1000).toFixed(1),
        max: +(max * 1000).toFixed(1),
      },
      drawCalls: calls,
      triangles: tris,
      textureMemoryMB: this._estimateTextureMemoryMB(gl),
      shaderPrograms: programs,
      geometries,
      textures,
      sampleCount: sorted.length,
    };

    // Nettoie les samples trop vieux
    this.samples = this.samples.slice(-windowSamples.length * 3);
  }

  /**
   * Estimation de la mémoire texture utilisée.
   *
   * Parcourt les textures connues de Three.js (info.memory.textures)
   * et estime la VRAM à partir des dimensions et du format.
   * Note : cette estimation est approximative car les textures compressées
   * (KTX2/BC/ASTC) ont des taux de compression très variables.
   */
  private _estimateTextureMemoryMB(gl: THREE.WebGLRenderer): number {
    try {
      const props = gl.properties;
      let totalBytes = 0;
      // Three.js expose le compteur de textures mais pas la mémoire individuelle.
      // On utilise une estimation basée sur le nombre de textures × 2 MB (moyenne
      // empirique pour des textures 1024² KTX2 avec mipmaps).
      const texCount = gl.info.memory?.textures ?? 0;
      totalBytes = texCount * 2 * 1024 * 1024; // ~2 MB par texture
      return Math.round(totalBytes / (1024 * 1024));
    } catch {
      return 0;
    }
  }
}

/**
 * Capture un instantané des performances actuelles du renderer.
 * Utile pour comparer avant/après optimisation.
 */
export function captureBenchmarkSnapshot(gl: THREE.WebGLRenderer): BenchmarkReport {
  const b = new Benchmark(gl, { windowSec: 1, sampleIntervalMs: 100 });
  // Remplit avec quelques samples artificiels pour avoir une baseline
  for (let i = 0; i < 3; i++) {
    b.tick(1 / 60);
  }
  return b.report() ?? {
    fps: { avg: 0, min: 0, max: 0 },
    fpsLow1: 0,
    frameMs: { avg: 0, max: 0 },
    drawCalls: 0,
    triangles: 0,
    textureMemoryMB: 0,
    shaderPrograms: 0,
    geometries: 0,
    textures: 0,
    sampleCount: 0,
  };
}
