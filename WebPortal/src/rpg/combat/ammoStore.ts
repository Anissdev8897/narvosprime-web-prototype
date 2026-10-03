// combat/ammoStore.ts — réserve de MUNITIONS (archer = flèches, guerrier spatial = cellules).
//
// Store séparé (≠ InventoryState) car le tir lit/décrémente la réserve dans un ref-closure
// à haute fréquence : passer par setInventory = un re-render React par tir. Ici, mutation +
// persistance localStorage, re-render UNIQUEMENT pour les abonnés (HUD via useAmmo).
//
// SCOPÉ PAR PERSONNAGE : la clé localStorage est narvos:ammo:{characterId}.
// Appeler ammoStore.setCharacter(id) avant toute utilisation.
import { useSyncExternalStore } from "react";

export type AmmoKind = "arrows" | "cells";
export interface AmmoState { arrows: number; cells: number; }

const START: AmmoState = { arrows: 20, cells: 20 };

const keyOf = (charId: string) => `narvos:ammo:${charId}`;

let characterId: string | null = null;
let state: AmmoState = { ...START };
const listeners = new Set<() => void>();

function load(charId: string): AmmoState {
  try {
    const r = typeof localStorage !== "undefined" ? localStorage.getItem(keyOf(charId)) : null;
    if (r) { const p = JSON.parse(r); return { arrows: p.arrows ?? START.arrows, cells: p.cells ?? START.cells }; }
  } catch { /* corrompu → défaut */ }
  return { ...START };
}

function persist() {
  if (!characterId) return;
  try { localStorage.setItem(keyOf(characterId), JSON.stringify(state)); } catch { /* quota */ }
}

function emit() {
  persist();
  for (const l of listeners) l();
}

export const ammoStore = {
  /** Initialise le store pour un personnage donné. Charge son état depuis localStorage. */
  setCharacter: (id: string): void => {
    characterId = id;
    state = load(id);
    emit();
  },

  get: (): AmmoState => state,
  count: (k: AmmoKind): number => state[k],
  /** Ajoute n munitions (achat / réappro). */
  add: (k: AmmoKind, n: number): void => { state = { ...state, [k]: Math.max(0, state[k] + n) }; emit(); },
  /** Consomme n munitions ; renvoie false (sans décrémenter) si réserve insuffisante. */
  consume: (k: AmmoKind, n = 1): boolean => {
    if (state[k] < n) return false;
    state = { ...state, [k]: state[k] - n };
    emit();
    return true;
  },
  /** Test/reset. */
  set: (next: AmmoState): void => { state = { ...next }; emit(); },
  subscribe: (l: () => void): (() => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};

export function useAmmo(): AmmoState {
  return useSyncExternalStore(ammoStore.subscribe, ammoStore.get, ammoStore.get);
}
