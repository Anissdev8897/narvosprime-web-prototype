// ══════════════════════════════════════════════════════════════════════════════
// benchmarks/fps.bench.ts — Benchmark FPS simulé (coût des systèmes par frame)
//
// Mesure le coût CPU de chaque sous-système du game loop :
//   • CharacterController tick
//   • Chunk streaming (activeCells)
//   • EventBus dispatch
//
// Le total par frame est extrapolé pour vérifier qu'on tient le 60 FPS
// (< 16.6 ms par frame).
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";

// ── Mocks ───────────────────────────────────────────────────────────────────
vi.mock("../runtime/CollisionWorld", () => ({
  collisionWorld: {
    getGroundY: () => 0,
    isBlocked: () => false,
    colliderCount: 500,
  },
}));

import { CharacterController } from "../runtime/movement/CharacterController";
import { createPlayerState } from "../runtime/movement/playerState";
import type { InputManager } from "../runtime/movement/InputManager";
import { activeCells } from "../forge/chunkStream";
import { eventBus } from "../runtime/core/EventBus";

// ══════════════════════════════════════════════════════════════════════════════
// Simulation de 3 minutes de jeu (10 800 frames à 60 FPS)
// ══════════════════════════════════════════════════════════════════════════════

function makeInput(over: Partial<Record<string, unknown>> = {}): InputManager {
  return {
    moveX: 0,
    moveZ: -1,
    sprint: true,
    crouchHeld: false,
    jumpHeld: false,
    flyDown: false,
    consumeJump: () => false,
    // `update()` appelle `consumeCrouch()` sans garde depuis le passage du crouch
    // en toggle. Absent du mock, le benchmark lèverait au premier tick — et un
    // benchmark qui lève ne mesure rien.
    consumeCrouch: () => false,
    ...over,
  } as unknown as InputManager;
}

describe("FPS — coût simulé des systèmes (3 min de jeu)", () => {
  const FRAMES_3MIN = 10_800; // 180 s × 60 fps
  const BUDGET_MS = 16.6;    // ms disponibles par frame pour 60 FPS

  it("CharacterController seul : budget < 10% du frame budget", () => {
    const ctrl = new CharacterController(new THREE.Vector3(0, 0, 0));
    const state = createPlayerState();
    const input = makeInput({ sprint: true, moveZ: -1 });

    const t0 = performance.now();
    for (let i = 0; i < FRAMES_3MIN; i++) {
      ctrl.update(0.016, input as InputManager, state);
    }
    const total = performance.now() - t0;
    const avgPerFrame = total / FRAMES_3MIN;
    const budgetPct = (avgPerFrame / BUDGET_MS) * 100;

    console.log(`[FPS-BENCH] CharacterController : ${total.toFixed(1)}ms sur ${FRAMES_3MIN} frames`);
    console.log(`[FPS-BENCH]   moyenne = ${(avgPerFrame * 1000).toFixed(2)}µs/frame  (${budgetPct.toFixed(1)}% du budget 60 FPS)`);
    expect(budgetPct).toBeLessThan(10);
  });

  it("activeCells + chunkStream : budget < 2% du frame budget", () => {
    const positions: Array<[number, number]> = [];
    for (let i = 0; i < FRAMES_3MIN; i++) {
      // Simule un déplacement continu : cercle autour de l'origine
      const angle = (i / FRAMES_3MIN) * Math.PI * 2;
      positions.push([Math.cos(angle) * 100, Math.sin(angle) * 100]);
    }

    const t0 = performance.now();
    for (const [x, z] of positions) {
      activeCells(x, z, 8, 50);
    }
    const total = performance.now() - t0;
    const avgPerFrame = total / FRAMES_3MIN;
    const budgetPct = (avgPerFrame / BUDGET_MS) * 100;

    console.log(`[FPS-BENCH] activeCells : ${total.toFixed(1)}ms sur ${FRAMES_3MIN} frames`);
    console.log(`[FPS-BENCH]   moyenne = ${(avgPerFrame * 1000).toFixed(2)}µs/frame  (${budgetPct.toFixed(1)}% du budget 60 FPS)`);
    expect(budgetPct).toBeLessThan(2);
  });

  it("EventBus dispatch (50 listeners × 100 events) : budget < 1%", () => {
    // `npc:death` n'existe PAS dans `WorldEvents` — le benchmark mesurait donc
    // un dispatch vers un type d'event que le bus ne connaît pas, via un cast
    // qui masquait justement l'erreur. On mesure un event réel : `combat:hit`
    // est le plus fréquent en jeu, c'est celui dont le coût compte.
    const listeners: Array<() => void> = [];
    for (let i = 0; i < 50; i++) {
      listeners.push(eventBus.on("combat:hit", () => { /* noop */ }));
    }

    const payload = {
      targetId: "bench",
      amount: 10,
      weapon: "laser" as const,
      pos: new THREE.Vector3(),
    };
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) {
      eventBus.emit("combat:hit", payload);
    }
    const total = performance.now() - t0;

    console.log(`[FPS-BENCH] EventBus 50 listeners × 100 events : ${total.toFixed(2)}ms`);
    // Nettoyer
    for (const unsub of listeners) unsub();
    expect(total).toBeLessThan(BUDGET_MS * 2);
  });

  it("Budget frame total (tous systèmes) < 16.6 ms", () => {
    // Simulation combinée : tick + chunk + event
    const ctrl = new CharacterController(new THREE.Vector3(0, 0, 0));
    const state = createPlayerState();
    const input = makeInput({ sprint: true, moveZ: -1 });
    const unsub = eventBus.on("combat:hit", () => { /* noop */ });
    const hitPayload = {
      targetId: "bench",
      amount: 10,
      weapon: "laser" as const,
      pos: new THREE.Vector3(),
    };

    // Sous-échantillonnage : on mesure 100 frames seulement
    const SAMPLE = 100;
    const times: number[] = [];

    for (let i = 0; i < SAMPLE; i++) {
      const t0 = performance.now();

      // Tick character controller
      ctrl.update(0.016, input as InputManager, state);

      // Active cells
      activeCells(state.velocity.x, state.velocity.z, 8, 50);

      // EventBus dispatch (1 event par frame)
      eventBus.emit("combat:hit", hitPayload);

      const elapsed = performance.now() - t0;
      times.push(elapsed);
    }

    unsub();

    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const p99 = times.sort((a, b) => a - b)[Math.floor(times.length * 0.99)];

    console.log(`[FPS-BENCH] Frame complète (moyenne ${SAMPLE} échantillons) :`);
    console.log(`[FPS-BENCH]   mean = ${(mean * 1000).toFixed(2)}µs  p99 = ${(p99 * 1000).toFixed(2)}µs`);
    console.log(`[FPS-BENCH]   budget 60 FPS = ${BUDGET_MS}ms  →  ${((mean / BUDGET_MS) * 100).toFixed(1)}% utilisé`);

    expect(mean).toBeLessThan(BUDGET_MS);
  });
});
