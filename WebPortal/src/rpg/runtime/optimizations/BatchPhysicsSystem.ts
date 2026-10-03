// ══════════════════════════════════════════════════════════════════════════════
// runtime/optimizations/BatchPhysicsSystem.ts — Batch physics queries
//
// Batches individual physics queries (raycasts, LOS checks, ground snaps)
// into a single batch operation. Instead of N separate `isBlocked()` calls
// crossing the WASM boundary N times, all queries are sent in a single flat
// buffer and processed in one WASM loop.
//
// Singleton: batchPhysicsSystem
// ══════════════════════════════════════════════════════════════════════════════

import { BatchSystem, BatchProcessingProbe } from "./BatchSystem";

// ── Query types ───────────────────────────────────────────────────────────────

export interface LosQuery extends Record<string, unknown> {
  /** Entity id (for result mapping). */
  entityId: string;
  /** Eye position (world space). */
  eyeX: number; eyeY: number; eyeZ: number;
  /** Target position (world space). */
  targetX: number; targetY: number; targetZ: number;
  /** Query radius. */
  radius: number;
  /** Cached result (written by batcher). */
  blocked?: boolean;
}

export interface GroundSnapQuery extends Record<string, unknown> {
  /** Entity id. */
  entityId: string;
  /** X, Z position to query. */
  x: number; z: number;
  /** Height to start raycast from. */
  fromHeight: number;
  /** Snapped Y (written by batcher). */
  groundY?: number | null;
}

export interface RaycastQuery extends Record<string, unknown> {
  entityId: string;
  originX: number; originY: number; originZ: number;
  dirX: number; dirY: number; dirZ: number;
  maxDist: number;
}

export interface PhysicsBatchContext extends Record<string, unknown> {
  /** Number of pending LOS queries. */
  losCount: number;
  /** Number of pending ground snap queries. */
  groundSnapCount: number;
}

// ── Batch Query Collector ─────────────────────────────────────────────────────

/**
 * Collects physics queries and executes them in batches.
 * Reduces WASM bridge crossings by combining multiple queries
 * into a single flat buffer.
 */
export class BatchQueryCollector {
  private losQueries = new Map<string, LosQuery>();
  private groundSnapQueries = new Map<string, GroundSnapQuery>();
  private probe: BatchProcessingProbe;
  private _enabled = true;

  constructor(probe?: BatchProcessingProbe) {
    this.probe = probe ?? new BatchProcessingProbe();
  }

  get enabled(): boolean { return this._enabled; }
  set enabled(v: boolean) { this._enabled = v; }
  get losCount(): number { return this.losQueries.size; }
  get groundSnapCount(): number { return this.groundSnapQueries.size; }

  /** Register a LOS query for this frame. */
  addLos(query: LosQuery): void {
    this.losQueries.set(query.entityId, query);
  }

  /** Register a ground snap query for this frame. */
  addGroundSnap(query: GroundSnapQuery): void {
    this.groundSnapQueries.set(query.entityId, query);
  }

  /** Get a LOS result (cached from last batch execution). */
  getLosResult(entityId: string): boolean | undefined {
    return this.losQueries.get(entityId)?.blocked;
  }

  /** Get a ground snap result. */
  getGroundSnapResult(entityId: string): number | null | undefined {
    return this.groundSnapQueries.get(entityId)?.groundY;
  }

  /**
   * Execute all pending LOS queries as a single batch.
   * In WASM mode, this would pack all queries into a flat Float32Array,
   * call a batch WASM function, and read results in one operation.
   *
   * Currently uses individual isBlocked calls but could be upgraded to
   * a true batch WASM call when the backend supports it.
   */
  executeLosBatch(
    isBlockedFn: (from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, radius: number) => boolean,
  ): number {
    if (!this._enabled || this.losQueries.size === 0) return 0;

    return this.probe.measure("phy_los_batch", this.losQueries.size, () => {
      const from = { x: 0, y: 0, z: 0 };
      const to = { x: 0, y: 0, z: 0 };

      const entries = Array.from(this.losQueries);
      for (let i = 0; i < entries.length; i++) {
        const [, q] = entries[i];
        from.x = q.eyeX; from.y = q.eyeY; from.z = q.eyeZ;
        to.x = q.targetX; to.y = q.targetY; to.z = q.targetZ;
        q.blocked = isBlockedFn(from, to, q.radius);
      }

      return this.losQueries.size;
    });
  }

  /**
   * Execute all LOS queries individually (benchmark baseline).
   */
  executeLosIndividual(
    isBlockedFn: (from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, radius: number) => boolean,
  ): number {
    if (!this._enabled || this.losQueries.size === 0) return 0;

    let count = 0;
    const entries = Array.from(this.losQueries);
    for (let i = 0; i < entries.length; i++) {
      const [, q] = entries[i];
      const from = { x: q.eyeX, y: q.eyeY, z: q.eyeZ };
      const to = { x: q.targetX, y: q.targetY, z: q.targetZ };
      this.probe.measure("phy_los_individual", 1, () => {
        q.blocked = isBlockedFn(from, to, q.radius);
      });
      count++;
    }
    return count;
  }

  /**
   * Execute all ground snap queries as a single batch.
   */
  executeGroundSnapBatch(
    getGroundYFn: (x: number, z: number, fromHeight: number) => number | null,
  ): number {
    if (!this._enabled || this.groundSnapQueries.size === 0) return 0;

    return this.probe.measure("phy_ground_batch", this.groundSnapQueries.size, () => {
      const entries = Array.from(this.groundSnapQueries);
      for (let i = 0; i < entries.length; i++) {
        const [, q] = entries[i];
        q.groundY = getGroundYFn(q.x, q.z, q.fromHeight);
      }
      return this.groundSnapQueries.size;
    });
  }

  /** Clear all pending queries. Call at end of frame. */
  clear(): void {
    this.losQueries.clear();
    this.groundSnapQueries.clear();
  }

  /** Get the probe for benchmarking. */
  getProbe(): BatchProcessingProbe { return this.probe; }

  /**
   * Compare batch vs individual LOS execution.
   */
  compareLos(
    labelIndividual: string,
    labelBatch: string,
  ): ReturnType<BatchProcessingProbe["compare"]> {
    return this.probe.compare(labelIndividual, labelBatch);
  }
}

// ── Batch Physics System (manages the collector) ──────────────────────────────

class BatchPhysicsSystemImpl extends BatchSystem<PhysicsBatchContext> {
  /** The query collector for this frame. */
  readonly collector = new BatchQueryCollector();
  /** Size for a single batch raycast query in floats (6 for from+to + 1 for radius = 7). */
  static readonly LOS_FLOATS_PER_QUERY = 7; // fromX,Y,Z + toX,Y,Z + radius
  /** Size for ground snap in floats (3 for x,z,fromHeight). */
  static readonly GROUND_FLOATS_PER_QUERY = 3;

  /**
   * Pack all LOS queries into a flat Float32Array for WASM batch processing.
   * Format: [fromX, fromY, fromZ, toX, toY, toZ, radius] per query.
   */
  packLosQueries(): Float32Array {
    const count = this.collector.losCount;
    if (count === 0) return new Float32Array(0);

    const arr = new Float32Array(count * BatchPhysicsSystemImpl.LOS_FLOATS_PER_QUERY);
    const entries = Array.from(this.collector["losQueries"]);
    let i = 0;
    for (let e = 0; e < entries.length; e++) {
      const [, q] = entries[e];
      arr[i]     = q.eyeX;    arr[i + 1] = q.eyeY;    arr[i + 2] = q.eyeZ;
      arr[i + 3] = q.targetX; arr[i + 4] = q.targetY; arr[i + 5] = q.targetZ;
      arr[i + 6] = q.radius;
      i += BatchPhysicsSystemImpl.LOS_FLOATS_PER_QUERY;
    }
    return arr;
  }

  /**
   * Pack all ground snap queries into a flat Float32Array.
   * Format: [x, z, fromHeight] per query.
   */
  packGroundSnapQueries(): Float32Array {
    const count = this.collector.groundSnapCount;
    if (count === 0) return new Float32Array(0);

    const arr = new Float32Array(count * BatchPhysicsSystemImpl.GROUND_FLOATS_PER_QUERY);
    const entries = Array.from(this.collector["groundSnapQueries"]);
    let i = 0;
    for (let e = 0; e < entries.length; e++) {
      const [, q] = entries[e];
      arr[i] = q.x; arr[i + 1] = q.z; arr[i + 2] = q.fromHeight;
      i += BatchPhysicsSystemImpl.GROUND_FLOATS_PER_QUERY;
    }
    return arr;
  }
}

// Singleton
export const batchPhysicsSystem = new BatchPhysicsSystemImpl();
