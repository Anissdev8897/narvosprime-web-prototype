// ══════════════════════════════════════════════════════════════════════════════
// benchmarks/math.bench.ts — Benchmark précision/perf des optis mathématiques
//
// Compare chaque fonction approximée avec son équivalent natif :
//   • fastAtan2 / fastAtan2Quick vs Math.atan2
//   • fastSin / fastCos / fastSinCos vs Math.sin / Math.cos
//   • fastHypot vs Math.hypot
//   • fastInvSqrt vs 1/Math.sqrt
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  fastSin, fastCos, fastSinCos,
  fastAtan2, fastAtan2Quick,
  fastHypot, fastHypot3,
  fastInvSqrt,
} from "../math/math-fast";

// ── Configuration du benchmark ──────────────────────────────────────────────
const N = 1_000_000; // 1M itérations par test
const WARMUP = 100_000;

// Tolérances de précision pour les vérifications
const PRECISION_ATAN2 = 5e-3;  // 0.28°
const PRECISION_ATAN2_QUICK = 1.5e-2; // 0.86°
const PRECISION_SIN = 3e-4;
const PRECISION_COS = 3e-4;
const PRECISION_SINCOS = 3e-4;
const PRECISION_HYPOT = 0.1;  // 10%

/**
 * Mesure le temps d'un appel répété. Warmup préalable.
 */
function bench(label: string, fn: () => void, iterations = N): number {
  // Warmup
  for (let i = 0; i < WARMUP; i++) fn();
  // Mesure
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - t0;
  const perOp = (elapsed / iterations) * 1000; // ns/op
  console.log(`  ${label.padEnd(30)} ${elapsed.toFixed(1).padStart(8)}ms total  ${perOp.toFixed(2).padStart(8)}ns/op`);
  return elapsed;
}

// ── Pré-génération des données de test ──────────────────────────────────────
function genAngles(n: number): Float64Array {
  const a = new Float64Array(n);
  for (let i = 0; i < n; i++) a[i] = (Math.random() - 0.5) * 100;
  return a;
}

function genVec2(n: number): { xs: Float64Array; ys: Float64Array } {
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = (Math.random() - 0.5) * 20;
    ys[i] = (Math.random() - 0.5) * 20;
  }
  return { xs, ys };
}

// ── Tests de précision ──────────────────────────────────────────────────────

describe("Précision des approximations", () => {
  it("fastAtan2 : erreur max < 0.28°", () => {
    const { xs, ys } = genVec2(10_000);
    let maxErr = 0;
    for (let i = 0; i < 10_000; i++) {
      const ref = Math.atan2(ys[i], xs[i]);
      const app = fastAtan2(ys[i], xs[i]);
      maxErr = Math.max(maxErr, Math.abs(app - ref));
    }
    console.log(`[PRECISION] fastAtan2 : max error = ${(maxErr * 180 / Math.PI).toFixed(3)}° (${maxErr.toExponential(1)} rad)`);
    expect(maxErr).toBeLessThan(PRECISION_ATAN2);
  });

  it("fastAtan2Quick : erreur max < 0.86°", () => {
    const { xs, ys } = genVec2(10_000);
    let maxErr = 0;
    for (let i = 0; i < 10_000; i++) {
      const ref = Math.atan2(ys[i], xs[i]);
      const app = fastAtan2Quick(ys[i], xs[i]);
      maxErr = Math.max(maxErr, Math.abs(app - ref));
    }
    console.log(`[PRECISION] fastAtan2Quick : max error = ${(maxErr * 180 / Math.PI).toFixed(3)}° (${maxErr.toExponential(1)} rad)`);
    expect(maxErr).toBeLessThan(PRECISION_ATAN2_QUICK);
  });

  it("fastSin : erreur max < 0.017° (LUT 1024)", () => {
    const angles = genAngles(10_000);
    let maxErr = 0;
    for (let i = 0; i < 10_000; i++) {
      const ref = Math.sin(angles[i]);
      const app = fastSin(angles[i]);
      maxErr = Math.max(maxErr, Math.abs(app - ref));
    }
    console.log(`[PRECISION] fastSin : max error = ${(maxErr).toExponential(1)}`);
    expect(maxErr).toBeLessThan(PRECISION_SIN);
  });

  it("fastCos : erreur max < 0.017°", () => {
    const angles = genAngles(10_000);
    let maxErr = 0;
    for (let i = 0; i < 10_000; i++) {
      const ref = Math.cos(angles[i]);
      const app = fastCos(angles[i]);
      maxErr = Math.max(maxErr, Math.abs(app - ref));
    }
    console.log(`[PRECISION] fastCos : max error = ${(maxErr).toExponential(1)}`);
    expect(maxErr).toBeLessThan(PRECISION_COS);
  });

  it("fastHypot : erreur relative < 10%", () => {
    let maxRatio = 0;
    for (let i = 0; i < 10_000; i++) {
      const x = (Math.random() - 0.5) * 100;
      const y = (Math.random() - 0.5) * 100;
      const ref = Math.hypot(x, y);
      const app = fastHypot(x, y);
      if (ref > 1e-6) {
        maxRatio = Math.max(maxRatio, Math.abs(app / ref - 1));
      }
    }
    console.log(`[PRECISION] fastHypot : max relative error = ${(maxRatio * 100).toFixed(1)}%`);
    expect(maxRatio).toBeLessThan(PRECISION_HYPOT);
  });
});

// ── Tests de performance ────────────────────────────────────────────────────

describe("Performance comparée (1M itérations)", () => {
  it("fastAtan2 vs Math.atan2", () => {
    const { xs, ys } = genVec2(N);
    const native = () => { for (let i = 0; i < N; i++) Math.atan2(ys[i], xs[i]); };
    const approx = () => { for (let i = 0; i < N; i++) fastAtan2(ys[i], xs[i]); };
    const tNative = bench("Math.atan2", native, N);
    const tApprox = bench("fastAtan2", approx, N);
    const speedup = tNative / tApprox;
    console.log(`  → speedup: ${speedup.toFixed(2)}×`);
    // Vérifie que c'est pas beaucoup plus lent
    expect(tApprox).toBeLessThan(tNative * 2); // doit être au pire 2× plus lent
  });

  it("fastAtan2Quick vs Math.atan2", () => {
    const { xs, ys } = genVec2(N);
    const native = () => { for (let i = 0; i < N; i++) Math.atan2(ys[i], xs[i]); };
    const approx = () => { for (let i = 0; i < N; i++) fastAtan2Quick(ys[i], xs[i]); };
    const tNative = bench("Math.atan2", native, N);
    const tApprox = bench("fastAtan2Quick", approx, N);
    const speedup = tNative / tApprox;
    console.log(`  → speedup: ${speedup.toFixed(2)}×`);
    expect(tApprox).toBeLessThan(tNative * 2);
  });

  it("fastSin vs Math.sin", () => {
    const angles = genAngles(N);
    const native = () => { for (let i = 0; i < N; i++) Math.sin(angles[i]); };
    const approx = () => { for (let i = 0; i < N; i++) fastSin(angles[i]); };
    const tNative = bench("Math.sin", native, N);
    const tApprox = bench("fastSin", approx, N);
    const speedup = tNative / tApprox;
    console.log(`  → speedup: ${speedup.toFixed(2)}×`);
    expect(tApprox).toBeLessThan(tNative * 2);
  });

  it("fastCos vs Math.cos", () => {
    const angles = genAngles(N);
    const native = () => { for (let i = 0; i < N; i++) Math.cos(angles[i]); };
    const approx = () => { for (let i = 0; i < N; i++) fastCos(angles[i]); };
    const tNative = bench("Math.cos", native, N);
    const tApprox = bench("fastCos", approx, N);
    const speedup = tNative / tApprox;
    console.log(`  → speedup: ${speedup.toFixed(2)}×`);
    expect(tApprox).toBeLessThan(tNative * 2);
  });

  it("fastSinCos combiné vs Math.sin + Math.cos séparés", () => {
    const angles = genAngles(N);
    const separate = () => { for (let i = 0; i < N; i++) { Math.sin(angles[i]); Math.cos(angles[i]); } };
    const combined = () => { for (let i = 0; i < N; i++) fastSinCos(angles[i]); };
    const tSep = bench("Math.sin + Math.cos séparés", separate, N);
    const tComb = bench("fastSinCos combiné", combined, N);
    const speedup = tSep / tComb;
    console.log(`  → speedup: ${speedup.toFixed(2)}×`);
    expect(tComb).toBeLessThan(tSep * 2);
  });

  it("fastHypot vs Math.hypot(2 args)", () => {
    const { xs, ys } = genVec2(N);
    const native = () => { for (let i = 0; i < N; i++) Math.hypot(xs[i], ys[i]); };
    const approx = () => { for (let i = 0; i < N; i++) fastHypot(xs[i], ys[i]); };
    const tNative = bench("Math.hypot", native, N);
    const tApprox = bench("fastHypot", approx, N);
    const speedup = tNative / tApprox;
    console.log(`  → speedup: ${speedup.toFixed(2)}×`);
    expect(tApprox).toBeLessThan(tNative * 2);
  });

  it("fastInvSqrt vs 1/Math.sqrt", () => {
    const vals = genAngles(N).map(v => Math.abs(v) + 0.001);
    const native = () => { for (let i = 0; i < N; i++) 1 / Math.sqrt(vals[i]); };
    const approx = () => { for (let i = 0; i < N; i++) fastInvSqrt(vals[i]); };
    const tNative = bench("1/Math.sqrt", native, N);
    const tApprox = bench("fastInvSqrt", approx, N);
    const speedup = tNative / tApprox;
    console.log(`  → speedup: ${speedup.toFixed(2)}×`);
    // Acceptable si pas trop lent
    expect(tApprox).toBeLessThan(tNative * 3);
  });
});
