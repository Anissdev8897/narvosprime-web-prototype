// professions/harvestNodeAdminStore.ts — état transitoire de l'éditeur de nœuds (F11).
import { useSyncExternalStore } from "react";
import type { ProfessionId } from "./professionTypes";

export interface HarvestNodeAdminConfig {
  /** Métier du prochain nœud posé (bucheron=arbre, mineur=rocher, recolteur=buisson). */
  profession: ProfessionId;
  /** Mode placement actif → un clic dans la scène pose un nœud. */
  placementActive: boolean;
  /** id du nœud sélectionné pour le gizmo de transformation (null = aucun). */
  selectedId: string | null;
  /** mode du gizmo : déplacement (axes) ou rotation. */
  gizmoMode: "translate" | "rotate";
}

let cfg: HarvestNodeAdminConfig = {
  profession: "bucheron",
  placementActive: false,
  selectedId: null,
  gizmoMode: "translate",
};
let version = 0;
const listeners = new Set<() => void>();
function notify() { version++; for (const fn of listeners) fn(); }

export const harvestNodeAdminStore = {
  get(): HarvestNodeAdminConfig { return cfg; },
  set(patch: Partial<HarvestNodeAdminConfig>): void { cfg = { ...cfg, ...patch }; notify(); },
  subscribe(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getVersion(): number { return version; },
};

export function useHarvestNodeAdmin(): HarvestNodeAdminConfig {
  useSyncExternalStore(harvestNodeAdminStore.subscribe, harvestNodeAdminStore.getVersion, harvestNodeAdminStore.getVersion);
  return harvestNodeAdminStore.get();
}
