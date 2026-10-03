// ══════════════════════════════════════════════════════════════════════════════
// runtime/optimizations/BenchmarkProbe.tsx — Probe R3F pour le benchmark
//
// Monte dans le <Canvas> et collecte les métriques en continu.
// Affiche un HUD optionnel avec FPS, draw calls et mémoire.
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Benchmark, type BenchmarkReport } from "./Benchmark";

export { Benchmark };

/**
 * Hook : récupère le dernier rapport du benchmark.
 * Utile pour les composants HORS Canvas qui veulent afficher les stats.
 */
let _latestReport: BenchmarkReport | null = null;
const _subs = new Set<() => void>();

/** Récupère le dernier rapport (thread-safe, lecture seule). */
export function useLatestBenchmarkReport(): BenchmarkReport | null {
  const [report, setReport] = useState<BenchmarkReport | null>(_latestReport);
  useEffect(() => {
    const f = () => setReport({ ..._latestReport! });
    _subs.add(f);
    return () => { _subs.delete(f); };
  }, []);
  return report;
}

/**
 * Composant probe à monter DANS le <Canvas>.
 * Collecte FPS / draw calls / mémoire en continu.
 *
 * Usage :
 *   <Canvas>
 *     <BenchmarkProbe />
 *     ...
 *   </Canvas>
 */
export function BenchmarkProbe() {
  const gl = useThree((s) => s.gl);
  const benchmarkRef = useRef<Benchmark | null>(null);

  if (!benchmarkRef.current) {
    benchmarkRef.current = new Benchmark(gl, {
      windowSec: 5,
      sampleIntervalMs: 500,
    });
  }

  useFrame((_, dt) => {
    benchmarkRef.current!.tick(dt);
    const report = benchmarkRef.current!.report();
    if (report) {
      _latestReport = report;
      for (const f of _subs) f();
    }
  });

  return null;
}

/**
 * HUD DOM pour afficher le benchmark.
 * À monter HORS du Canvas.
 *
 * Usage :
 *   <BenchmarkHud />
 */
export function BenchmarkHud() {
  const report = useLatestBenchmarkReport();
  if (!report) return null;

  return (
    <div style={{
      position: "fixed", top: 8, left: 8, zIndex: 300,
      font: "11px monospace", background: "rgba(0,0,0,0.7)",
      color: "#7CFC00", padding: "6px 9px", borderRadius: 6,
      pointerEvents: "none", whiteSpace: "pre",
    }}>
      <div>FPS {report.fps.avg} · 1%low {report.fpsLow1} · {report.frameMs.avg}ms</div>
      <div>draws {report.drawCalls} · tris {(report.triangles / 1000).toFixed(0)}k</div>
      <div>textures {report.textures} · ~{report.textureMemoryMB}MB · {report.shaderPrograms} shaders</div>
      <div>geometries {report.geometries} · samples {report.sampleCount}</div>
    </div>
  );
}

/**
 * Capture instantanée des performances (une seule mesure).
 * Utile pour les benchmarks « avant / après ».
 */
export function useBenchmarkSnapshot(): BenchmarkReport | null {
  return useLatestBenchmarkReport();
}
