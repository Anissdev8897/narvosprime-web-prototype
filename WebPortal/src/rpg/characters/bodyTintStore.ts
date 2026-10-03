// characters/bodyTintStore.ts — teintes PAR PARTIE du corps (option B), persistées.
//
// Une couleur par bande (bottes/pantalon/ceinture/torse/visage). Défaut #ffffff = neutre
// (couleurs d'origine). Persisté (localStorage + base monde) comme les autres singletons.
import { useSyncExternalStore } from "react";
import { loadWorldDb, saveWorldDb } from "../persistence/dbStore";
import type { BodyPartId, PartTints } from "./bodyParts";
import { PART_ORDER } from "./bodyParts";
import { sanitizeHexColor } from "../utils/color";

const STORAGE_KEY = "narvos:body_tints:v1";
const DB_KEY = "body_tints";

/** Assainit toutes les teintes (anti hex partiels "#d" persistés par d'anciens builds). */
function sanitizeTints(t: PartTints): PartTints {
  const out: PartTints = {};
  for (const p of PART_ORDER) if (t[p]) out[p] = sanitizeHexColor(t[p]);
  return out;
}

function loadInitial(): PartTints {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? sanitizeTints(JSON.parse(r)) : {}; } catch { return {}; }
}
let state: PartTints = loadInitial();
let version = 0;
const listeners = new Set<() => void>();
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
  saveWorldDb(DB_KEY, state);
}
function notify() { version++; for (const fn of listeners) fn(); }

export const bodyTintStore = {
  get(): PartTints { return state; },
  set(part: BodyPartId, hex: string): void {
    state = { ...state, [part]: sanitizeHexColor(hex) }; // validation stricte à l'écriture
    persist(); notify();
  },
  reset(): void { state = {}; persist(); notify(); },
  subscribe(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getVersion(): number { return version; },
  async hydrate(): Promise<void> {
    const db = await loadWorldDb<PartTints>(DB_KEY);
    if (db && typeof db === "object") {
      const clean = sanitizeTints(db);
      state = clean;
      // RÉPARE la base si des hex partiels y dormaient (corrige les données existantes).
      if (JSON.stringify(clean) !== JSON.stringify(db)) persist();
      notify();
    }
  },
};

/** Snapshot stable : `state` remplacé par ref à chaque set → Object.is détecte le changement. */
export function useBodyTints(): PartTints {
  return useSyncExternalStore(bodyTintStore.subscribe, () => state, () => state);
}

/** Vrai si au moins une partie est teintée (≠ blanc) → on n'applique le shader que si utile. */
export function hasBodyTint(): boolean {
  return PART_ORDER.some((p) => state[p] && state[p] !== "#ffffff");
}
