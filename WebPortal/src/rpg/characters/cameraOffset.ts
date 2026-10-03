// ══════════════════════════════════════════════════════════════════════════════
// characters/cameraOffset.ts — Offset MULTIPLICATIF de la caméra TPS (admin)
//
// Multiplicateur appliqué au-DESSUS du characterScale pour la distance et la
// hauteur de la caméra TPS. Permet d'ajuster le cadrage sans modifier la
// taille du perso (ex : perso à 0.5 mais caméra plus loin = cadrage normal).
//
// Distance finale TPS = baseDistance × characterScale × cameraOffset
//   bornée par tpsDistanceMin/Max (1.5..12) côté playerConfig.
//
// Persisté dans localStorage. Réactif via useSyncExternalStore (cf.
// useCameraOffset).
// ══════════════════════════════════════════════════════════════════════════════

export const CAMERA_OFFSET_MIN     = 0.5;   // caméra plus proche (×0.5)
export const CAMERA_OFFSET_MAX     = 2.5;   // caméra très loin (×2.5)
export const CAMERA_OFFSET_DEFAULT = 1.0;   // valeur neutre (suit le perso seul)
export const CAMERA_OFFSET_STEP    = 0.05;

import { loadUserDb, saveUserDb } from "../persistence/dbStore";

const STORAGE_KEY = "narvos:cameraOffset";
const DB_KEY = "cameraOffset";

function clamp(v: number): number {
  if (!Number.isFinite(v)) return CAMERA_OFFSET_DEFAULT;
  return Math.max(CAMERA_OFFSET_MIN, Math.min(CAMERA_OFFSET_MAX, v));
}

function loadInitial(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return CAMERA_OFFSET_DEFAULT;
    return clamp(Number.parseFloat(raw));
  } catch {
    return CAMERA_OFFSET_DEFAULT;
  }
}

let current = loadInitial();
const listeners = new Set<() => void>();

function persist(v: number): void {
  try { localStorage.setItem(STORAGE_KEY, String(v)); }
  catch { /* quota / private mode */ }
  saveUserDb(DB_KEY, v); // → base (par utilisateur, no-op hors Electron)
}

/** Hydrate l'offset caméra depuis la base. */
export async function hydrateOffsetFromDb(): Promise<void> {
  const v = await loadUserDb<number>(DB_KEY);
  if (typeof v === "number" && Number.isFinite(v)) cameraOffsetStore.set(v);
}

export const cameraOffsetStore = {
  get(): number {
    return current;
  },
  set(v: number): void {
    const next = clamp(v);
    if (next === current) return;
    current = next;
    persist(next);
    for (const fn of listeners) fn();
  },
  reset(): void {
    this.set(CAMERA_OFFSET_DEFAULT);
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};
