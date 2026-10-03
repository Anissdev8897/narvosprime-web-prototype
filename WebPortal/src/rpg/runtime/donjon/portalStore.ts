// runtime/donjon/portalStore.ts — portails de donjon persistés PAR MAP (source de vérité)
// Même patron que npcPlacementStore : DATA persistée, indexée par mapId.
import { loadWorldDb, saveWorldDb } from "../../persistence/dbStore";
const STORAGE_KEY = "narvos:portals:v1";
const DB_KEY = "portals";

export type LockMode = "active" | "completed";

export interface PlacedPortal {
  id: string;
  pos: [number, number, number];
  /** mapId de l'instance à charger (ex: "donjon_furiste"). */
  target: string;
  /** id de quête qui déverrouille l'accès. "" = aucune (verrouillé sauf override admin). */
  unlockQuest: string;
  /** "active" = quête acceptée suffit · "completed" = quête terminée requise. */
  lockMode: LockMode;
  label: string;
  /** rotation euler (radians) du portail. Optionnel (défaut [0,0,0]). */
  rot?: [number, number, number];
}
export type PlacedPortalCfg = Omit<PlacedPortal, "id">;

function loadInitial(): Record<string, PlacedPortal[]> {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : {}; }
  catch { return {}; }
}
let state = loadInitial();
let version = 0;
const listeners = new Set<() => void>();
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
  saveWorldDb(DB_KEY, state); // → base (débouncé, no-op hors Electron)
}
function notify() { version++; for (const fn of listeners) fn(); }
function makeId(): string { return "portal_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

export const portalStore = {
  list(mapId: string): PlacedPortal[] { return state[mapId] ?? []; },
  add(mapId: string, cfg: PlacedPortalCfg): void {
    const arr = state[mapId] ?? (state[mapId] = []);
    arr.push({ id: makeId(), ...cfg });
    persist(); notify();
  },
  update(mapId: string, id: string, patch: Partial<PlacedPortal>): void {
    const arr = state[mapId]; if (!arr) return;
    const i = arr.findIndex((p) => p.id === id); if (i < 0) return;
    arr[i] = { ...arr[i], ...patch };
    persist(); notify();
  },
  remove(mapId: string, id: string): void {
    const arr = state[mapId]; if (!arr) return;
    state[mapId] = arr.filter((p) => p.id !== id);
    persist(); notify();
  },
  clear(mapId: string): void { if (state[mapId]) { delete state[mapId]; persist(); notify(); } },
  subscribe(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getVersion(): number { return version; },
  /** Charge les portails depuis la base (source de vérité en Electron). À appeler une fois au boot. */
  async hydrate(): Promise<void> {
    const db = await loadWorldDb<Record<string, PlacedPortal[]>>(DB_KEY);
    if (db && typeof db === "object") { state = db; notify(); }
  },
};
