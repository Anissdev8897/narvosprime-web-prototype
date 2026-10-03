// ══════════════════════════════════════════════════════════════════════════════
// memory/DisposeTracker.ts — Texture and Geometry lifecycle tracker
//
// Monitors dispose calls via patched prototypes. Designed for MEMOIRE P2.
//
// How it works:
//   1. Wraps THREE.Texture.prototype.dispose and THREE.BufferGeometry.prototype.dispose
//      to increment counters and track which instances have had dispose called.
//   2. Provides diagnostic info: how many created vs disposed.
//   3. `getLeakReport()` cross-references with renderer.info.memory for detection.
//
// Safety:
//   • restore() reverts ALL patches — safe for tests and HMR.
//   • Tracks via WeakSet internally to avoid preventing GC.
//   • All counters are monotonic.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DisposeInfo {
  texturesDisposed: number;
  geometriesDisposed: number;
  texturesCreated: number;
  geometriesCreated: number;
  activeTextures: number;
  activeGeometries: number;
}

// ── Module state ─────────────────────────────────────────────────────────────

let installed = false;

let texturesDisposed = 0;
let geometriesDisposed = 0;
let texturesCreated = 0;
let geometriesCreated = 0;

// Tracking sets — WeakSet so GC is not prevented
const trackedTextures = new WeakSet<THREE.Texture>();
const trackedGeometries = new WeakSet<THREE.BufferGeometry>();
const disposedTextures = new WeakSet<THREE.Texture>();
const disposedGeometries = new WeakSet<THREE.BufferGeometry>();

// Saved originals
let origTextureDispose: typeof THREE.Texture.prototype.dispose;
let origGeometryDispose: typeof THREE.BufferGeometry.prototype.dispose;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Install all hooks:
 *   • Wraps THREE.Texture.prototype.dispose
 *   • Wraps THREE.BufferGeometry.prototype.dispose
 *
 * Safe to call multiple times (idempotent).
 */
export function installDisposeTracker(): void {
  if (installed) return;
  installed = true;

  // ── Texture dispose ──
  origTextureDispose = THREE.Texture.prototype.dispose;
  THREE.Texture.prototype.dispose = function () {
    // Track even if created before install
    if (!trackedTextures.has(this)) {
      trackedTextures.add(this);
      texturesCreated++;
    }
    if (!disposedTextures.has(this)) {
      disposedTextures.add(this);
      texturesDisposed++;
    }
    origTextureDispose.apply(this, arguments as unknown as []); // eslint-disable-line prefer-rest-params
  };

  // ── Geometry dispose ──
  origGeometryDispose = THREE.BufferGeometry.prototype.dispose;
  THREE.BufferGeometry.prototype.dispose = function () {
    if (!trackedGeometries.has(this)) {
      trackedGeometries.add(this);
      geometriesCreated++;
    }
    if (!disposedGeometries.has(this)) {
      disposedGeometries.add(this);
      geometriesDisposed++;
    }
    origGeometryDispose.apply(this, arguments as unknown as []); // eslint-disable-line prefer-rest-params
  };
}

/**
 * Remove all patches and restore originals.
 */
export function uninstallDisposeTracker(): void {
  if (!installed) return;
  installed = false;

  if (origTextureDispose) {
    THREE.Texture.prototype.dispose = origTextureDispose;
  }
  if (origGeometryDispose) {
    THREE.BufferGeometry.prototype.dispose = origGeometryDispose;
  }
}

/**
 * Check if the tracker hooks are active.
 */
export function isInstalled(): boolean {
  return installed;
}

/**
 * Manually register a texture for tracking (if created before install).
 */
export function trackTexture(tex: THREE.Texture): void {
  if (!trackedTextures.has(tex)) {
    trackedTextures.add(tex);
    texturesCreated++;
  }
}

/**
 * Manually register a geometry for tracking (if created before install).
 */
export function trackGeometry(geo: THREE.BufferGeometry): void {
  if (!trackedGeometries.has(geo)) {
    trackedGeometries.add(geo);
    geometriesCreated++;
  }
}

/**
 * Get current dispose/count info.
 */
export function getDisposeInfo(): DisposeInfo {
  return {
    texturesDisposed,
    geometriesDisposed,
    texturesCreated,
    geometriesCreated,
    activeTextures: texturesCreated - texturesDisposed,
    activeGeometries: geometriesCreated - geometriesDisposed,
  };
}

/**
 * Reset ALL counters (does NOT affect installed state).
 */
export function resetCounters(): void {
  texturesDisposed = 0;
  geometriesDisposed = 0;
  texturesCreated = 0;
  geometriesCreated = 0;
}

/**
 * Generate a leak analysis report by comparing our counters
 * with the renderer's actual GPU info.
 */
export function getLeakReport(glInfo?: { textures: number; geometries: number }): string {
  const info = getDisposeInfo();
  const lines: string[] = [];

  lines.push("═══ DisposeTracker Leak Report ═══");
  lines.push(`  Textures tracked : ${info.texturesCreated}`);
  lines.push(`  Textures disposed: ${info.texturesDisposed}`);
  lines.push(`  Active tracked   : ${info.activeTextures}`);
  lines.push(`  Geometries tracked : ${info.geometriesCreated}`);
  lines.push(`  Geometries disposed: ${info.geometriesDisposed}`);
  lines.push(`  Active tracked     : ${info.activeGeometries}`);

  if (glInfo) {
    lines.push(`  GPU textures   : ${glInfo.textures}`);
    lines.push(`  GPU geometries : ${glInfo.geometries}`);
    if (glInfo.textures > info.texturesCreated) {
      lines.push(`  ⚠ ${glInfo.textures - info.texturesCreated} textures pre-date tracker install`);
    }
  }

  return lines.join("\n");
}

/**
 * Format dispose info as a compact string for HUD display.
 */
export function formatDisposeInfo(): string {
  const i = getDisposeInfo();
  return `📦 ${i.texturesCreated}tex(+${i.texturesDisposed}d) ${i.geometriesCreated}geo(+${i.geometriesDisposed}d)`;
}
