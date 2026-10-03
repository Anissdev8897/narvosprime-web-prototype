// ══════════════════════════════════════════════════════════════════════════════
// runtime/streamingDiagnostics.ts — télémétrie du streaming de chunks.
//
// Singleton hors-React (pattern projet). StreamingPuzzleMap y écrit l'état de
// chaque chunk (timings, textures, erreurs) ; StreamingDebugHud (F10) le lit.
// Pont React via useSyncExternalStore.
// ══════════════════════════════════════════════════════════════════════════════
import { useSyncExternalStore } from "react";
import type * as THREE from "three";

export type ChunkStatus = "pending" | "loading" | "loaded" | "failed" | "unloaded";

export interface ChunkDiag {
  id: number;
  file: string;
  status: ChunkStatus;
  /** Durée du dernier chargement (fetch+parse+upload GPU), ms. */
  loadMs: number;
  /** Taille fichier estimée (metadata), MB. */
  sizeMB: number;
  /** Nombre de textures uploadées GPU pour ce chunk. */
  textures: number;
  /** VRAM estimée des textures du chunk (w×h×4×1.33 mipmaps), MB. */
  textureVramMB: number;
  /** Dernière erreur de chargement (message court). */
  error: string | null;
  essential: boolean;
  /**
   * Le chunk passe-t-il le test de frustum CETTE frame ?
   *
   * Distinguer « résident » de « visible » est ce qui permet de trancher entre
   * « il manque de la géométrie » et « elle est là mais le culling la masque ».
   * Sans cette colonne, les deux se ressemblent exactement à l'écran.
   */
  inFrustum: boolean;
}

interface DiagState {
  chunks: Map<number, ChunkDiag>;
  version: number;
}

const state: DiagState = { chunks: new Map(), version: 0 };
const listeners = new Set<() => void>();
let renderer: THREE.WebGLRenderer | null = null;

/**
 * Culling par chunk désactivé — tout est rendu, quoi qu'en dise le frustum.
 *
 * Bascule de DIAGNOSTIC. « Il manque des morceaux de map » a exactement la même
 * apparence que « le culling masque un chunk encore visible ». Couper le culling
 * sépare les deux en une touche : si les trous disparaissent, c'est le culling ;
 * s'ils restent, c'est la géométrie, et on cherche ailleurs.
 */
let cullingDisabled = false;

function emit(): void {
  state.version++;
  listeners.forEach((l) => l());
}

export const streamingDiagnostics = {
  /** Le culling par chunk est-il coupé (mode diagnostic) ? */
  isCullingDisabled(): boolean { return cullingDisabled; },

  /** Coupe/rétablit le culling par chunk. Retourne le nouvel état. */
  toggleCulling(): boolean {
    cullingDisabled = !cullingDisabled;
    emit();
    return cullingDisabled;
  },

  /** Enregistre le résultat du test de frustum d'un chunk pour cette frame. */
  setInFrustum(id: number, v: boolean): void {
    const c = state.chunks.get(id);
    if (!c || c.inFrustum === v) return;   // n'émet que sur CHANGEMENT
    c.inFrustum = v;
    emit();
  },

  /** Réinitialise avec la liste des chunks de la map courante. */
  reset(entries: { id: number; file: string; estimatedMB: number }[]): void {
    state.chunks = new Map(
      entries.map((e) => [e.id, {
        id: e.id, file: e.file, status: "pending" as ChunkStatus,
        loadMs: 0, sizeMB: e.estimatedMB, textures: 0, textureVramMB: 0,
        error: null, essential: false, inFrustum: true,
      }]),
    );
    emit();
  },

  markEssential(ids: number[]): void {
    for (const id of ids) {
      const c = state.chunks.get(id);
      if (c) c.essential = true;
    }
    emit();
  },

  setStatus(id: number, status: ChunkStatus, extra?: Partial<ChunkDiag>): void {
    const c = state.chunks.get(id);
    if (!c) return;
    Object.assign(c, extra, { status });
    emit();
  },

  setRenderer(gl: THREE.WebGLRenderer): void { renderer = gl; },
  getRenderer(): THREE.WebGLRenderer | null { return renderer; },

  get(): ReadonlyMap<number, ChunkDiag> { return state.chunks; },
  getVersion(): number { return state.version; },

  counts(): { loaded: number; loading: number; failed: number; pending: number; total: number; texturesLoaded: number; textureVramMB: number } {
    let loaded = 0, loading = 0, failed = 0, pending = 0, texturesLoaded = 0, textureVramMB = 0;
    for (const c of state.chunks.values()) {
      if (c.status === "loaded") { loaded++; texturesLoaded += c.textures; textureVramMB += c.textureVramMB; }
      else if (c.status === "loading") loading++;
      else if (c.status === "failed") failed++;
      else pending++;
    }
    return { loaded, loading, failed, pending, total: state.chunks.size, texturesLoaded, textureVramMB };
  },

  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** Hook React — re-render à chaque mise à jour de la télémétrie. */
export function useStreamingDiagnostics(): number {
  return useSyncExternalStore(
    streamingDiagnostics.subscribe,
    streamingDiagnostics.getVersion,
    () => 0,
  );
}
