// animation/animClipStore.ts — registre des clips dispo PAR AVATAR + override d'anim.
//
// • registerClips : chaque perso enregistre la liste des noms de clips qu'il a chargés
//   (idle/marche/attaque/sort/… + clips de pack) → l'éditeur peut les LISTER.
// • override : (avatar × action) → nom de clip choisi → l'AnimationController joue CE clip
//   pour cette action (au lieu de la résolution par défaut). Persisté + hydraté.
import { useSyncExternalStore } from "react";
import { loadWorldDb, saveWorldDb } from "../persistence/dbStore";

const STORAGE_KEY = "narvos:animoverride:v2";
const DB_KEY = "anim_override_v2";
// état "base" (arme rangée) vs "drawn" (dégainée) → clips/override distincts.
const ckey = (avatar: string, mode: string) => `${avatar}::${mode}`;
const okey = (avatar: string, mode: string, action: string) => `${avatar}::${mode}::${action}`;

let clipsByAvatar: Record<string, string[]> = {};      // non persisté (runtime)
let overrides: Record<string, string> = loadInitial(); // persisté
let version = 0;          // bump sur TOUT (panneau)
let overrideVersion = 0;  // bump UNIQUEMENT sur setOverride (rebuild contrôleur ciblé)
const listeners = new Set<() => void>();

function loadInitial(): Record<string, string> {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides)); } catch { /* quota */ }
  saveWorldDb(DB_KEY, overrides);
}
function notify() { version++; for (const fn of listeners) fn(); }

export const animClipStore = {
  /** Enregistre les noms de clips d'un (avatar × état) — idempotent (notifie si change). */
  registerClips(avatar: string, mode: string, names: string[]): void {
    if (!avatar) return;
    const k = ckey(avatar, mode);
    const prev = clipsByAvatar[k];
    const uniq = Array.from(new Set(names)).sort();
    if (prev && prev.length === uniq.length && prev.every((n, i) => n === uniq[i])) return;
    clipsByAvatar = { ...clipsByAvatar, [k]: uniq };
    notify();
  },
  listClips(avatar: string | undefined, mode: string): string[] {
    return (avatar && clipsByAvatar[ckey(avatar, mode)]) || [];
  },

  getOverride(avatar: string | undefined, mode: string, action: string): string | undefined {
    return avatar ? overrides[okey(avatar, mode, action)] : undefined;
  },
  setOverride(avatar: string, mode: string, action: string, clipName: string | null): void {
    const k = okey(avatar, mode, action);
    if (clipName) overrides = { ...overrides, [k]: clipName };
    else { const n = { ...overrides }; delete n[k]; overrides = n; }
    overrideVersion++; persist(); notify();
  },

  subscribe(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getVersion(): number { return version; },
  /** Version qui ne bouge QUE sur setOverride → dep ciblée pour rebuild du contrôleur. */
  getOverrideVersion(): number { return overrideVersion; },
  async hydrate(): Promise<void> {
    const db = await loadWorldDb<Record<string, string>>(DB_KEY);
    if (db && typeof db === "object") { overrides = db; notify(); }
  },
};

/** Hook PANNEAU : re-render à TOUT changement (clips enregistrés OU override). */
export function useAnimClips(): number {
  useSyncExternalStore(animClipStore.subscribe, animClipStore.getVersion, animClipStore.getVersion);
  return animClipStore.getVersion();
}

/** Hook PERSO : re-render UNIQUEMENT quand un override change (pas à l'enregistrement
 *  des clips) → évite des rebuilds inutiles du contrôleur d'animation (anti-freeze). */
export function useAnimOverrideVersion(): number {
  useSyncExternalStore(animClipStore.subscribe, animClipStore.getOverrideVersion, animClipStore.getOverrideVersion);
  return animClipStore.getOverrideVersion();
}
