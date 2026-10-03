// ══════════════════════════════════════════════════════════════════════════════
// benchmarks/characterController.bench.ts — Benchmark du tick de CharacterController
//
// Mesure le temps d'exécution de CharacterController.update() dans diverses
// conditions (marche, course, saut, accroupi, glissade). Toutes les mesures
// utilisent performance.now() pour une précision milliseconde.
//
// Seuils de performance (mesurés sur Ryzen 5 / 16Go) :
//   • tick simple (walk)       ≤ 0.5 ms
//   • tick avec slide          ≤ 1.0 ms
//   • tick avec saut + coyote  ≤ 1.0 ms
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as THREE from "three";

// ── Mock minimal de CollisionWorld ──────────────────────────────────────────
vi.mock("../runtime/CollisionWorld", () => ({
  collisionWorld: {
    getGroundY: () => 0,
    isBlocked: () => false,
    computeBounds: () => new THREE.Box3(new THREE.Vector3(-200, -10, -200), new THREE.Vector3(200, 100, 200)),
    colliderCount: 500,
  },
}));

import { CharacterController } from "../runtime/movement/CharacterController";
import { createPlayerState } from "../runtime/movement/playerState";
import { PLAYER_CONFIG as C } from "../runtime/movement/playerConfig";
import type { InputManager } from "../runtime/movement/InputManager";

// ══════════════════════════════════════════════════════════════════════════════
// Helpers de benchmark
// ══════════════════════════════════════════════════════════════════════════════

interface BenchResult {
  meanMs: number;
  minMs: number;
  maxMs: number;
  samples: number;
}

function benchTick(
  ctrl: CharacterController,
  input: InputManager,
  state: ReturnType<typeof createPlayerState>,
  dt: number,
  iterations = 1000,
): BenchResult {
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    ctrl.update(dt, input, state);
    const elapsed = performance.now() - t0;
    if (elapsed > 0) times.push(elapsed); // ignore les <0.001 ms
    // Légère variation du dt pour éviter les optimisations JIT uniformes
    dt = 0.016 + (i % 10) * 0.0005;
  }
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  return { meanMs: mean, minMs: min, maxMs: max, samples: times.length };
}

// ══════════════════════════════════════════════════════════════════════════════
// InputManager mock (seuls les champs lus par update() sont fournis)
// ══════════════════════════════════════════════════════════════════════════════

function makeInput(over: Partial<Record<string, unknown>> = {}): InputManager {
  return {
    moveX: 0,
    moveZ: -1,
    sprint: false,
    crouchHeld: false,
    jumpHeld: false,
    flyDown: false,
    consumeJump: () => false,
    // Cf. fps.bench.ts : `update()` consomme le front montant du crouch.
    consumeCrouch: () => false,
    ...over,
  } as unknown as InputManager;
}

// ══════════════════════════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════════════════════════

describe("CharacterController — benchmark tick", () => {
  let ctrl: CharacterController;
  let state: ReturnType<typeof createPlayerState>;

  beforeEach(() => {
    ctrl = new CharacterController(new THREE.Vector3(0, 0, 0));
    state = createPlayerState();
  });

  it("marche avant — temps < 0.5 ms", () => {
    const input = makeInput({ sprint: false, moveZ: -1 });
    const r = benchTick(ctrl, input as InputManager, state, 0.016, 500);
    console.log(`[BENCH] walk forward : mean=${r.meanMs.toFixed(4)}ms  min=${r.minMs.toFixed(4)}ms  max=${r.maxMs.toFixed(4)}ms  (${r.samples} samples)`);
    expect(r.meanMs).toBeLessThan(0.5);
  });

  it("sprint avant — temps < 0.5 ms", () => {
    const input = makeInput({ sprint: true, moveZ: -1 });
    const r = benchTick(ctrl, input as InputManager, state, 0.016, 500);
    console.log(`[BENCH] sprint forward : mean=${r.meanMs.toFixed(4)}ms  min=${r.minMs.toFixed(4)}ms  max=${r.maxMs.toFixed(4)}ms`);
    expect(r.meanMs).toBeLessThan(0.5);
  });

  it("sprint + slide — temps < 1.0 ms", () => {
    // On pré-conditionne en sprintant puis en accroupissant
    const input = makeInput({ sprint: true, moveZ: -1 });
    // Chauffer le slide : sprinter pendant 1 seconde
    for (let i = 0; i < 60; i++) {
      ctrl.update(0.016, input as InputManager, state);
    }
    // Maintenant déclencher le slide via crouch
    const slideInput = makeInput({ sprint: true, crouchHeld: true, moveZ: -1 });
    const r = benchTick(ctrl, slideInput as InputManager, state, 0.016, 200);
    console.log(`[BENCH] sprint+slide : mean=${r.meanMs.toFixed(4)}ms  min=${r.minMs.toFixed(4)}ms  max=${r.maxMs.toFixed(4)}ms`);
    expect(r.meanMs).toBeLessThan(1.0);
  });

  it("saut + atterrissage — temps < 1.0 ms", () => {
    const input = makeInput({ jumpHeld: true, moveZ: -1, consumeJump: () => true });
    const r = benchTick(ctrl, input as InputManager, state, 0.016, 500);
    console.log(`[BENCH] jump : mean=${r.meanMs.toFixed(4)}ms  min=${r.minMs.toFixed(4)}ms  max=${r.maxMs.toFixed(4)}ms`);
    expect(r.meanMs).toBeLessThan(1.0);
  });

  it("état stable (idle) — temps < 0.2 ms", () => {
    const input = makeInput({ moveX: 0, moveZ: 0 });
    const r = benchTick(ctrl, input as InputManager, state, 0.016, 500);
    console.log(`[BENCH] idle : mean=${r.meanMs.toFixed(4)}ms  min=${r.minMs.toFixed(4)}ms  max=${r.maxMs.toFixed(4)}ms`);
    expect(r.meanMs).toBeLessThan(0.2);
  });

  it("5000 ticks cumulés < 100 ms (charge soutenue)", () => {
    const input = makeInput({ sprint: true, moveZ: -1 });
    const t0 = performance.now();
    for (let i = 0; i < 5000; i++) {
      ctrl.update(0.016, input as InputManager, state);
    }
    const total = performance.now() - t0;
    console.log(`[BENCH] 5000 ticks cumulés = ${total.toFixed(2)}ms  (${(total / 5000).toFixed(4)}ms/tick)`);
    expect(total).toBeLessThan(100);
  });
});
