/**
 * chunkFallback.ts — Dégradation gracieuse pour le chargement de chunks / assets 3D.
 *
 * Fournit des wrappers pour que l'échec d'un chargement de chunk n'emporte pas
 * toute la map. Le chunk manquant est remplacé par un objet vide (ou un fallback
 * minimal), et l'erreur est rapportée au crash reporter.
 *
 * Usage :
 *   const scene = await withChunkFallback(() => loader.loadAsync(url), url);
 *   // scene = le groupe 3D chargé, OU un groupe vide si le chargement échoue.
 *
 *   const safeUrl = chunkSafeUrl('/models/Maps/forge_map/chunk_01.glb');
 *   // safeUrl = l'url originale si elle existe, ou un fallback transparent.
 */

import { captureError } from './crashReporter';
import * as THREE from 'three';

// ── Wrapper avec timeout pour tout loader de chunk ─────────────────────────

export interface ChunkFallbackOptions {
  /** Timeout en ms (défaut: 60s, comme CHUNK_TIMEOUT_MS dans StreamingPuzzleMap). */
  timeoutMs: number;
  /** Tag descriptif pour le crash reporter. */
  label: string;
}

const DEFAULT_OPTIONS: ChunkFallbackOptions = {
  timeoutMs: 60_000,
  label: 'chunk',
};

/**
 * Wrapper qui exécute un loader de chunk avec timeout + fallback.
 * En cas d'échec, retourne un THREE.Group vide (jamais de throw).
 * L'erreur est loggée dans le crash reporter.
 */
export async function withChunkFallback<T extends THREE.Object3D>(
  loader: () => Promise<T>,
  urlOrId: string,
  options?: Partial<ChunkFallbackOptions>,
): Promise<T | THREE.Group> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const label = `${opts.label} [${urlOrId}]`;

  try {
    const result = await withTimeout(loader(), opts.timeoutMs, label);
    return result;
  } catch (err) {
    console.warn(`[ChunkFallback] ${label} — échec, fallback vers groupe vide`, err);
    captureError(err, {
      handler: 'chunkFallback',
      url: urlOrId,
      label: opts.label,
    });
    // Retourne un groupe vide — la map continue sans ce chunk
    return new THREE.Group();
  }
}

/**
 * Version spécialisée pour les loaders GLTF : retourne { scene: THREE.Group }
 * qui peut être NULL en cas d'échec (au lieu de throw).
 */
export async function loadGltfSafe(
  loadFn: () => Promise<{ scene: THREE.Group }>,
  url: string,
): Promise<{ scene: THREE.Group } | null> {
  try {
    const result = await loadFn();
    return result;
  } catch (err) {
    console.warn(`[loadGltfSafe] Échec de chargement GLB: ${url}`, err);
    captureError(err, { handler: 'loadGltfSafe', url });
    return null;
  }
}

// ── Timeout helper ─────────────────────────────────────────────────────────

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timeout après ${ms}ms`)), ms);
    }),
  ]);
}

// ── URL alternative (fallback qualité) ─────────────────────────────────────

/**
 * Vérifie l'existence d'un asset via HEAD et retourne un fallback si absent.
 * Utile pour les assets optionnels (environnements HDR, skyboxes…).
 */
export async function assetExistsWithFallback(
  primary: string,
  fallback: string,
): Promise<string> {
  if (typeof fetch === 'undefined') return primary;
  try {
    const resp = await fetch(primary, { method: 'HEAD' });
    if (resp.ok) return primary;
  } catch { /* réseau absent → fallback */ }
  return fallback;
}
