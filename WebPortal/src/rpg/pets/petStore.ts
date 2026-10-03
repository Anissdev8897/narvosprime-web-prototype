// pets/petStore.ts — Compagnons permanents du joueur (singleton hors-React).
//
// Gère : liste des pets possédés, compagnon actif, XP / niveau.
// Persisté par personnage dans localStorage (même pattern que reputationStore).

import { useSyncExternalStore } from "react";

export interface OwnedPet {
  id: string;
  nickname: string;
  xp: number;
  level: number;
}

export interface PetStoreState {
  owned: OwnedPet[];
  activeCompanionId: string | null;
}

const MAX_PET_LEVEL = 20;

function xpForLevel(level: number): number {
  return 80 + level * 40;
}

const DEFAULT_STATE: PetStoreState = { owned: [], activeCompanionId: null };

let state: PetStoreState = { ...DEFAULT_STATE, owned: [] };
let characterId: string | null = null;
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

const keyOf = (charId: string) => `narvos:pets:${charId}`;

function persist() {
  if (!characterId) return;
  try { localStorage.setItem(keyOf(characterId), JSON.stringify(state)); } catch { /* quota */ }
}

function load(charId: string): PetStoreState {
  try {
    const raw = localStorage.getItem(keyOf(charId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PetStoreState>;
      return {
        owned: Array.isArray(parsed.owned) ? parsed.owned : [],
        activeCompanionId: typeof parsed.activeCompanionId === "string" ? parsed.activeCompanionId : null,
      };
    }
  } catch { /* corrupted */ }
  return { ...DEFAULT_STATE, owned: [] };
}

export const petStore = {
  get: (): PetStoreState => state,

  init(charId: string): void {
    characterId = charId;
    state = load(charId);
    emit();
  },

  adopt(petId: string, nickname?: string): void {
    if (state.owned.some((p) => p.id === petId)) return;
    state = {
      ...state,
      owned: [...state.owned, { id: petId, nickname: nickname ?? petId, xp: 0, level: 1 }],
    };
    persist();
    emit();
  },

  rename(petId: string, nickname: string): void {
    state = {
      ...state,
      owned: state.owned.map((p) => (p.id === petId ? { ...p, nickname } : p)),
    };
    persist();
    emit();
  },

  setActive(petId: string | null): void {
    if (petId && !state.owned.some((p) => p.id === petId)) return;
    state = { ...state, activeCompanionId: petId };
    persist();
    emit();
  },

  grantXp(petId: string, amount: number): void {
    state = {
      ...state,
      owned: state.owned.map((p) => {
        if (p.id !== petId || p.level >= MAX_PET_LEVEL) return p;
        let xp = p.xp + amount;
        let level = p.level;
        while (level < MAX_PET_LEVEL && xp >= xpForLevel(level)) {
          xp -= xpForLevel(level);
          level++;
        }
        return { ...p, xp, level };
      }),
    };
    persist();
    emit();
  },

  getOwned(petId: string): OwnedPet | undefined {
    return state.owned.find((p) => p.id === petId);
  },

  getActiveCompanion(): OwnedPet | undefined {
    if (!state.activeCompanionId) return undefined;
    return state.owned.find((p) => p.id === state.activeCompanionId);
  },

  xpForLevel,
  MAX_PET_LEVEL,

  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => { listeners.delete(cb); };
  },
};

export function usePetStore(): PetStoreState {
  return useSyncExternalStore(petStore.subscribe, petStore.get, petStore.get);
}
