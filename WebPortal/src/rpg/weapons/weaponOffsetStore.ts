// weapons/weaponOffsetStore.ts — overrides d'offset d'arme RÉGLABLES (par arme).
//
// Les offsets « usine » vivent dans weaponProfiles.json. Pour les armes FBX, l'échelle
// (cm/m) et l'orientation en main demandent un réglage VISUEL. Ce store permet de
// surcharger position/rotation/échelle en live (admin), persisté (monde) → fini le
// "float". Le WeaponSocket fusionne ces overrides par-dessus le profil.
import { useSyncExternalStore } from "react";
import { loadWorldDb, saveWorldDb } from "../persistence/dbStore";

export interface WeaponOffsetOverride {
  position?: [number, number, number];
  rotation?: [number, number, number]; // Euler XYZ radians
  scale?: number;
}

const STORAGE_KEY = "narvos:weaponoffsets:v1";
const DB_KEY = "weapon_offsets";

function loadInitial(): Record<string, WeaponOffsetOverride> {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
let state = loadInitial();
let version = 0;
const listeners = new Set<() => void>();
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
  saveWorldDb(DB_KEY, state); // → base (monde, débouncé, no-op hors Electron)
}
function notify() { version++; for (const fn of listeners) fn(); }

export const weaponOffsetStore = {
  get(id: string): WeaponOffsetOverride | undefined { return state[id]; },
  set(id: string, patch: WeaponOffsetOverride): void {
    state = { ...state, [id]: { ...state[id], ...patch } };
    persist(); notify();
  },
  reset(id: string): void {
    if (state[id]) { const n = { ...state }; delete n[id]; state = n; persist(); notify(); }
  },
  all(): Record<string, WeaponOffsetOverride> { return state; },
  subscribe(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getVersion(): number { return version; },
  /** Charge les overrides depuis la base (À appeler une fois au boot). */
  async hydrate(): Promise<void> {
    const db = await loadWorldDb<Record<string, WeaponOffsetOverride>>(DB_KEY);
    if (db && typeof db === "object") { state = db; notify(); }
  },
};

/** Hook : version du store (déclenche un re-render à chaque réglage). */
export function useWeaponOffsets(): number {
  useSyncExternalStore(weaponOffsetStore.subscribe, weaponOffsetStore.getVersion, weaponOffsetStore.getVersion);
  return weaponOffsetStore.getVersion();
}
