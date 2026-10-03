// ══════════════════════════════════════════════════════════════════════════════
// loading/MonolithicMapCache.ts — Cache et chargeur de map GLB monolithique
//
// Charge un GLB géant (ex: 3 Go) avec progress streaming, parse GLTF+Draco,
// et conserve la scène parsée en mémoire. Au re-montage, la même référence
// THREE.Group est réutilisée (pas de clone, pas de re-parse).
//
// Flux :
//   1. Cache mémoire hit → retour immédiat (même référence)
//   2. Sinon : fetch ReadableStream → ArrayBuffer → GLTFLoader.parse → cache
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

// ── Cache mémoire (survit aux changements de map) ────────────────────────────
const sceneCache = new Map<string, THREE.Group>();

// ── Draco singleton (même path que main.tsx et AssetPreloader) ────────────────
let draco: DRACOLoader | null = null;
function getDraco(): DRACOLoader {
  if (!draco) {
    draco = new DRACOLoader();
    draco.setDecoderPath("/draco/");
  }
  return draco;
}

// Verrou anti-double-load (évite 2 fetches parallèles du même GLB)
const inflightLoads = new Map<string, Promise<THREE.Group>>();

// ── Types ────────────────────────────────────────────────────────────────────
export type LoadPhase = "cache-hit" | "fetching" | "parsing" | "ready";
export interface MonolithicProgress {
  phase: LoadPhase;
  ratio: number;
  bytesLoaded?: number;
  bytesTotal?: number;
}

// ── API publique ─────────────────────────────────────────────────────────────

export function getCachedScene(url: string): THREE.Group | undefined {
  return sceneCache.get(url);
}

export function evictCachedScene(url: string): void {
  const cached = sceneCache.get(url);
  if (cached) {
    cached.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m?.dispose();
      }
    });
    sceneCache.delete(url);
  }
}

export async function loadMonolithicMap(
  url: string,
  onProgress?: (p: MonolithicProgress) => void,
): Promise<THREE.Group> {
  // Tier 1 : cache mémoire
  const cached = sceneCache.get(url);
  if (cached) {
    onProgress?.({ phase: "cache-hit", ratio: 1 });
    return cached;
  }

  // Verrou anti-double-load
  const inflight = inflightLoads.get(url);
  if (inflight) return inflight;

  const loadPromise = doLoad(url, onProgress);
  inflightLoads.set(url, loadPromise);
  try {
    return await loadPromise;
  } finally {
    inflightLoads.delete(url);
  }
}

// ── Implémentation interne ───────────────────────────────────────────────────

async function doLoad(
  url: string,
  onProgress?: (p: MonolithicProgress) => void,
): Promise<THREE.Group> {
  onProgress?.({ phase: "fetching", ratio: 0 });
  const buffer = await fetchWithProgress(url, (loaded, total) => {
    onProgress?.({
      phase: "fetching",
      ratio: total > 0 ? loaded / total : 0,
      bytesLoaded: loaded,
      bytesTotal: total > 0 ? total : undefined,
    });
  });

  onProgress?.({ phase: "parsing", ratio: 0 });
  const scene = await parseGLB(buffer);
  fixWorldGridMaterials(scene);

  sceneCache.set(url, scene);
  onProgress?.({ phase: "ready", ratio: 1 });
  return scene;
}

async function fetchWithProgress(
  url: string,
  onProgress: (loaded: number, total: number) => void,
): Promise<ArrayBuffer> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`[MonolithicMap] HTTP ${resp.status} — ${url}`);

  const total = Number(resp.headers.get("content-length")) || 0;
  const reader = resp.body?.getReader();
  if (!reader) return resp.arrayBuffer();

  const chunks: Uint8Array[] = [];
  let loaded = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress(loaded, total);
  }

  const merged = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}

function parseGLB(buffer: ArrayBuffer): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  loader.setDRACOLoader(getDraco());
  return new Promise<THREE.Group>((resolve, reject) => {
    loader.parse(buffer, "", (gltf) => resolve(gltf.scene), reject);
  });
}

function fixWorldGridMaterials(scene: THREE.Group): void {
  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (let i = 0; i < mats.length; i++) {
      const mat = mats[i];
      if (mat?.name?.includes("WorldGridMaterial")) {
        const replacement = new THREE.MeshStandardMaterial({
          color: 0x606060,
          roughness: 0.85,
          metalness: 0.0,
          side: THREE.DoubleSide,
        });
        if (Array.isArray(obj.material)) {
          obj.material[i] = replacement;
        } else {
          obj.material = replacement;
        }
        mat.dispose();
      }
    }
  });
}
