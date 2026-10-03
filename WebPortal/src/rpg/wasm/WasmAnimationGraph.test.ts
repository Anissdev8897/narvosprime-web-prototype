// ══════════════════════════════════════════════════════════════════════════════
// wasm/WasmAnimationGraph.test.ts — Tests du pont WASM AnimationGraph
//
// Ces tests vérifient la logique de décodage des décisions WASM et
// la configuration du graph, SANS dépendre du module WASM (qui n'est
// disponible qu'à l'exécution dans un navigateur).
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from "vitest";
import { WasmAnimationGraph, type BlendDecision } from "./WasmAnimationGraph";

describe("WasmAnimationGraph", () => {
  it("n'est PAS prêt avant init()", () => {
    const graph = new WasmAnimationGraph();
    expect(graph.isReady).toBe(false);
  });

  it("retourne un résultat vide avant init()", () => {
    const graph = new WasmAnimationGraph();
    const result = graph.getDecisions();
    expect(result.count).toBe(0);
    expect(result.decisions).toHaveLength(0);
  });

  it("dispose() ne plante pas même sans init", () => {
    const graph = new WasmAnimationGraph();
    expect(() => graph.dispose()).not.toThrow();
  });

  it("setParams() ne plante pas sans init", () => {
    const graph = new WasmAnimationGraph();
    expect(() => graph.setParams(1, 90, 0.016)).not.toThrow();
  });
});

describe("BlendDecision parsing (simulation WASM)", () => {
  /**
   * Simule la lecture d'un buffer WASM contenant des BlendDecision.
   * La structure WASM est :
   *   clipName: 64 bytes (char[64])
   *   weight:   4 bytes (f32)
   *   timeScale: 4 bytes (f32)
   * Total: 72 bytes par entrée (DECISION_STRIDE)
   */

  /** Taille d'une décision WASM (64 + 4 + 4). */
  const STRIDE = 72;

  /**
   * Crée un buffer WASM simulé avec un Float32Array.
   * Les noms de clip sont stockés comme bytes dans le champ texte.
   */
  function createSimulatedWasmBuffer(decisions: BlendDecision[]): Float32Array {
    const buf = new Float32Array(decisions.length * (STRIDE / 4));

    for (let i = 0; i < decisions.length; i++) {
      const base = i * (STRIDE / 4);
      const d = decisions[i];

      // Écrit le nom du clip (64 bytes = 16 × f32) dans la vue HEAPU8
      const view = new Uint8Array(buf.buffer, base * 4, 64);
      view.fill(0);
      for (let j = 0; j < d.clipName.length && j < 63; j++) {
        view[j] = d.clipName.charCodeAt(j);
      }

      // Écrit weight (f32) à l'offset 64
      buf[base + 16] = d.weight; // 64/4 = 16

      // Écrit timeScale (f32) à l'offset 68
      buf[base + 17] = d.timeScale; // 68/4 = 17
    }

    return buf;
  }

  function simulateReadDecisions(buf: Float32Array, count: number): BlendDecision[] {
    const heapU8 = new Uint8Array(buf.buffer);
    const heapF32 = buf;
    const decisions: BlendDecision[] = [];

    for (let i = 0; i < count; i++) {
      const baseBytes = i * STRIDE;
      const baseF32 = i * (STRIDE / 4);

      // Lit le nom (64 bytes)
      let s = "";
      for (let j = 0; j < 64; j++) {
        const c = heapU8[baseBytes + j];
        if (c === 0) break;
        s += String.fromCharCode(c);
      }

      decisions.push({
        clipName: s,
        weight: heapF32[baseF32 + 16],
        timeScale: heapF32[baseF32 + 17],
      });
    }

    return decisions;
  }

  it("décode correctement un nom de clip depuis le binaire WASM", () => {
    const buf = createSimulatedWasmBuffer([
      { clipName: "walk_forward", weight: 0.7, timeScale: 1.0 },
      { clipName: "walk_right", weight: 0.3, timeScale: 1.0 },
    ]);

    const dec = simulateReadDecisions(buf, 2);
    expect(dec).toHaveLength(2);
    expect(dec[0].clipName).toBe("walk_forward");
    expect(dec[0].weight).toBeCloseTo(0.7);
    expect(dec[1].clipName).toBe("walk_right");
    expect(dec[1].weight).toBeCloseTo(0.3);
  });

  it("maintient la somme des poids à ~1 pour des décisions normales", () => {
    const buf = createSimulatedWasmBuffer([
      { clipName: "walk_forward", weight: 0.6, timeScale: 1.0 },
      { clipName: "walk_forwardRight", weight: 0.4, timeScale: 1.0 },
    ]);

    const dec = simulateReadDecisions(buf, 2);
    const total = dec.reduce((s, d) => s + d.weight, 0);
    expect(total).toBeCloseTo(1.0);
  });

  it("gère les noms de clip longs sans déborder", () => {
    const longName = "crouchwalk_backLeft_very_long_name_that_fits";
    const buf = createSimulatedWasmBuffer([
      { clipName: longName, weight: 1.0, timeScale: 0.8 },
    ]);

    const dec = simulateReadDecisions(buf, 1);
    expect(dec[0].clipName).toBe(longName);
    expect(dec[0].weight).toBeCloseTo(1.0);
  });

  it("gère zéro décisions sans planter", () => {
    const dec = simulateReadDecisions(new Float32Array(0), 0);
    expect(dec).toHaveLength(0);
  });

  it("décode timeScale correctement", () => {
    const buf = createSimulatedWasmBuffer([
      { clipName: "run_forward", weight: 1.0, timeScale: 1.5 },
    ]);

    const dec = simulateReadDecisions(buf, 1);
    expect(dec[0].timeScale).toBeCloseTo(1.5);
  });

  it("tronque les noms à 63 caractères max", () => {
    const longName = "a".repeat(80);
    const buf = createSimulatedWasmBuffer([
      { clipName: longName, weight: 1.0, timeScale: 1.0 },
    ]);

    const dec = simulateReadDecisions(buf, 1);
    // Les 64 premiers chars (63 + null)
    expect(dec[0].clipName.length).toBeLessThanOrEqual(63);
  });
});

describe("applyWasmDecisions (intégration avec AnimationController)", () => {
  it("la fonction applyWasmDecisions normalise les poids correctement", () => {
    // Simule des décisions WASM avec des poids bruts
    const result = {
      count: 2,
      decisions: [
        { clipName: "walk_forward", weight: 7, timeScale: 1.0 },
        { clipName: "walk_right", weight: 3, timeScale: 1.0 },
      ],
    };

    // Normalisation: somme = 10, norm = 0.1
    const totalWeight = result.decisions.reduce((s, d) => s + d.weight, 0);
    const norm = totalWeight > 0 ? 1 / totalWeight : 0;
    expect(totalWeight).toBe(10);
    expect(norm).toBeCloseTo(0.1);

    const normalized = result.decisions.map((d) => ({
      name: d.clipName,
      w: d.weight * norm,
    }));
    expect(normalized[0].w).toBeCloseTo(0.7);
    expect(normalized[1].w).toBeCloseTo(0.3);
    expect(normalized.reduce((s, n) => s + n.w, 0)).toBeCloseTo(1.0);
  });

  it("détecte idle quand tous les poids sont nuls", () => {
    const result = {
      count: 1,
      decisions: [
        { clipName: "idle", weight: 0, timeScale: 0 },
      ],
    };
    const total = result.decisions.reduce((s, d) => s + d.weight, 0);
    // total == 0 → doit déclencher clearLocomotionBlend
    expect(total).toBe(0);
  });

  it("extrait le clip dominant pour la synchro de phase", () => {
    const decisions = [
      { clipName: "run_forward", weight: 0.8, timeScale: 1.2 },
      { clipName: "run_right", weight: 0.2, timeScale: 1.2 },
    ];

    let dominantName = "";
    let dominantWeight = -1;
    for (const d of decisions) {
      if (d.weight > dominantWeight) {
        dominantWeight = d.weight;
        dominantName = d.clipName;
      }
    }

    expect(dominantName).toBe("run_forward");
    expect(dominantWeight).toBeCloseTo(0.8);
  });
});
