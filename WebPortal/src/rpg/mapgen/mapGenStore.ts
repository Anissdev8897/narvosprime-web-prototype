// mapgen/mapGenStore.ts — état de l'éditeur de génération (config + aperçu + validation).
import { useSyncExternalStore } from "react";
import type { MapGenConfig, MapGenResult, GenValidation } from "./mapGenerator";

export interface MapGenState {
  open: boolean;
  config: Omit<MapGenConfig, "enemyFolders">;
  preview: MapGenResult | null;       // résultat en APERÇU (pas encore appliqué)
  validation: GenValidation | null;
}

const DEFAULT_CONFIG: MapGenState["config"] = {
  seed: 1,
  bounds: { minX: -120, maxX: 120, minZ: -120, maxZ: 120 },
  hub: { x: 0, z: 0 },
  safeRadius: 25,
  spawnY: 80,
  monsterPoints: 24,
  maxPack: 3,
  resources: 18,
  pois: 4,
  levelRange: [3, 20],
};

let state: MapGenState = { open: false, config: { ...DEFAULT_CONFIG }, preview: null, validation: null };
let version = 0;
const listeners = new Set<() => void>();
function notify() { version++; for (const l of listeners) l(); }

export const mapGenStore = {
  get: (): MapGenState => state,
  set(patch: Partial<MapGenState>): void { state = { ...state, ...patch }; notify(); },
  setConfig(patch: Partial<MapGenState["config"]>): void {
    state = { ...state, config: { ...state.config, ...patch } };
    notify();
  },
  clearPreview(): void { state = { ...state, preview: null, validation: null }; notify(); },
  subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; },
  getVersion: () => version,
};

export function useMapGen(): MapGenState {
  useSyncExternalStore(mapGenStore.subscribe, mapGenStore.getVersion, mapGenStore.getVersion);
  return state;
}
