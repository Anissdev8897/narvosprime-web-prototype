// ══════════════════════════════════════════════════════════════════════════════
// runtime/coverStore.ts — Points de COVER par map (data-driven)
//
// Chaque map définit des positions de cover qui permettent au joueur de
// s'abriter. Trois types :
//   • hard   : bloque vision + dégâts (piliers, rochers, murs)
//   • soft   : bloque vision, dégâts traversent (buissons, fumée)
//   • hybrid : vision traverse, dégâts bloqués (boucliers énergétiques)
//
// Même pattern que les autres stores : localStorage + base monde, éditable,
// hydraté au boot. Un cover désactivé reste dans les données mais n'est pas
// actif en jeu.
// ══════════════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";
import { loadWorldDb, saveWorldDb } from "../persistence/dbStore";
import type { CoverPoint } from "../arenas/arenaTypes";

const STORAGE_KEY = "narvos:covers:v1";
const DB_KEY = "covers";

function loadInitial(): Record<string, CoverPoint[]> {
  try {
    const r = localStorage.getItem(STORAGE_KEY);
    return r ? (JSON.parse(r) as Record<string, CoverPoint[]>) : {};
  } catch {
    return {};
  }
}

let state: Record<string, CoverPoint[]> = loadInitial();
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
  return "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export const coverStore = {
  /** Tous les covers d'une map. Tableau vide si rien. */
  list(mapId: string): CoverPoint[] {
    return state[mapId] ?? [];
  },

  /** Ajoute un cover et retourne son id. */
  add(mapId: string, cfg: Omit<CoverPoint, "id">): string {
    const id = makeId();
    const arr = state[mapId] ?? (state[mapId] = []);
    arr.push({ id, ...cfg });
    persist();
    notify();
    return id;
  },

  /** Modifie un cover en place. */
  update(mapId: string, id: string, patch: Partial<CoverPoint>): void {
    const arr = state[mapId];
    if (!arr) return;
    const i = arr.findIndex((c) => c.id === id);
    if (i < 0) return;
    arr[i] = { ...arr[i], ...patch };
    persist();
    notify();
  },

  /** Supprime un cover. */
  remove(mapId: string, id: string): void {
    const arr = state[mapId];
    if (!arr) return;
    state[mapId] = arr.filter((c) => c.id !== id);
    persist();
    notify();
  },

  /** Nettoie toute une map. */
  clear(mapId: string): void {
    if (state[mapId]) {
      delete state[mapId];
      persist();
      notify();
    }
  },

  /** Supprime les covers générés (gen=true). */
  removeGenerated(mapId: string): number {
    const arr = state[mapId];
    if (!arr) return 0;
    const kept = arr.filter((c) => !c.gen);
    const removed = arr.length - kept.length;
    if (removed > 0) {
      state[mapId] = kept;
      persist();
      notify();
    }
    return removed;
  },

  /** Importe en masse les covers d'une config (seed initial). */
  seed(mapId: string, points: Omit<CoverPoint, "id">[]): void {
    const arr = points.map((p) => ({ id: makeId(), ...p }));
    state[mapId] = arr;
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
    const db = await loadWorldDb<Record<string, CoverPoint[]>>(DB_KEY);
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

/** Pont React pour re-rendre sur changement de cover. */
export function useCoverVersion(): number {
  return useSyncExternalStore(
    coverStore.subscribe,
    coverStore.getVersion,
    coverStore.getVersion,
  );
}
