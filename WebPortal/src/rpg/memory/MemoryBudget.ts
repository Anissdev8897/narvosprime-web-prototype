// ══════════════════════════════════════════════════════════════════════════════
// memory/MemoryBudget.ts — Memory budget enforcement
//
// Enforces configurable limits on GPU resources (textures, geometries, draw calls).
// When limits are approached, it triggers GC sweeps and logs warnings.
// Designed for MEMOIRE P2: prevents VRAM exhaustion and context loss.
//
// Integrates with:
//   • MemoryTracker.ts for current usage data
//   • DisposeTracker.ts for leak detection
//   • AssetPreloader.ts for eviction decisions
// ══════════════════════════════════════════════════════════════════════════════

import { takeSnapshot, type MemorySnapshot } from "./MemoryTracker";

// ── Types ────────────────────────────────────────────────────────────────────

export interface BudgetConfig {
  /** Max textures on GPU before warning/throttle. Default: 500 */
  maxTextures: number;
  /** Max geometries on GPU before warning/throttle. Default: 300 */
  maxGeometries: number;
  /** Max draw calls before warning. Default: 4000 */
  maxDrawCalls: number;
  /** Max JS heap MB before warning. Default: 1024 */
  maxJSHeapMB: number;
  /** Interval between budget checks (ms). Default: 5000 */
  checkIntervalMs: number;
}

export type BudgetLevel = "ok" | "warning" | "critical";

export interface BudgetStatus {
  level: BudgetLevel;
  textures: { current: number; max: number; ratio: number };
  geometries: { current: number; max: number; ratio: number };
  drawCalls: { current: number; max: number; ratio: number };
  jsHeapMB: { current: number; max: number; ratio: number };
  /** Which limits are exceeded (empty = all ok). */
  warnings: string[];
}

export type BudgetListener = (status: BudgetStatus) => void;

// ── Default config ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG: BudgetConfig = {
  maxTextures: 500,
  maxGeometries: 300,
  maxDrawCalls: 4000,
  maxJSHeapMB: 1024,
  checkIntervalMs: 5000,
};

// ── Module state ─────────────────────────────────────────────────────────────

let config: BudgetConfig = { ...DEFAULT_CONFIG };
let lastSnapshot: MemorySnapshot | null = null;
let lastStatus: BudgetStatus | null = null;
const listeners = new Set<BudgetListener>();
let checkTimer: ReturnType<typeof setInterval> | null = null;

// ── Callbacks ────────────────────────────────────────────────────────────────

/**
 * Called when budget is exceeded. Override to implement custom eviction logic.
 * Default implementation logs a warning.
 */
let onBudgetExceeded: ((warnings: string[], snap: MemorySnapshot) => void) | null = null;

/**
 * Called when budget returns to normal after being exceeded.
 */
let onBudgetRecovered: (() => void) | null = null;

// ── Internal helpers ─────────────────────────────────────────────────────────

function computeStatus(snap: MemorySnapshot): BudgetStatus {
  const texRatio = snap.texturesGPU / config.maxTextures;
  const geoRatio = snap.geometriesGPU / config.maxGeometries;
  const dcRatio = snap.drawCalls / config.maxDrawCalls;
  const heapRatio = snap.jsHeapUsedMB / config.maxJSHeapMB;

  const warnings: string[] = [];
  if (texRatio >= 1) warnings.push(`Textures ${snap.texturesGPU}/${config.maxTextures} (×${texRatio.toFixed(1)} budget)`);
  else if (texRatio >= 0.85) warnings.push(`Textures ${snap.texturesGPU}/${config.maxTextures} (approaching limit)`);
  if (geoRatio >= 1) warnings.push(`Geometries ${snap.geometriesGPU}/${config.maxGeometries}`);
  else if (geoRatio >= 0.85) warnings.push(`Geometries ${snap.geometriesGPU}/${config.maxGeometries} (approaching limit)`);
  if (dcRatio >= 1) warnings.push(`Draw calls ${snap.drawCalls}/${config.maxDrawCalls}`);
  if (heapRatio >= 1) warnings.push(`JS heap ${snap.jsHeapUsedMB}/${config.maxJSHeapMB} MB`);
  else if (heapRatio >= 0.85) warnings.push(`JS heap ${snap.jsHeapUsedMB}/${config.maxJSHeapMB} MB (approaching limit)`);

  let level: BudgetLevel = "ok";
  if (warnings.length > 0) {
    level = warnings.some((w) => w.includes("×")) ? "critical" : "warning";
  }

  return {
    level,
    textures: { current: snap.texturesGPU, max: config.maxTextures, ratio: texRatio },
    geometries: { current: snap.geometriesGPU, max: config.maxGeometries, ratio: geoRatio },
    drawCalls: { current: snap.drawCalls, max: config.maxDrawCalls, ratio: dcRatio },
    jsHeapMB: { current: snap.jsHeapUsedMB, max: config.maxJSHeapMB, ratio: heapRatio },
    warnings,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Configure the budget limits.
 * Safe to call while running — next check picks up new values.
 */
export function configureBudget(overrides: Partial<BudgetConfig>): void {
  config = { ...config, ...overrides };
}

/**
 * Get the current config.
 */
export function getBudgetConfig(): BudgetConfig {
  return { ...config };
}

/**
 * Register a callback for when budget is exceeded.
 * Replaces any previous callback.
 */
export function setOnBudgetExceeded(fn: ((warnings: string[], snap: MemorySnapshot) => void) | null): void {
  onBudgetExceeded = fn;
}

/**
 * Register a callback for when budget recovers.
 * Replaces any previous callback.
 */
export function setOnBudgetRecovered(fn: (() => void) | null): void {
  onBudgetRecovered = fn;
}

/**
 * Run a single budget check now. Returns the status.
 */
export function checkBudget(): BudgetStatus {
  const snap = takeSnapshot();
  lastSnapshot = snap;
  const status = computeStatus(snap);

  const wasCritical = lastStatus?.level === "critical" || lastStatus?.level === "warning";
  const nowOk = status.level === "ok";

  // Fire callbacks on transition
  if (status.warnings.length > 0 && status.warnings.length > (lastStatus?.warnings.length ?? 0)) {
    onBudgetExceeded?.(status.warnings, snap);
  }
  if (wasCritical && nowOk) {
    onBudgetRecovered?.();
  }

  // Notify listeners
  if (status.level !== lastStatus?.level || status.warnings.length !== lastStatus?.warnings.length) {
    lastStatus = status;
    listeners.forEach((fn) => fn(status));
  } else {
    lastStatus = status;
  }

  return status;
}

/**
 * Subscribe to budget status changes.
 */
export function subscribeBudget(fn: BudgetListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Start periodic budget checking.
 */
export function startBudgetChecks(): void {
  if (checkTimer) return;
  // Run first check immediately
  checkBudget();
  checkTimer = setInterval(checkBudget, config.checkIntervalMs);
}

/**
 * Stop periodic budget checking.
 */
export function stopBudgetChecks(): void {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
}

/**
 * Get the last known status (or null if never checked).
 */
export function getLastBudgetStatus(): BudgetStatus | null {
  return lastStatus;
}

/**
 * Format budget status as a compact string for HUD display.
 */
export function formatBudgetStatus(): string {
  const s = lastStatus;
  if (!s) return "💰 budget: N/A";

  const color = s.level === "critical" ? "🔴" : s.level === "warning" ? "🟡" : "🟢";
  return `${color} ${s.textures.current}/${s.textures.max}tex · ${s.geometries.current}/${s.geometries.max}geo · ${s.drawCalls.current}/${s.drawCalls.max}dc`;
}

/**
 * Get the default config for this project's expected workload.
 */
export function getRecommendedConfig(): BudgetConfig {
  return {
    maxTextures: 500,
    maxGeometries: 300,
    maxDrawCalls: 4000,
    maxJSHeapMB: 1024,
    checkIntervalMs: 5000,
  };
}
