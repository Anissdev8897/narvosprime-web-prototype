// ══════════════════════════════════════════════════════════════════════════════
// characters/characterScale.ts — Échelle GLOBALE des personnages (store mutable)
//
// Source de vérité UNIQUE pour la taille des personnages (joueur + PNJ).
// Persistée dans localStorage, modifiable en jeu via l'AdminPanel (touche F12).
//
// API en deux niveaux :
//
//   1) **CHARACTER_SCALE_AT_BOOT** — snapshot pris à l'import du module.
//      Utilisée par les fichiers HORS React qui figent leur valeur au boot
//      (ex: playerConfig.ts pour la capsule de collision + caméra FPS).
//      Modifier le scale en jeu ne réévalue PAS ces fichiers → un reload est
//      requis pour appliquer collision/caméra au nouveau scale.
//
//   2) **characterScaleStore** — store réactif avec get/set/subscribe.
//      Utilisé par les composants React (HumanCharacter, Npc) via le hook
//      `useCharacterScale()` → le MESH visuel réagit instantanément au slider,
//      sans reload.
//
// Trade-off conscient (validé avec l'utilisateur) : mesh live ; collision/caméra
// au reload. Cohérent avec l'objectif d'expérimentation rapide sans risquer
// de désynchroniser le collider de la capsule au runtime.
//
// 1.0 = taille native modèle Mixamo (~1.8 m, géant pour la map tower)
// 0.7 = défaut équilibré pour les maps Quaternius (~1.26 m)
// 0.5 = perso très petit, style "tower defense" (~0.9 m)
// ══════════════════════════════════════════════════════════════════════════════

// ── Bornes du slider ──────────────────────────────────────────────────────────
// La caméra TPS est bornée séparément (cf. playerConfig.tpsDistanceDefault)
// pour préserver le cadrage même aux échelles extrêmes.
export const CHARACTER_SCALE_MIN     = 0.2;   // miniature (~36 cm) — utile pour
                                              // explorer des décors qui paraissent
                                              // sur-dimensionnés (Tower, station)
export const CHARACTER_SCALE_MAX     = 1.0;   // taille native Mixamo (~1.8 m)
export const CHARACTER_SCALE_DEFAULT = 0.7;   // équilibré (~1.26 m)
export const CHARACTER_SCALE_STEP    = 0.05;  // 16 paliers entre 0.2 et 1.0

import { loadUserDb, saveUserDb } from "../persistence/dbStore";

const STORAGE_KEY = "narvos:characterScale";
const DB_KEY = "characterScale";

/** Clamp à la plage sûre — protège du localStorage corrompu. */
function clamp(v: number): number {
  if (!Number.isFinite(v)) return CHARACTER_SCALE_DEFAULT;
  return Math.max(CHARACTER_SCALE_MIN, Math.min(CHARACTER_SCALE_MAX, v));
}

/** Lit la valeur initiale depuis localStorage, fallback sur le défaut. */
function loadInitial(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return CHARACTER_SCALE_DEFAULT;
    return clamp(Number.parseFloat(raw));
  } catch {
    return CHARACTER_SCALE_DEFAULT;
  }
}

let currentScale = loadInitial();
const listeners = new Set<() => void>();

function persist(v: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(v));
  } catch { /* quota / private mode */ }
  saveUserDb(DB_KEY, v); // → base (par utilisateur, no-op hors Electron)
}

/** Hydrate l'échelle depuis la base (met à jour le store réactif → mesh live). */
export async function hydrateScaleFromDb(): Promise<void> {
  const v = await loadUserDb<number>(DB_KEY);
  if (typeof v === "number" && Number.isFinite(v)) characterScaleStore.set(v);
}

/**
 * Store mutable réactif. `subscribe` retourne un unsubscriber.
 * Compatible avec React useSyncExternalStore.
 */
export const characterScaleStore = {
  get(): number {
    return currentScale;
  },
  /** Met à jour la valeur, persiste, notifie tous les abonnés. */
  set(v: number): void {
    const next = clamp(v);
    if (next === currentScale) return;
    currentScale = next;
    persist(next);
    for (const fn of listeners) fn();
  },
  /** Remet la valeur par défaut. */
  reset(): void {
    this.set(CHARACTER_SCALE_DEFAULT);
  },
  /** Abonnement (retourne une fonction d'unsubscribe). */
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
};

/**
 * Snapshot pris au boot — figé pour les modules HORS React (playerConfig).
 * NE CHANGE PAS pendant la session, même si le slider modifie le store.
 * Pour appliquer un nouveau scale à la collision/caméra : reload.
 */
export const CHARACTER_SCALE_AT_BOOT = currentScale;

/**
 * Alias rétrocompatibilité : les imports `CHARACTER_SCALE` existants
 * continuent de marcher (figés au boot, comme avant le store).
 */
export const CHARACTER_SCALE = CHARACTER_SCALE_AT_BOOT;
