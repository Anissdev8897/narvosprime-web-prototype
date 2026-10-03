// runtime/combat/arrowMutationStore.ts — MUTATIONS de flèche (archer), persistées.
//
// Trois mutations cumulables appliquées à chaque tir :
//   • multishot : nombre de flèches tirées en éventail (1 = simple).
//   • pierce    : ennemis traversés en plus du premier (perforation).
//   • split     : à l'impact, éclate en N flèches filles.
// Persisté (localStorage + base monde, comme les autres stores) → réglage conservé.
import { useSyncExternalStore } from "react";
import { loadWorldDb, saveWorldDb } from "../../persistence/dbStore";

export interface ArrowMutations {
  multishot: number; // 1..N flèches par tir
  pierce: number;    // ennemis traversés en plus
  split: number;     // flèches filles à l'impact
}

const STORAGE_KEY = "narvos:arrow_mutations:v1";
const DB_KEY = "arrow_mutations";

// Défaut : un set de mutations VISIBLE dès le départ (éventail de 3 + perforation 1) →
// l'archer voit immédiatement ses flèches « mutées ». Réglable.
const DEFAULT: ArrowMutations = { multishot: 3, pierce: 1, split: 0 };

function loadInitial(): ArrowMutations {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? { ...DEFAULT, ...JSON.parse(r) } : { ...DEFAULT }; }
  catch { return { ...DEFAULT }; }
}
let state = loadInitial();
let version = 0;
const listeners = new Set<() => void>();
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
  saveWorldDb(DB_KEY, state);
}
function notify() { version++; for (const fn of listeners) fn(); }

export const arrowMutationStore = {
  get(): ArrowMutations { return state; },
  set(patch: Partial<ArrowMutations>): void {
    state = {
      multishot: Math.max(1, Math.min(9, patch.multishot ?? state.multishot)),
      pierce:    Math.max(0, Math.min(9, patch.pierce ?? state.pierce)),
      split:     Math.max(0, Math.min(6, patch.split ?? state.split)),
    };
    persist(); notify();
  },
  subscribe(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getVersion(): number { return version; },
  async hydrate(): Promise<void> {
    const db = await loadWorldDb<ArrowMutations>(DB_KEY);
    if (db && typeof db.multishot === "number") { state = { ...DEFAULT, ...db }; notify(); }
  },
};

export function useArrowMutations(): ArrowMutations {
  // snapshot = `state` lui-même : remplacé par un NOUVEAU ref à chaque set() → Object.is
  // détecte le changement (contrat useSyncExternalStore respecté, pas de découplage).
  return useSyncExternalStore(arrowMutationStore.subscribe, () => state, () => state);
}
