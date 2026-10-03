// camera/recoilProfileStore.ts — overrides RÉGLABLES des profils de recul caméra.
//
// Les profils « usine » vivent dans recoilProfiles.ts (RECOIL_PROFILES). Le ressenti
// du recul (intensité, durée, courbe, trauma) se règle au feeling → ce store permet
// de surcharger chaque profil en live (admin), persisté (monde) + localStorage.
// Le dispatcher lit get(id) → override si présent, sinon profil usine.
import { useSyncExternalStore } from "react";
import { loadWorldDb, saveWorldDb } from "../persistence/dbStore";
import { RECOIL_PROFILES, getRecoilProfile, type CameraRecoilProfile } from "./recoilProfiles";

const STORAGE_KEY = "narvos:recoil:v1";
const DB_KEY = "recoil_profiles";

function loadInitial(): Record<string, CameraRecoilProfile> {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
let state = loadInitial();
let version = 0;
const listeners = new Set<() => void>();
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
  saveWorldDb(DB_KEY, state);
}
function notify() { version++; for (const fn of listeners) fn(); }

export const recoilProfileStore = {
  /** Profil EFFECTIF (override réglé, sinon profil usine). undefined si id inconnu. */
  get(id: string): CameraRecoilProfile | undefined {
    return state[id] ?? getRecoilProfile(id);
  },
  /** true si l'id a un override (≠ usine). */
  isOverridden(id: string): boolean { return !!state[id]; },
  set(id: string, profile: CameraRecoilProfile): void {
    state = { ...state, [id]: profile };
    persist(); notify();
  },
  reset(id: string): void {
    if (state[id]) { const n = { ...state }; delete n[id]; state = n; persist(); notify(); }
  },
  /** Tous les ids de profils connus (usine ∪ overrides). */
  ids(): string[] {
    return [...new Set([...Object.keys(RECOIL_PROFILES), ...Object.keys(state)])];
  },
  subscribe(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getVersion(): number { return version; },
  async hydrate(): Promise<void> {
    const db = await loadWorldDb<Record<string, CameraRecoilProfile>>(DB_KEY);
    if (db && typeof db === "object") { state = db; notify(); }
  },
};

/** Hook : version du store (re-render à chaque réglage). */
export function useRecoilProfiles(): number {
  useSyncExternalStore(recoilProfileStore.subscribe, recoilProfileStore.getVersion, recoilProfileStore.getVersion);
  return recoilProfileStore.getVersion();
}
