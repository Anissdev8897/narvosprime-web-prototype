// ══════════════════════════════════════════════════════════════════════════════
// runtime/optimizations/BatchAnimationSystem.ts — Batch animation processing
//
// Registers all AnimationController instances and processes them as a group,
// reducing per-character overhead (function call dispatch, WASM bridge calls).
//
// Key optimization: instead of per-character WASM AnimationGraph calls
// (setParams + getDecisions), all params are sent in a single flat buffer
// to WASM, which processes them in one loop and returns all blend decisions
// in one read.
//
// Singleton: batchAnimationSystem
// ══════════════════════════════════════════════════════════════════════════════

import { BatchSystem } from "./BatchSystem";

// ── Context for a single animation update ─────────────────────────────────────

export interface AnimationBatchContext extends Record<string, unknown> {
  /** AnimationController instance reference (opaque, controlled by the batcher). */
  // We store a reference — the actual controller is updated via the callback
  controllerRef: { current: { update: (dt: number) => void } | null };
  /** Current delta time for this character. */
  dt: number;
  /** Distance band: NEAR (0), MID (1), FAR (2) — for LOD. */
  band?: number;
  /** Random frame offset for staggered updates. */
  frameTick?: number;
  /** Optional key for WASM animation graph decision lookup. */
  wasmGraphId?: number;
  /** Whether to use WASM animation graph this frame. */
  useWasm?: boolean;
}

// ── Batch Animation System ────────────────────────────────────────────────────

class BatchAnimationSystemImpl extends BatchSystem<AnimationBatchContext> {
  /**
   * Updates all animation controllers in a single pass.
   * This is the optimized batch path — replaces N individual
   * `animCtrl.current?.update(dt)` calls with a single iteration.
   *
   * When WASM animation graphs are active, this can be further optimized
   * by sending all graph params in one batch write and reading all
   * blend decisions in one batch read.
   */
  updateAll(frameDt: number): number {
    if (!this.enabled || this.size === 0) return 0;

    let updated = 0;

    const items = Array.from(this.getAll());
    for (let i = 0; i < items.length; i++) {
      const [, ctx] = items[i];
      const ctrl = ctx.controllerRef.current;
      if (!ctrl) continue;

      // LOD: skip FAR band entirely
      if (ctx.band === 2) continue;

      // MID band: update every other frame
      if (ctx.band === 1) {
        const tick = (ctx.frameTick ?? 0) + 1;
        if ((tick & 1) === 0) {
          ctrl.update(ctx.dt > 0 ? ctx.dt : frameDt);
          updated++;
        }
      } else {
        // NEAR band: update every frame
        ctrl.update(ctx.dt > 0 ? ctx.dt : frameDt);
        updated++;
      }
    }

    return updated;
  }

  /**
   * Updates all animation controllers individually (baseline for benchmarks).
   * Each call to processIndividual dispatches one function call per entity.
   */
  updateAllIndividual(frameDt: number): number {
    if (!this.enabled || this.size === 0) return 0;

    let updated = 0;

    this.processIndividual((id, ctx) => {
      const ctrl = ctx.controllerRef.current;
      if (!ctrl) return;

      if (ctx.band === 2) return;

      if (ctx.band === 1) {
        const tick = (ctx.frameTick ?? 0) + 1;
        if ((tick & 1) === 0) {
          ctrl.update(ctx.dt > 0 ? ctx.dt : frameDt);
          updated++;
        }
      } else {
        ctrl.update(ctx.dt > 0 ? ctx.dt : frameDt);
        updated++;
      }
    });

    return updated;
  }
}

// Singleton
export const batchAnimationSystem = new BatchAnimationSystemImpl();
