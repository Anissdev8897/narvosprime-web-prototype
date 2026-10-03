// ══════════════════════════════════════════════════════════════════════════════
// memory/MemoryTracker.ts — Central memory measurement hub
//
// Collects JS heap, GPU textures/geometries, WASM heap, and IndexedDB estimates
// from a single access point. Built for MEMOIRE P2 benchmarks.
//
// Design decisions:
//   • THREE.WebGLRenderer.info.memory is the SOURCE OF TRUTH for GPU resources.
//     No custom counting — Three.js already tracks textures/geometries there.
//   • JS heap comes from performance.memory (Chrome) or estimate from GC.
//   • WASM heap size read via Module.HEAPU8?.byteLength.
//   • IndexedDB estimate via navigator.storage.estimate().
//   • Snapshots can be diffed (snapshot → delta) for leak detection.
// ══════════════════════════════════════════════════════════════════════════════

import type * as THREE from "three";

/** Snapshot of all tracked memory metrics at a point in time. */
export interface MemorySnapshot {
  /** JavaScript heap used, MB. From performance.memory if available. */
  jsHeapUsedMB: number;
  /** JavaScript heap total, MB. */
  jsHeapTotalMB: number;
  /** GPU textures count (gl.info.memory.textures). */
  texturesGPU: number;
  /** GPU geometries count (gl.info.memory.geometries). */
  geometriesGPU: number;
  /** Draw calls this frame. */
  drawCalls: number;
  /** Triangles rendered this frame. */
  triangles: number;
  /** GPU programs (shaders). */
  programsGPU: number;
  /** WASM heap size, MB. */
  wasmHeapMB: number;
  /** IndexedDB estimated size, MB. */
  indexedDBSizeMB: number;
  /** High-precision timestamp (performance.now()). */
  timestamp: number;
}

/**
 * Computed delta between two snapshots.
 * Positive means growth (leak/load), negative means release.
 */
export interface MemoryDelta {
  jsHeapUsedMB: number;
  texturesGPU: number;
  geometriesGPU: number;
  drawCalls: number;
  wasmHeapMB: number;
  /** Elapsed seconds between the two snapshots. */
  elapsedSec: number;
}

// ── Polling listener ────────────────────────────────────────────────────────
export type MemoryListener = (snap: MemorySnapshot) => void;

// ── Module-level state ──────────────────────────────────────────────────────
const listeners = new Set<MemoryListener>();
let pollIntervalId: ReturnType<typeof setInterval> | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let wasmModule: { HEAPU8?: { byteLength: number } } | null = null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

async function estimateIndexedDB(): Promise<number> {
  try {
    if (typeof navigator?.storage?.estimate !== "function") return 0;
    const est = await navigator.storage.estimate();
    return round1(((est.usage ?? 0) / (1024 * 1024)));
  } catch {
    return 0;
  }
}

function getJSHeap(): { usedMB: number; totalMB: number } {
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  if (mem) {
    return {
      usedMB: round1(mem.usedJSHeapSize / (1024 * 1024)),
      totalMB: round1(mem.totalJSHeapSize / (1024 * 1024)),
    };
  }
  return { usedMB: 0, totalMB: 0 };
}

function getWASMHeapMB(): number {
  try {
    if (wasmModule?.HEAPU8?.byteLength) {
      return round1(wasmModule.HEAPU8.byteLength / (1024 * 1024));
    }
  } catch { /* not available */ }
  return 0;
}

function getGPUInfo(): { textures: number; geometries: number; calls: number; triangles: number; programs: number } {
  if (!renderer) return { textures: 0, geometries: 0, calls: 0, triangles: 0, programs: 0 };
  try {
    const mem = renderer.info.memory;
    const rnd = renderer.info.render;
    return {
      textures: mem.textures,
      geometries: mem.geometries,
      calls: rnd.calls,
      triangles: rnd.triangles,
      programs: (mem as { programs?: number }).programs ?? 0,
    };
  } catch {
    return { textures: 0, geometries: 0, calls: 0, triangles: 0, programs: 0 };
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Set the Three.js WebGLRenderer to poll for GPU info.
 * Called once by the app's init (e.g. main.tsx).
 */
export function setRenderer(gl: THREE.WebGLRenderer): void {
  renderer = gl;
}

/**
 * Optionally register the WASM module for heap tracking.
 * Accepts any object with a HEAPU8 property (Emscripten modules).
 */
export function setWasmModule(mod: Record<string, unknown> | null): void {
  wasmModule = mod as { HEAPU8?: { byteLength: number } } | null;
}

/**
 * Take a single snapshot synchronously (IndexedDB is async — that field
 * will be 0 unless you use takeSnapshotAsync()).
 */
export function takeSnapshot(): MemorySnapshot {
  const js = getJSHeap();
  const gpu = getGPUInfo();
  return {
    jsHeapUsedMB: js.usedMB,
    jsHeapTotalMB: js.totalMB,
    texturesGPU: gpu.textures,
    geometriesGPU: gpu.geometries,
    drawCalls: gpu.calls,
    triangles: gpu.triangles,
    programsGPU: gpu.programs,
    wasmHeapMB: getWASMHeapMB(),
    indexedDBSizeMB: 0,
    timestamp: performance.now(),
  };
}

/**
 * Take a snapshot with IndexedDB size (async).
 */
export async function takeSnapshotAsync(): Promise<MemorySnapshot> {
  const snap = takeSnapshot();
  snap.indexedDBSizeMB = await estimateIndexedDB();
  return snap;
}

/**
 * Compute delta between two snapshots.
 */
export function diffSnapshots(before: MemorySnapshot, after: MemorySnapshot): MemoryDelta {
  return {
    jsHeapUsedMB: round1(after.jsHeapUsedMB - before.jsHeapUsedMB),
    texturesGPU: after.texturesGPU - before.texturesGPU,
    geometriesGPU: after.geometriesGPU - before.geometriesGPU,
    drawCalls: after.drawCalls - before.drawCalls,
    wasmHeapMB: round1(after.wasmHeapMB - before.wasmHeapMB),
    elapsedSec: round1((after.timestamp - before.timestamp) / 1000),
  };
}

/**
 * Format a delta as a human-readable string.
 */
export function formatDelta(d: MemoryDelta): string {
  const parts: string[] = [];
  if (d.jsHeapUsedMB > 1) parts.push(`JS heap +${d.jsHeapUsedMB} MB`);
  else if (d.jsHeapUsedMB < -1) parts.push(`JS heap ${d.jsHeapUsedMB} MB`);
  if (d.texturesGPU > 0) parts.push(`textures +${d.texturesGPU}`);
  else if (d.texturesGPU < 0) parts.push(`textures ${d.texturesGPU}`);
  if (d.geometriesGPU > 0) parts.push(`geometries +${d.geometriesGPU}`);
  else if (d.geometriesGPU < 0) parts.push(`geometries ${d.geometriesGPU}`);
  if (d.wasmHeapMB > 1) parts.push(`WASM +${d.wasmHeapMB} MB`);
  else if (d.wasmHeapMB < -1) parts.push(`WASM ${d.wasmHeapMB} MB`);
  parts.push(`(${d.elapsedSec}s)`);
  return parts.join(" · ");
}

/**
 * Subscribe to periodic memory snapshots.
 * Returns unsubscribe function.
 */
export function subscribe(fn: MemoryListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Start polling at the given interval (ms). Calls all subscribers with
 * a snapshot on each tick. Idempotent — calling twice does nothing.
 */
export function startPolling(intervalMs = 2000): void {
  if (pollIntervalId) return;
  pollIntervalId = setInterval(async () => {
    const snap = await takeSnapshotAsync();
    listeners.forEach((fn) => fn(snap));
  }, intervalMs);
}

/**
 * Stop polling. Idempotent.
 */
export function stopPolling(): void {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
}

/**
 * Format a snapshot for display (compact line).
 */
export function formatSnapshot(s: MemorySnapshot): string {
  return [
    `JS ${s.jsHeapUsedMB}/${s.jsHeapTotalMB} MB`,
    `GPU ${s.texturesGPU}tex ${s.geometriesGPU}geo ${s.drawCalls}dc ${(s.triangles / 1000).toFixed(0)}ktri`,
    `WASM ${s.wasmHeapMB} MB`,
    `IDB ${s.indexedDBSizeMB} MB`,
  ].join(" · ");
}
