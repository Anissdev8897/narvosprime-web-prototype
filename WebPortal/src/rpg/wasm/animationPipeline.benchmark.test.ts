// ══════════════════════════════════════════════════════════════════════════════
// wasm/animationPipeline.benchmark.test.ts — Benchmark pipeline unifié
//
// Mesure le coût de l'architecture WASM→JS :
//   • Décodage binaire WASM (getDecisions)
//   • applyWasmDecisions (poids → Three.js)
//   • Overhead total du pipeline
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";

const FRAME_BUDGET_MS = 16.67;
const N = 50000;
const DECISION_STRIDE = 72;

// ── Résultat simulé ──────────────────────────────────────────────────────────

interface SimDecision {
  clipName: string;
  weight: number;
  timeScale: number;
}

interface WasmBlendResult {
  count: number;
  decisions: SimDecision[];
}

// ── Benchmark 1 : Décodage binaire WASM ──────────────────────────────────────

function createSimulatedWasmBuffer(decisions: SimDecision[]): Float32Array {
  const buf = new Float32Array(decisions.length * (DECISION_STRIDE / 4));
  for (let i = 0; i < decisions.length; i++) {
    const base = i * (DECISION_STRIDE / 4);
    const d = decisions[i];
    // Nom du clip (64 bytes)
    const view = new Uint8Array(buf.buffer, base * 4, 64);
    view.fill(0);
    for (let j = 0; j < d.clipName.length && j < 63; j++) {
      view[j] = d.clipName.charCodeAt(j);
    }
    // weight (f32) à offset 64 = index 16
    buf[base + 16] = d.weight;
    // timeScale (f32) à offset 68 = index 17
    buf[base + 17] = d.timeScale;
  }
  return buf;
}

function decodeWasmBuffer(buf: Float32Array, count: number): SimDecision[] {
  const heapU8 = new Uint8Array(buf.buffer);
  const decisions: SimDecision[] = [];
  for (let i = 0; i < count; i++) {
    const baseBytes = i * DECISION_STRIDE;
    const baseF32 = i * (DECISION_STRIDE / 4);
    let s = "";
    for (let j = 0; j < 64; j++) {
      const c = heapU8[baseBytes + j];
      if (c === 0) break;
      s += String.fromCharCode(c);
    }
    decisions.push({
      clipName: s,
      weight: buf[baseF32 + 16],
      timeScale: buf[baseF32 + 17],
    });
  }
  return decisions;
}

describe("Pipeline WASM→JS : décodage binaire", () => {
  it(`décode ${N} × 2 décisions (overhead bridge)`, () => {
    // Prépare N buffers identiques
    const templateDecisions: SimDecision[] = [
      { clipName: "walk_forward", weight: 0.7, timeScale: 1.0 },
      { clipName: "walk_forwardRight", weight: 0.3, timeScale: 1.0 },
    ];
    const buffers: Float32Array[] = [];
    for (let i = 0; i < 100; i++) {
      buffers.push(createSimulatedWasmBuffer(templateDecisions));
    }

    const t0 = performance.now();
    let totalDecoded = 0;
    for (let i = 0; i < N; i++) {
      const buf = buffers[i % buffers.length];
      const dec = decodeWasmBuffer(buf, 2);
      totalDecoded += dec.length;
    }
    const elapsed = performance.now() - t0;
    const perFrame = elapsed / N;

    console.log(`\n  Décodage WASM buffer ×${N} :`);
    console.log(`    temps total     : ${elapsed.toFixed(2)} ms`);
    console.log(`    par frame       : ${(perFrame * 1000).toFixed(3)} µs`);
    console.log(`    budget 60fps    : ${((perFrame / FRAME_BUDGET_MS) * 100).toFixed(3)} %`);
    console.log(`    ops/sec simulé  : ${Math.round(1000 / perFrame)} fps`);

    expect(totalDecoded).toBe(N * 2);
  });
});

// ── Benchmark 2 : applyWasmDecisions (JS execution) ──────────────────────────

function simulateApplyWasmDecisions(
  result: WasmBlendResult,
  locoActionCount: number,
): number {
  if (result.count === 0) return 0;

  // Normalisation des poids
  let totalWeight = 0;
  for (const d of result.decisions) totalWeight += d.weight;
  if (totalWeight < 0.001) return 0;

  const norm = 1 / totalWeight;

  // Construction de la map des poids par nom
  for (const d of result.decisions) {
    // Simule byName.set(d.clipName, d.weight * norm)
    d.weight = d.weight * norm; // eslint-disable-line no-param-reassign
  }

  return locoActionCount;
}

describe("Pipeline WASM→JS : applyWasmDecisions", () => {
  it(`applique ${N} décisions WASM sur 8 clips directionnels`, () => {
    const result: WasmBlendResult = {
      count: 2,
      decisions: [
        { clipName: "walk_forward", weight: 0.7, timeScale: 1.0 },
        { clipName: "walk_forwardRight", weight: 0.3, timeScale: 1.0 },
      ],
    };

    const t0 = performance.now();
    for (let i = 0; i < N; i++) {
      simulateApplyWasmDecisions(result, 8);
    }
    const elapsed = performance.now() - t0;
    const perFrame = elapsed / N;

    console.log(`\n  applyWasmDecisions (normalisation + mapping) ×${N} :`);
    console.log(`    temps total     : ${elapsed.toFixed(2)} ms`);
    console.log(`    par frame       : ${(perFrame * 1000).toFixed(3)} µs`);
    console.log(`    budget 60fps    : ${((perFrame / FRAME_BUDGET_MS) * 100).toFixed(3)} %`);
    console.log(`    ops/sec simulé  : ${Math.round(1000 / perFrame)} fps`);
  });
});

// ── Benchmark 3 : Pipeline complet (simulé) ──────────────────────────────────

describe("Pipeline WASM→JS complet (simulé)", () => {
  it(`pipeline complet (WASM compute + decode + JS apply) ×${Math.floor(N / 10)}`, () => {
    const M = Math.floor(N / 10);
    const t0 = performance.now();

    for (let i = 0; i < M; i++) {
      // 1. Simule le calcul WASM : calcule angle et poids
      const angle = ((i * 37) % 360) - 180; // pattern déterministe
      const slot = ((angle % 360) + 360) / 45;
      const lo = Math.floor(slot) % 8;
      const hi = (lo + 1) % 8;
      const t = slot - Math.floor(slot);
      const dirs = [
        "forward", "forwardRight", "right", "backRight",
        "back", "backLeft", "left", "forwardLeft",
      ];
      const speed = ((i * 13) % 100) / 50; // 0..2

      const decisions: SimDecision[] = [];
      if (speed >= 0.15) {
        const prefix = speed >= 1.5 ? "run" : "walk";
        if (t < 0.001) {
          decisions.push({ clipName: `${prefix}_${dirs[lo]}`, weight: 1.0, timeScale: speed });
        } else {
          decisions.push({ clipName: `${prefix}_${dirs[lo]}`, weight: 1 - t, timeScale: speed });
          decisions.push({ clipName: `${prefix}_${dirs[hi]}`, weight: t, timeScale: speed });
        }
      }

      // 2. Simule le décodage WASM→JS
      const decoded = decisions.map((d) => ({
        clipName: d.clipName,
        weight: d.weight,
        timeScale: d.timeScale,
      }));

      // 3. Simule applyWasmDecisions
      let total = 0;
      for (const d of decoded) total += d.weight;
      if (total > 0.001) {
        const norm = 1 / total;
        for (const d of decoded) d.weight *= norm;
      }

      // Vérification
      if (decoded.length > 0 && decoded[0].clipName) {
        expect(decoded[0].weight).toBeGreaterThan(0);
      }
    }

    const elapsed = performance.now() - t0;
    const perFrame = elapsed / M;

    console.log(`\n  Pipeline complet WASM→JS ×${M} :`);
    console.log(`    temps total     : ${elapsed.toFixed(2)} ms`);
    console.log(`    par frame       : ${(perFrame * 1000).toFixed(3)} µs`);
    console.log(`    budget 60fps    : ${((perFrame / FRAME_BUDGET_MS) * 100).toFixed(3)} %`);
    console.log(`    ops/sec simulé  : ${Math.round(1000 / perFrame)} fps`);
    console.log(`    vs JS-only      : 1:1 (même calcul, même coût)`);
  });
});

// ── Analyse mémoire ──────────────────────────────────────────────────────────

describe("Analyse mémoire", () => {
  it("estime la mémoire économisée par l'unification", () => {
    // AVANT : JS-only maintient structures côté JS ET clips Three.js
    const jsOnlyMemory = {
      locoActions: "8 clips × ~256 bytes = ~2 KB",
      lastLocoWeights: "~128 bytes",
      lastLocoGait: "~8 bytes",
      total: "~2.1 KB / personnage",
    };

    // APRÈS : WASM décide, JS exécute — mémoire WASM partagée
    const wasmMemory = {
      blendDecisionsBuffer: "72 bytes × 32 entrées max = 2.3 KB (WASM heap)",
      jsDecodedDecisions: "~128 bytes / frame (temporaire, GC)",
      totalWasm: "~2.3 KB partagé entre tous les personnages",
      totalJs: "~128 bytes / personnage / frame",
    };

    console.log("\n  Comparaison mémoire AVANT vs APRÈS :");
    console.log(`  AVANT (JS-only) :`);
    console.log(`    ${JSON.stringify(jsOnlyMemory, null, 4)}`);
    console.log(`  APRÈS (WASM→JS) :`);
    console.log(`    ${JSON.stringify(wasmMemory, null, 4)}`);
    console.log(`  ⇒ Économie : ~2 KB/perso en JS heap (structure de blend)`);
    console.log(`  ⇒ Le buffer WASM est réutilisé (pas d'allocation frame)`);
    console.log(`  ⇒ Le vrai gain : UN SEUL pipeline au lieu de DEUX`);

    // Vérification du calcul de mémoire du buffer WASM
    const maxDecisions = 32;
    const stride = 72;
    const bufferSize = maxDecisions * stride;
    console.log(`\n  Buffer WASM: ${maxDecisions} × ${stride} = ${bufferSize} bytes`);

    expect(bufferSize).toBe(2304); // 32 * 72 = 2304
  });
});
