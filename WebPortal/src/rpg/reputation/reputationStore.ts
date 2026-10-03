// reputation/reputationStore.ts — Réputation joueur par faction (singleton hors-React).
//
// Valeurs entières : négatif = hostile, positif = allié. Persisté par personnage
// dans localStorage (même pattern que progressionStore).

import { useSyncExternalStore } from "react";
import type { FactionId } from "../runtime/core/worldTypes";
import { REPUTATION_TIERS, type ReputationTierId } from "./reputationCatalog";

export interface ReputationState {
  akarlys: number;
  mezalayis: number;
  zayan: number;
}

const DEFAULT_STATE: ReputationState = { akarlys: 0, mezalayis: 0, zayan: 0 };

let state: ReputationState = { ...DEFAULT_STATE };
let characterId: string | null = null;
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

const keyOf = (charId: string) => `narvos:reputation:${charId}`;

function persist() {
  if (!characterId) return;
  try { localStorage.setItem(keyOf(characterId), JSON.stringify(state)); } catch { /* quota */ }
}

function load(charId: string): ReputationState {
  try {
    const raw = localStorage.getItem(keyOf(charId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ReputationState>;
      return {
        akarlys: typeof parsed.akarlys === "number" ? parsed.akarlys : 0,
        mezalayis: typeof parsed.mezalayis === "number" ? parsed.mezalayis : 0,
        zayan: typeof parsed.zayan === "number" ? parsed.zayan : 0,
      };
    }
  } catch { /* corrupted */ }
  return { ...DEFAULT_STATE };
}

export function currentTier(rep: number): ReputationTierId {
  for (let i = REPUTATION_TIERS.length - 1; i >= 0; i--) {
    if (rep >= REPUTATION_TIERS[i].minRep) return REPUTATION_TIERS[i].id;
  }
  return REPUTATION_TIERS[0].id;
}

export const reputationStore = {
  get: (): ReputationState => state,

  init(charId: string): void {
    characterId = charId;
    state = load(charId);
    emit();
  },

  reset(): void {
    state = { ...DEFAULT_STATE };
    characterId = null;
    emit();
  },

  gain(faction: FactionId, amount: number): void {
    if (amount <= 0) return;
    state = { ...state, [faction]: state[faction] + amount };
    persist();
    emit();
  },

  lose(faction: FactionId, amount: number): void {
    if (amount <= 0) return;
    state = { ...state, [faction]: state[faction] - amount };
    persist();
    emit();
  },

  set(faction: FactionId, value: number): void {
    if (state[faction] === value) return;
    state = { ...state, [faction]: value };
    persist();
    emit();
  },

  tierOf(faction: FactionId): ReputationTierId {
    return currentTier(state[faction]);
  },

  subscribe: (l: () => void): (() => void) => {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
};

export function useReputation(): ReputationState {
  return useSyncExternalStore(reputationStore.subscribe, reputationStore.get, reputationStore.get);
}
