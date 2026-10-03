// world/customMapStore.ts — MAPS CUSTOM créées via le mode FORGE MAP (persistées).
//
// Une map custom = un id + un label + soit un GLB unique, soit un dossier de chunks
// (pipeline Blender du README de public/models/Maps). À l'hydratation, chaque map est
// ENREGISTRÉE dans le manifest runtime (registerRuntimeMap) → le moteur entier la voit
// (travelTo, PuzzleMap, portails, préchargeur, générateur F6) comme une map native.
import { useSyncExternalStore } from "react";
import { loadWorldDb, saveWorldDb } from "../persistence/dbStore";
import { registerRuntimeMap, MAPS_ROOT } from "../loaders/assetManifest";

export interface CustomMapDef {
  id: string;            // slug unique (ex: "ma_planete")
  label: string;         // nom affiché
  kind: "glb" | "chunks" | "editor";
  /** kind=glb : chemin du GLB unique (ex: /models/Maps/ma_planete.glb). */
  glbPath?: string;
  /** kind=chunks : dossier (ex: /models/Maps/ma_planete) + nombre de chunks (chunk_01..NN). */
  chunkDir?: string;
  chunkCount?: number;
  /** kind=editor : scène construite dans l'ÉDITEUR Forge (forgeSceneStore). */
  sceneId?: string;
  notes?: string;        // mémo (planète, biome, état Blender…)
  createdAt: number;
}

const STORAGE_KEY = "narvos:custom_maps:v1";
const DB_KEY = "custom_maps";

function loadInitial(): CustomMapDef[] {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}
let state: CustomMapDef[] = loadInitial();
let version = 0;
const listeners = new Set<() => void>();
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
  saveWorldDb(DB_KEY, state);
}
function notify() { version++; for (const l of listeners) l(); }

/** Chemins de chunks d'une map custom (convention chunk_01.glb … chunk_NN.glb). */
export function customChunkPaths(m: CustomMapDef): string[] {
  if (m.kind !== "chunks" || !m.chunkDir || !m.chunkCount) return [];
  return Array.from({ length: m.chunkCount }, (_, i) =>
    `${m.chunkDir}/chunk_${String(i + 1).padStart(2, "0")}.glb`);
}

/** Enregistre la map dans le manifest runtime (le moteur la voit comme une map native).
 *  kind=editor → path sentinelle `editor://<sceneId>` : RpgGameWorld la rend via
 *  ForgeBuiltMap (objets placés + eaux + collisions) au lieu d'un GLB. */
function registerIntoEngine(m: CustomMapDef): void {
  if (m.kind === "editor") {
    registerRuntimeMap(m.id, { path: `editor://${m.sceneId ?? m.id}`, label: m.label });
    return;
  }
  const chunks = customChunkPaths(m);
  registerRuntimeMap(m.id, {
    path: m.glbPath ?? chunks[0] ?? `${MAPS_ROOT}/${m.id}.glb`,
    label: m.label,
    ...(chunks.length > 0 ? { chunks } : {}),
  });
}

// Enregistre immédiatement ce qui est en cache local (avant même l'hydratation DB).
for (const m of state) registerIntoEngine(m);

export const customMapStore = {
  list(): CustomMapDef[] { return state; },
  get(id: string): CustomMapDef | undefined { return state.find((m) => m.id === id); },

  add(def: Omit<CustomMapDef, "createdAt">): { ok: boolean; error?: string } {
    const id = def.id.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    if (!id) return { ok: false, error: "Identifiant vide" };
    if (state.some((m) => m.id === id)) return { ok: false, error: `« ${id} » existe déjà` };
    const m: CustomMapDef = { ...def, id, createdAt: Date.now() };
    state = [...state, m];
    registerIntoEngine(m);
    persist(); notify();
    return { ok: true };
  },

  update(id: string, patch: Partial<CustomMapDef>): void {
    const i = state.findIndex((m) => m.id === id);
    if (i < 0) return;
    state = state.slice();
    state[i] = { ...state[i], ...patch, id };
    registerIntoEngine(state[i]);
    persist(); notify();
  },

  remove(id: string): void {
    state = state.filter((m) => m.id !== id);
    // NB : on ne retire pas l'entrée du manifest runtime (sans danger : plus listée,
    // et un voyage vers elle échouerait proprement au préchargement).
    persist(); notify();
  },

  async hydrate(): Promise<void> {
    const db = await loadWorldDb<CustomMapDef[]>(DB_KEY);
    if (db && Array.isArray(db)) {
      state = db;
      for (const m of state) registerIntoEngine(m);
      notify();
    }
  },

  subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; },
  getVersion: () => version,
};

export function useCustomMaps(): CustomMapDef[] {
  useSyncExternalStore(customMapStore.subscribe, customMapStore.getVersion, customMapStore.getVersion);
  return state;
}
