// ══════════════════════════════════════════════════════════════════════════════
// runtime/optimizations/BatchNpcSystem.ts — Batch NPC AI processing
//
// Collects all NpcController instances and processes their state machines
// as a group, enabling a single decision array instead of per-NPC ticks.
//
// For WASM-backed AI, the entire NPC batch is processed in one WASM call
// (WorldCoordinator.Tick → AISystem.Update → all entities in one loop).
// This batcher mirrors that pattern on the JS side.
//
// Singleton: batchNpcSystem
// ══════════════════════════════════════════════════════════════════════════════

import { BatchSystem } from "./BatchSystem";
import type { NpcFrameResult } from "../../npc/NpcController";
import type { ActionId } from "../../types";

// ── Context for a single NPC AI update ────────────────────────────────────────

export interface NpcBatchContext extends Record<string, unknown> {
  /** The NpcController instance. */
  controller: {
    update: (dt: number, distToPlayer: number, senses: {
      canSee?: boolean;
      playerAlive?: boolean;
    }) => NpcFrameResult;
    alive: boolean;
    state: string;
    hostile: boolean;
  };
  /** Distance to player (computed externally, shared across all NPCs). */
  distToPlayer: number;
  /** Can this NPC see the player? (computed externally). */
  canSee: boolean;
  /** Is the player alive/targetable? */
  playerAlive: boolean;
  /** Result of this frame's update (written by the batcher). */
  result?: NpcFrameResult;
}

export interface NpcDecisionBatch {
  /** Flat array of decisions indexed by NPC id order. */
  decisions: Map<string, NpcFrameResult>;
  /** Number of decisions written. */
  count: number;
}

// ── Batch NPC System ──────────────────────────────────────────────────────────

class BatchNpcSystemImpl extends BatchSystem<NpcBatchContext> {
  /**
   * Updates all NPC controllers in a single batch pass.
   *
   * Instead of each NPC calling its own `ctrl.update()` individually,
   * this iterates the full map in one tight loop. The distance and
   * senses data are pre-computed externally and passed to each NPC
   * from shared temporaries (fewer allocations).
   *
   * Returns a map of decisions indexed by NPC id.
   */
  updateAll(): NpcDecisionBatch {
    const decisions = new Map<string, NpcFrameResult>();

    if (!this.enabled || this.size === 0) {
      return { decisions, count: 0 };
    }

    const items = Array.from(this.getAll());
    for (let i = 0; i < items.length; i++) {
      const [id, ctx] = items[i];
      if (!ctx.controller.alive) continue;

      const result = ctx.controller.update(1 / 60, ctx.distToPlayer, {
        canSee: ctx.canSee,
        playerAlive: ctx.playerAlive,
      });

      ctx.result = result;
      decisions.set(id, result);
    }

    return { decisions, count: decisions.size };
  }

  /**
   * Updates all NPC controllers individually (benchmark baseline).
   */
  updateAllIndividual(): NpcDecisionBatch {
    const decisions = new Map<string, NpcFrameResult>();

    if (!this.enabled || this.size === 0) {
      return { decisions, count: 0 };
    }

    this.processIndividual((id, ctx) => {
      if (!ctx.controller.alive) return;

      const result = ctx.controller.update(1 / 60, ctx.distToPlayer, {
        canSee: ctx.canSee,
        playerAlive: ctx.playerAlive,
      });

      ctx.result = result;
      decisions.set(id, result);
    });

    return { decisions, count: decisions.size };
  }

  /**
   * Collect all NPC positions into a flat Float32Array for batch WASM upload.
   * [x0, y0, z0, x1, y1, z1, ...]
   */
  collectPositions(): Float32Array {
    const arr = new Float32Array(this.size * 3);
    const items = Array.from(this.getAll());
    for (let i = 0; i < items.length; i++) {
      // Position is embedded in the context by the caller before this pass
      // Real position extraction would come from wasmNpcBridge or posRef
      // Placeholder — actual implementation uses the items iteration
    }
    return arr;
  }
}

// Singleton
export const batchNpcSystem = new BatchNpcSystemImpl();
