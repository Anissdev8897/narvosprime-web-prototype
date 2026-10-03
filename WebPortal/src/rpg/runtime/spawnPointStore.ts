// runtime/spawnPointStore.ts — POINT DE SPAWN joueur PAR MAP (éditable, persisté).
//
// Override du MAP_SPAWN statique : l'admin place/déplace le point d'apparition via un
// gizmo (SpawnPointGizmo). Utilisé à l'entrée sur une map, au voyage et au respawn.
// Persisté (localStorage + base monde) comme les autres stores éditables.
import { useSyncExternalStore } from "react";
import { loadWorldDb, saveWorldDb } from "../persistence/dbStore";

const STORAGE_KEY = "narvos:spawn_points:v1";
const DB_KEY = "spawn_points";

type Pos = [number, number, number];

function loadInitial(): Record<string, Pos> {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
let state: Record<string, Pos> = loadInitial();
let version = 0;
const listeners = new Set<() => void>();
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
  saveWorldDb(DB_KEY, state);
}
function notify() { version++; for (const l of listeners) l(); }

export const spawnPointStore = {
  /** Point custom pour cette map, ou null si non défini (→ repli MAP_SPAWN). */
  get(mapId: string): Pos | null { return state[mapId] ?? null; },
  set(mapId: string, pos: Pos): void { state = { ...state, [mapId]: pos }; persist(); notify(); },
  clear(mapId: string): void { if (state[mapId]) { const n = { ...state }; delete n[mapId]; state = n; persist(); notify(); } },
  subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; },
  getVersion: () => version,
  async hydrate(): Promise<void> {
    const db = await loadWorldDb<Record<string, Pos>>(DB_KEY);
    if (db && typeof db === "object") { state = db; notify(); }
  },
};

export function useSpawnVersion(): number {
  return useSyncExternalStore(spawnPointStore.subscribe, spawnPointStore.getVersion, spawnPointStore.getVersion);
}
