// ══════════════════════════════════════════════════════════════════════════════
// runtime/triggerZoneStore.ts — Zones de trigger par map
//
// Définit des zones déclencheurs qui activent des événements de combat :
//   • entry   → le joueur entre dans l'arène (déclenche la 1re vague)
//   • boss    → le joueur entre dans la salle du boss
//   • encounter → zone de combat spécifique
//   • safe    → zone de repos / hors-combat
//   • no_mans_land → zone dangereuse sans cover
//   • vantage → point d'observation
//   • arena   → zone principale de l'arène
//
// Même pattern que les autres stores : localStorage + base monde, éditable.
// ══════════════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";
import { loadWorldDb, saveWorldDb } from "../persistence/dbStore";
import type { TriggerZone } from "../arenas/arenaTypes";

const STORAGE_KEY = "narvos:triggers:v1";
const DB_KEY = "triggers";

function loadInitial(): Record<string, TriggerZone[]> {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    return r ? (JSON.parse(r) as Record<string, TriggerZone[]>) : {};
  } catch {
    return {};
  }
}

let state: Record<string, TriggerZone[]> = loadInitial();
let version = 0;
const listeners = new Set<() => void>();

function persist(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
  saveWorldDb(DB_KEY, state);
}

function notify(): void {
  version++;
  for (const l of listeners) l();
}

function makeId(): string {
  return "tz_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const triggerZoneStore = {
  /** Toutes les zones d'une map. */
  list(mapId: string): TriggerZone[] {
    return state[mapId] ?? [];
  },

  /** Ajoute une zone trigger et retourne son id. */
  add(mapId: string, cfg: Omit<TriggerZone, "id">): string {
    const id = makeId();
    const arr = state[mapId] ?? (state[mapId] = []);
    arr.push({ id, ...cfg });
    persist();
    notify();
    return id;
  },

  /** Modifie une zone. */
  update(mapId: string, id: string, patch: Partial<TriggerZone>): void {
    const arr = state[mapId];
    if (!arr) return;
    const i = arr.findIndex((z) => z.id === id);
    if (i < 0) return;
    arr[i] = { ...arr[i], ...patch };
    persist();
    notify();
  },

  /** Supprime une zone. */
  remove(mapId: string, id: string): void {
    const arr = state[mapId];
    if (!arr) return;
    state[mapId] = arr.filter((z) => z.id !== id);
    persist();
    notify();
  },

  /** Nettoie toutes les zones d'une map. */
  clear(mapId: string): void {
    if (state[mapId]) {
      delete state[mapId];
      persist();
      notify();
    }
  },

  /** Supprime les zones générées. */
  removeGenerated(mapId: string): number {
    const arr = state[mapId];
    if (!arr) return 0;
    const kept = arr.filter((z) => !z.gen);
    const removed = arr.length - kept.length;
    if (removed > 0) {
      state[mapId] = kept;
      persist();
      notify();
    }
    return removed;
  },

  /** Import en masse depuis une config. */
  seed(mapId: string, zones: Omit<TriggerZone, "id">[]): void {
    state[mapId] = zones.map((z) => ({ id: makeId(), ...z }));
    persist();
    notify();
  },

  /** Trouve les zones qui contiennent un point donné. */
  at(mapId: string, x: number, z: number): TriggerZone[] {
    const arr = state[mapId];
    if (!arr) return [];
    return arr.filter((zn) => {
      const dx = x - zn.center[0];
      const dz = z - zn.center[2];
      return dx * dx + dz * dz <= zn.radius * zn.radius;
    });
  },

  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },

  getVersion: (): number => version,

  async hydrate(): Promise<void> {
    const db = await loadWorldDb<Record<string, TriggerZone[]>>(DB_KEY);
    if (db && typeof db === "object") {
      state = db;
      notify();
    }
  },

  /** Réservé aux TESTS. */
  __resetForTest(): void {
    state = {};
    version = 0;
  },
};

/** Pont React. */
export function useTriggerZoneVersion(): number {
  return useSyncExternalStore(
    triggerZoneStore.subscribe,
    triggerZoneStore.getVersion,
    triggerZoneStore.getVersion,
  );
}
