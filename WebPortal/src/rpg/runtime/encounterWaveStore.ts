// ══════════════════════════════════════════════════════════════════════════════
// runtime/encounterWaveStore.ts — Vagues d'ennemis par map
//
// Définit les vagues d'ennemis pour chaque arène. Chaque vague est un pattern
// d'apparition avec délai, spawns, et curveballs optionnelles.
//
// Le système de combat peut interroger ce store pour savoir quels ennemis
// spawner et à quel moment, plutôt que de tous les faire apparaître en même
// temps.
//
// Même pattern que les autres stores : localStorage + base monde, éditable.
// ══════════════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";
import { loadWorldDb, saveWorldDb } from "../persistence/dbStore";
import type { EncounterWave } from "../arenas/arenaTypes";

const STORAGE_KEY = "narvos:waves:v1";
const DB_KEY = "waves";

function loadInitial(): Record<string, EncounterWave[]> {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    return r ? (JSON.parse(r) as Record<string, EncounterWave[]>) : {};
  } catch {
    return {};
  }
}

let state: Record<string, EncounterWave[]> = loadInitial();
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
  return "wv_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const encounterWaveStore = {
  /** Vagues d'une map. */
  list(mapId: string): EncounterWave[] {
    return state[mapId] ?? [];
  },

  /** Ajoute une vague. */
  add(mapId: string, cfg: Omit<EncounterWave, "id">): string {
    const id = makeId();
    const arr = state[mapId] ?? (state[mapId] = []);
    arr.push({ id, ...cfg });
    persist();
    notify();
    return id;
  },

  /** Modifie une vague. */
  update(mapId: string, id: string, patch: Partial<EncounterWave>): void {
    const arr = state[mapId];
    if (!arr) return;
    const i = arr.findIndex((w) => w.id === id);
    if (i < 0) return;
    arr[i] = { ...arr[i], ...patch };
    persist();
    notify();
  },

  /** Supprime une vague. */
  remove(mapId: string, id: string): void {
    const arr = state[mapId];
    if (!arr) return;
    state[mapId] = arr.filter((w) => w.id !== id);
    persist();
    notify();
  },

  /** Nettoie les vagues d'une map. */
  clear(mapId: string): void {
    if (state[mapId]) {
      delete state[mapId];
      persist();
      notify();
    }
  },

  /** Import en masse depuis une config. */
  seed(mapId: string, waves: Omit<EncounterWave, "id">[]): void {
    state[mapId] = waves.map((w) => ({ id: makeId(), ...w }));
    persist();
    notify();
  },

  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },

  getVersion: (): number => version,

  async hydrate(): Promise<void> {
    const db = await loadWorldDb<Record<string, EncounterWave[]>>(DB_KEY);
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
export function useWaveVersion(): number {
  return useSyncExternalStore(
    encounterWaveStore.subscribe,
    encounterWaveStore.getVersion,
    encounterWaveStore.getVersion,
  );
}
