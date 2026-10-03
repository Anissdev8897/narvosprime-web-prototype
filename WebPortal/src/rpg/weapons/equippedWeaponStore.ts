// weapons/equippedWeaponStore.ts — arme(s) ÉQUIPÉE(s) du joueur (principale + secondaire).
//
// Pont hors-React entre l'inventaire (inventory.equipped.weapon/offhand, état React de
// RpgGameWorld) et les composants perso (HumanCharacter…), qui lisent l'arme à rendre +
// son pack d'anim SANS prop-drilling. L'id = id du WeaponProfile (= id du LootItem, cf.
// weaponShop) → résolution directe du modèle 3D + du type pour les animations.
//
// Découple les anims de l'ARCHÉTYPE : l'arme équipée pilote le modèle ET le pack d'anim.
// Fallback : si rien d'équipé, les composants retombent sur l'arme par défaut de l'archétype.
import { useSyncExternalStore } from "react";

export type WeaponSlot = "primary" | "secondary";

export interface EquippedWeapons {
  primary: string | null;   // id de profil arme principale (null = défaut archétype)
  secondary: string | null; // id de profil arme secondaire / offhand (null = aucune)
  activeSlot: WeaponSlot;   // slot actif (détermine l'arme rendue en FPS)
}

let state: EquippedWeapons = { primary: null, secondary: null, activeSlot: "primary" };
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }

export const equippedWeaponStore = {
  get: (): EquippedWeapons => state,
  set: (next: Omit<EquippedWeapons, "activeSlot"> & { activeSlot?: WeaponSlot }): void => {
    const slot = next.activeSlot ?? state.activeSlot;
    if (next.primary === state.primary && next.secondary === state.secondary && slot === state.activeSlot) return;
    state = { primary: next.primary, secondary: next.secondary, activeSlot: slot };
    emit();
  },
  setActiveSlot: (slot: WeaponSlot): void => {
    if (slot === state.activeSlot) return;
    if (slot === "secondary" && !state.secondary) return;
    state = { ...state, activeSlot: slot };
    emit();
  },
  toggleSlot: (): void => {
    if (!state.secondary) return;
    equippedWeaponStore.setActiveSlot(state.activeSlot === "primary" ? "secondary" : "primary");
  },
  activeWeaponId: (): string | null => state[state.activeSlot],
  subscribe: (l: () => void): (() => void) => { listeners.add(l); return () => { listeners.delete(l); }; },
};

export function useEquippedWeapons(): EquippedWeapons {
  return useSyncExternalStore(equippedWeaponStore.subscribe, equippedWeaponStore.get, equippedWeaponStore.get);
}
