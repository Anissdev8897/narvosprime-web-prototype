// professions/harvestNodeStore.ts — nœuds de récolte plaçables, persistés PAR MAP.
//
// Même patron que portalStore / npcPlacementStore : DATA persistée indexée par mapId,
// CRUD + abonnement. Au tout premier chargement (aucune sauvegarde), on amorce avec
// le seed HARVEST_NODES (arbres de test) ; ensuite l'éditeur F11 fait foi.
import type { ProfessionId } from "./professionTypes";
import { HARVEST_NODES } from "./harvestNodes";
import { loadWorldDb, saveWorldDb } from "../persistence/dbStore";

const STORAGE_KEY = "narvos:harvestnodes:v1";
const DB_KEY = "harvestnodes";

export interface PlacedHarvestNode {
  id: string;
  pos: [number, number, number];
  profession: ProfessionId;          // bucheron | mineur | recolteur
  rot?: [number, number, number];    // rotation euler (radians), défaut [0,0,0]
  /** true = posé par le GÉNÉRATEUR de cartes (supprimable en bloc). */
  gen?: boolean;
}
export type PlacedHarvestNodeCfg = Omit<PlacedHarvestNode, "id">;

function seedFromDefaults(): Record<string, PlacedHarvestNode[]> {
  const seeded: Record<string, PlacedHarvestNode[]> = {};
  for (const [mapId, nodes] of Object.entries(HARVEST_NODES)) {
    seeded[mapId] = nodes.map((n) => ({ id: n.id, pos: n.pos, profession: n.profession }));
  }
  return seeded;
}

function loadInitial(): Record<string, PlacedHarvestNode[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* JSON / quota */ }
  return seedFromDefaults();
}

let state = loadInitial();
let version = 0;
const listeners = new Set<() => void>();
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
  saveWorldDb(DB_KEY, state); // → base (débouncé, no-op hors Electron)
}
function notify() { version++; for (const fn of listeners) fn(); }
function makeId(): string { return "node_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

export const harvestNodeStore = {
  list(mapId: string): PlacedHarvestNode[] { return state[mapId] ?? []; },
  add(mapId: string, cfg: PlacedHarvestNodeCfg): void {
    const arr = state[mapId] ?? (state[mapId] = []);
    arr.push({ id: makeId(), ...cfg });
    persist(); notify();
  },
  update(mapId: string, id: string, patch: Partial<PlacedHarvestNode>): void {
    const arr = state[mapId]; if (!arr) return;
    const i = arr.findIndex((n) => n.id === id); if (i < 0) return;
    arr[i] = { ...arr[i], ...patch };
    persist(); notify();
  },
  remove(mapId: string, id: string): void {
    const arr = state[mapId]; if (!arr) return;
    state[mapId] = arr.filter((n) => n.id !== id);
    persist(); notify();
  },
  clear(mapId: string): void { if (state[mapId]) { state[mapId] = []; persist(); notify(); } },
  /** Supprime UNIQUEMENT les nœuds posés par le générateur (gen=true). */
  removeGenerated(mapId: string): number {
    const arr = state[mapId]; if (!arr) return 0;
    const kept = arr.filter((n) => !n.gen);
    const removed = arr.length - kept.length;
    if (removed > 0) { state[mapId] = kept; persist(); notify(); }
    return removed;
  },
  subscribe(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getVersion(): number { return version; },
  /** Charge les nœuds depuis la base (source de vérité en Electron). À appeler une fois au boot. */
  async hydrate(): Promise<void> {
    const db = await loadWorldDb<Record<string, PlacedHarvestNode[]>>(DB_KEY);
    if (db && typeof db === "object") { state = db; notify(); }
  },
};
