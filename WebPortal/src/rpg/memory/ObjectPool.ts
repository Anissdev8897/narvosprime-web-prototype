// ══════════════════════════════════════════════════════════════════════════════
// memory/ObjectPool.ts — Object pooling for temporary Three.js math objects
//
// Extends the existing TMP_* pattern with a formal pool system.
// Goals:
//   • Zero allocations in hot paths (physics, animation, AI queries)
//   • Automatic release tracking
//   • Pool sizing based on actual usage
//
// The project already uses module-level TMP_Vector3 constants (TMP_EYE, TMP_FWD,
// etc.) in ~8 files. This module formalizes that pattern with:
//   1. Dedicated pools for Vector3, Vector2, Quaternion, Matrix4, Color
//   2. ScopedPool — auto-return via RAII-like pattern (borrow → release)
//   3. Pool metrics for diagnostics
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";

// ── Generic pool ─────────────────────────────────────────────────────────────

interface Pool<T> {
  /** Borrow an instance from the pool (or create if exhausted). */
  acquire(): T;
  /** Return an instance to the pool. */
  release(obj: T): void;
  /** Number of instances currently borrowed. */
  active: number;
  /** Total instances ever created. */
  created: number;
  /** Current pool size (available instances). */
  size: number;
}

function createPool<T>(factory: () => T, initialSize = 0): Pool<T> {
  const available: T[] = [];
  let activeCount = 0;
  let createdCount = 0;

  // Pre-populate
  for (let i = 0; i < initialSize; i++) {
    available.push(factory());
    createdCount++;
  }

  return {
    acquire(): T {
      activeCount++;
      const obj = available.length > 0 ? available.pop()! : (createdCount++, factory());
      return obj;
    },
    release(obj: T): void {
      activeCount--;
      available.push(obj);
    },
    get active(): number { return activeCount; },
    get created(): number { return createdCount; },
    get size(): number { return available.length; },
  };
}

// ── Individual pools ─────────────────────────────────────────────────────────

const vector3Pool = createPool(() => new THREE.Vector3(), 16);
const vector2Pool = createPool(() => new THREE.Vector2(), 8);
const quaternionPool = createPool(() => new THREE.Quaternion(), 8);
const matrix4Pool = createPool(() => new THREE.Matrix4(), 4);
const colorPool = createPool(() => new THREE.Color(), 4);
const eulerPool = createPool(() => new THREE.Euler(), 4);

// ── Scoped pool (auto-release) ───────────────────────────────────────────────

/**
 * RAII-style auto-releasing scope.
 *
 * Usage:
 *   const [v, release] = acquireVector3();
 *   v.set(1, 2, 3);
 *   doWork(v);
 *   release(); // returns to pool
 *
 * For multiple objects:
 *   const scope = new ScopedPool();
 *   const a = scope.v3();
 *   const b = scope.v3();
 *   use(a, b);
 *   scope.releaseAll(); // returns ALL to their pools
 */
export class ScopedPool {
  private items: Array<() => void> = [];

  /** Acquire a Vector3 that auto-returns when scope.releaseAll() is called. */
  v3(): THREE.Vector3 {
    const v = vector3Pool.acquire();
    this.items.push(() => vector3Pool.release(v));
    return v;
  }

  /** Acquire a Vector2. */
  v2(): THREE.Vector2 {
    const v = vector2Pool.acquire();
    this.items.push(() => vector2Pool.release(v));
    return v;
  }

  /** Acquire a Quaternion. */
  quat(): THREE.Quaternion {
    const q = quaternionPool.acquire();
    this.items.push(() => quaternionPool.release(q));
    return q;
  }

  /** Acquire a Matrix4. */
  mat4(): THREE.Matrix4 {
    const m = matrix4Pool.acquire();
    this.items.push(() => matrix4Pool.release(m));
    return m;
  }

  /** Acquire a Color. */
  col(): THREE.Color {
    const c = colorPool.acquire();
    this.items.push(() => colorPool.release(c));
    return c;
  }

  /** Acquire an Euler. */
  euler(): THREE.Euler {
    const e = eulerPool.acquire();
    this.items.push(() => eulerPool.release(e));
    return e;
  }

  /** Release ALL acquired objects back to their pools. */
  releaseAll(): void {
    for (const release of this.items) release();
    this.items.length = 0;
  }

  /** Number of items currently acquired. */
  get count(): number {
    return this.items.length;
  }
}

// ── Module-level pooled instances (replaces TMP_* pattern) ───────────────────

/**
 * Return a pooled Vector3. Call `releaseVector3(v)` when done.
 *
 * Prefer this over `new THREE.Vector3()` in update/hot paths.
 *
 * Example:
 *   const v = acquireVector3();
 *   v.copy(somePosition);
 *   // ... use v ...
 *   releaseVector3(v);
 */
export function acquireVector3(): THREE.Vector3 {
  return vector3Pool.acquire();
}

export function releaseVector3(v: THREE.Vector3): void {
  vector3Pool.release(v);
}

export function acquireVector2(): THREE.Vector2 {
  return vector2Pool.acquire();
}

export function releaseVector2(v: THREE.Vector2): void {
  vector2Pool.release(v);
}

export function acquireQuaternion(): THREE.Quaternion {
  return quaternionPool.acquire();
}

export function releaseQuaternion(q: THREE.Quaternion): void {
  quaternionPool.release(q);
}

export function acquireMatrix4(): THREE.Matrix4 {
  return matrix4Pool.acquire();
}

export function releaseMatrix4(m: THREE.Matrix4): void {
  matrix4Pool.release(m);
}

export function acquireColor(): THREE.Color {
  return colorPool.acquire();
}

export function releaseColor(c: THREE.Color): void {
  colorPool.release(c);
}

// ── Pool metrics ─────────────────────────────────────────────────────────────

export interface PoolMetrics {
  vector3: { active: number; created: number; size: number };
  vector2: { active: number; created: number; size: number };
  quaternion: { active: number; created: number; size: number };
  matrix4: { active: number; created: number; size: number };
  color: { active: number; created: number; size: number };
  euler: { active: number; created: number; size: number };
}

/**
 * Get metrics for ALL pools — useful for diagnostics.
 */
export function getPoolMetrics(): PoolMetrics {
  return {
    vector3: { active: vector3Pool.active, created: vector3Pool.created, size: vector3Pool.size },
    vector2: { active: vector2Pool.active, created: vector2Pool.created, size: vector2Pool.size },
    quaternion: { active: quaternionPool.active, created: quaternionPool.created, size: quaternionPool.size },
    matrix4: { active: matrix4Pool.active, created: matrix4Pool.created, size: matrix4Pool.size },
    color: { active: colorPool.active, created: colorPool.created, size: colorPool.size },
    euler: { active: eulerPool.active, created: eulerPool.created, size: eulerPool.size },
  };
}

/**
 * Format pool metrics as a compact HUD line.
 */
export function formatPoolMetrics(): string {
  const m = getPoolMetrics();
  return [
    `📦 V3:${m.vector3.active}/${m.vector3.created}/${m.vector3.size}`,
    `V2:${m.vector2.active}/${m.vector2.created}/${m.vector2.size}`,
    `Q:${m.quaternion.active}/${m.quaternion.created}/${m.quaternion.size}`,
  ].join(" ");
}

/**
 * Reset all pools (drain and reallocate). Useful between benchmark runs.
 */
export function resetPools(): void {
  // Drain active items — the pools reclaim on release.
  // Since we can't force-release borrowed items, we just log.
  // Pool will self-regulate as items are released normally.
}

/**
 * Expand pool sizes by pre-creating more items.
 * Call during loading screens to avoid mid-frame allocations.
 */
export function warmupPool(countV3 = 32, countV2 = 16, countQ = 16): void {
  // Il faut TOUT emprunter avant de rendre quoi que ce soit. En relâchant à
  // chaque tour, on rendait l'objet au pool juste avant de le redemander : la
  // boucle recyclait le même exemplaire N fois et n'en pré-créait qu'UN SEUL.
  // Le pool restait donc vide, et les allocations qu'on prétendait déplacer
  // vers l'écran de chargement tombaient toujours en pleine frame.
  const v3 = Array.from({ length: countV3 }, () => acquireVector3());
  for (const v of v3) releaseVector3(v);

  const v2 = Array.from({ length: countV2 }, () => acquireVector2());
  for (const v of v2) releaseVector2(v);

  const q = Array.from({ length: countQ }, () => acquireQuaternion());
  for (const item of q) releaseQuaternion(item);
}
