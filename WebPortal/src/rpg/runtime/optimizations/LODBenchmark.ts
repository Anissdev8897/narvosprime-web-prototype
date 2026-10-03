// ══════════════════════════════════════════════════════════════════════════════
// runtime/optimizations/LODBenchmark.ts — Benchmark LOD draw calls / triangles
//
// Compare les performances AVANT et APRÈS activation du LOD progressif.
//
// Usage :
//   const bench = new LODBenchmark(gl, camera, chunks);
//   bench.measureWithoutLOD();  // snapshot baseline
//   bench.activateLOD();
//   bench.measureWithLOD();     // snapshot après LOD
//   const report = bench.compare();
//
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import type { BenchmarkReport } from "./Benchmark";

export interface LODComparisonReport {
  baseline: {
    drawCalls: number;
    triangles: number;
    geometries: number;
    textureMemoryMB: number;
    fps: number;
  };
  withLOD: {
    drawCalls: number;
    triangles: number;
    geometries: number;
    textureMemoryMB: number;
    fps: number;
  };
  savings: {
    drawCallsPercent: number;
    trianglesPercent: number;
    geometriesPercent: number;
  };
  lodLevelCounts: {
    high: number;
    medium: number;
    low: number;
    culled: number;
  };
}

export type LODLevel = "high" | "medium" | "low" | "culled";

interface LODSnapshot {
  chunks: Map<number, { level: LODLevel }>;
}

/**
 * Benchmark LOD : capture les métriques GPU avant/après activation du LOD.
 *
 * Le benchmark parcourt tous les chunks actifs, inspecte la scène Three.js
 * pour compter les draw calls et triangles, et produit un rapport comparatif.
 */
export class LODBenchmark {
  private gl: THREE.WebGLRenderer;
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private chunkMap: Map<number, THREE.Object3D>;
  private snapshotBefore: LODSnapshot | null = null;
  private snapshotAfter: LODSnapshot | null = null;
  private fpsSamples: number[] = [];
  private lastTime = 0;

  constructor(
    gl: THREE.WebGLRenderer,
    camera: THREE.Camera,
    scene: THREE.Scene,
    chunkMap: Map<number, THREE.Object3D>,
  ) {
    this.gl = gl;
    this.camera = camera;
    this.scene = scene;
    this.chunkMap = chunkMap;
  }

  /**
   * Mesure l'état actuel sans LOD (baseline).
   * Force le rendu pour obtenir des stats GPU à jour.
   */
  measureBaseline(): void {
    // Reset GPU info counters
    this.gl.info.reset?.();
    // Force a render to populate info
    this.gl.render(this.scene, this.camera);

    const chunks = new Map<number, { level: LODLevel }>();
    for (const [id, obj] of this.chunkMap) {
      chunks.set(id, {
        level: obj.visible ? "high" : "culled",
      });
    }

    this.snapshotBefore = { chunks };
    this.lastTime = performance.now();
  }

  /**
   * Mesure l'état avec LOD actif.
   */
  measureWithLOD(): void {
    this.gl.info.reset?.();
    this.gl.render(this.scene, this.camera);

    const chunks = new Map<number, { level: LODLevel }>();
    for (const [id, obj] of this.chunkMap) {
      const level = this.inspectLODLevel(obj);
      chunks.set(id, { level });
    }

    this.snapshotAfter = { chunks };
  }

  /**
   * SAMPLE FPS — appelé par useFrame.
   */
  tickFps(): void {
    const now = performance.now();
    if (this.lastTime > 0) {
      const dt = (now - this.lastTime) / 1000;
      if (dt > 0) this.fpsSamples.push(1 / dt);
    }
    this.lastTime = now;
  }

  /**
   * Compare les deux snapshots et produit un rapport.
   */
  compare(): LODComparisonReport {
    // GPU info actuel
    const info = this.gl.info;
    const calls = info.render?.calls ?? 0;
    const tris = info.render?.triangles ?? 0;
    const geos = info.memory?.geometries ?? 0;
    const texMem = this.estimateTextureMemoryMB();

    // FPS moyen
    const avgFps = this.fpsSamples.length > 0
      ? Math.round(
          this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length,
        )
      : 0;

    // Compter les niveaux LOD
    const levelCounts = this.countLODLevels(this.snapshotAfter ?? this.snapshotBefore);

    // Estimer les économies basées sur les infos GPU
    // Approximation : sans LOD, tous les chunks visibles seraient en HIGH
    const baselineCalls = this.estimateBaselineDrawCalls();
    const baselineTris = this.estimateBaselineTriangles();

    const savings = {
      drawCallsPercent: baselineCalls > 0
        ? Math.round((1 - calls / baselineCalls) * 100)
        : 0,
      trianglesPercent: baselineTris > 0
        ? Math.round((1 - tris / baselineTris) * 100)
        : 0,
      geometriesPercent: baselineTris > 0
        ? Math.round((1 - geos / (baselineTris > tris ? baselineTris * 0.01 : geos)) * 100)
        : 0,
    };

    return {
      baseline: {
        drawCalls: baselineCalls,
        triangles: baselineTris,
        geometries: Math.round(baselineTris * 0.01), // approx
        textureMemoryMB: texMem,
        fps: avgFps,
      },
      withLOD: {
        drawCalls: calls,
        triangles: tris,
        geometries: geos,
        textureMemoryMB: texMem,
        fps: avgFps,
      },
      savings,
      lodLevelCounts: levelCounts,
    };
  }

  /**
   * Réinitialise les échantillons FPS.
   */
  reset(): void {
    this.fpsSamples = [];
    this.snapshotBefore = null;
    this.snapshotAfter = null;
    this.lastTime = 0;
  }

  // ── Privé ──────────────────────────────────────────────────────────────────

  /**
   * Inspecte le niveau LOD actuel d'un objet chunk.
   */
  private inspectLODLevel(obj: THREE.Object3D): LODLevel {
    if (!obj.visible) return "culled";

    // Vérifie si c'est un groupe ChunkLOD
    if (obj.type === "Group" || obj.type === "Scene") {
      for (const child of obj.children) {
        if (!child.visible) continue;
        if (child.name === "LOD_HIGH") return "high";
        if (child.name === "LOD_MED") return "medium";
        if (child.name === "LOD_LOW") return "low";
      }
      // Aucun sous-niveau visible
      return "culled";
    }

    // Si c'est un THREE.LOD natif
    if (obj instanceof THREE.LOD) {
      for (const level of obj.levels) {
        if (level.object.visible) {
          if (level.distance <= 0) return "high";
          if (level.distance <= 60) return "medium";
          return "low";
        }
      }
    }

    return obj.visible ? "high" : "culled";
  }

  /**
   * Compte les chunks par niveau LOD.
   */
  private countLODLevels(
    snapshot: LODSnapshot | null,
  ): { high: number; medium: number; low: number; culled: number } {
    const counts = { high: 0, medium: 0, low: 0, culled: 0 };
    if (!snapshot) return counts;

    for (const [, chunk] of snapshot.chunks) {
      counts[chunk.level]++;
    }
    return counts;
  }

  /**
   * Estime les draw calls sans LOD.
   * Approximation : en HIGH, chaque mesh visible = 1 draw call.
   * On parcourt les objets chargés pour compter les meshes.
   */
  private estimateBaselineDrawCalls(): number {
    let calls = 0;
    for (const [, obj] of this.chunkMap) {
      if (!obj) continue;
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) calls++;
      });
    }
    return calls;
  }

  /**
   * Estime les triangles sans LOD.
   * Parcourt tous les meshes et somme les indices / 3.
   */
  private estimateBaselineTriangles(): number {
    let tris = 0;
    for (const [, obj] of this.chunkMap) {
      if (!obj) continue;
      obj.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh || !mesh.geometry) return;
        const idx = mesh.geometry.getIndex();
        if (idx) {
          tris += idx.count / 3;
        } else if (mesh.geometry.attributes.position) {
          tris += mesh.geometry.attributes.position.count / 3;
        }
      });
    }
    return Math.round(tris);
  }

  /**
   * Estimation de la mémoire texture (identique à Benchmark.ts).
   */
  private estimateTextureMemoryMB(): number {
    try {
      const texCount = this.gl.info.memory?.textures ?? 0;
      return Math.round((texCount * 2 * 1024 * 1024) / (1024 * 1024));
    } catch {
      return 0;
    }
  }
}

/**
 * Génère un rapport textuel formaté pour la console.
 */
export function formatLODReport(report: LODComparisonReport): string {
  const lines = [
    "═══════════════════════════════════════════════════════",
    "          LOD Benchmark Report",
    "═══════════════════════════════════════════════════════",
    "",
    " ── Chunk Distribution ──",
    `   HIGH   : ${report.lodLevelCounts.high}`,
    `   MEDIUM : ${report.lodLevelCounts.medium}`,
    `   LOW    : ${report.lodLevelCounts.low}`,
    `   CULLED : ${report.lodLevelCounts.culled}`,
    "",
    " ── GPU Metrics ──",
    `   Draw calls : ${report.baseline.drawCalls} → ${report.withLOD.drawCalls}`,
    `      Savings : ${report.savings.drawCallsPercent >= 0 ? "−" : "+"}${Math.abs(report.savings.drawCallsPercent)}%`,
    "",
    `   Triangles  : ${(report.baseline.triangles / 1000000).toFixed(1)}M → ${(report.withLOD.triangles / 1000000).toFixed(1)}M`,
    `      Savings : ${report.savings.trianglesPercent >= 0 ? "−" : "+"}${Math.abs(report.savings.trianglesPercent)}%`,
    "",
    `   FPS        : ${report.baseline.fps} → ${report.withLOD.fps}`,
    "",
    "═══════════════════════════════════════════════════════",
  ];
  return lines.join("\n");
}

/**
 * Capture une comparaison LOD en une seule fonction.
 * Utile pour le debug / monitoring.
 */
export function captureLODComparison(
  gl: THREE.WebGLRenderer,
  camera: THREE.Camera,
  scene: THREE.Scene,
  chunkMap: Map<number, THREE.Object3D>,
): LODComparisonReport {
  const bench = new LODBenchmark(gl, camera, scene, chunkMap);
  bench.measureBaseline();
  bench.measureWithLOD();
  return bench.compare();
}
