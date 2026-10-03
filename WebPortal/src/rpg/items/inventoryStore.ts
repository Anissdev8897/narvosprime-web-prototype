// ══════════════════════════════════════════════════════════════════════════════
// items/inventoryStore.ts — Store central d'inventaire (React + SyncExternalStore)
//
// Pont entre la grille, l'équipement et les crédits.
// Utilise useSyncExternalStore (pattern existant du projet).
// ══════════════════════════════════════════════════════════════════════════════

import { useSyncExternalStore } from "react";
import type { GridState } from "./gridInventory";
import type { EquipmentState } from "./equipmentSlots";
import type { ItemDefinition, ItemInstance } from "./ItemDefinition";
import { ITEM_DB } from "./itemCatalog";
import { createGridState, addItemToGrid, removeItemFromGrid, moveItemInGrid, findFreeSlot } from "./gridInventory";
import { createEmptyEquipment, equipItem as equipToSlot, unequipSlot, getEquippedStats } from "./equipmentSlots";

// ── État complet de l'inventaire ────────────────────────────────────────────
export interface InventoryStore {
  grid: GridState;
  equipment: EquipmentState;
  credits: number;
}

let state: InventoryStore = {
  grid: createGridState(),
  equipment: createEmptyEquipment(),
  credits: 200,
};

const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}

// ── Store React (pattern useSyncExternalStore comme equippedWeaponStore) ─────
export const inventoryStore = {
  get: (): InventoryStore => state,

  /** Réinitialise l'inventaire. */
  reset: (): void => {
    state = { grid: createGridState(), equipment: createEmptyEquipment(), credits: 200 };
    emit();
  },

  /** Ajoute un item dans la grille. Retourne true si réussi. */
  addItem: (def: ItemDefinition, quantity = 1): boolean => {
    const newGrid = addItemToGrid(state.grid, def, quantity);
    if (!newGrid) return false;
    state = { ...state, grid: newGrid };
    emit();
    return true;
  },

  /** Ajoute un item par son ID. */
  addItemById: (itemId: string, quantity = 1): boolean => {
    const def = ITEM_DB[itemId];
    if (!def) return false;
    return inventoryStore.addItem(def, quantity);
  },

  /** Ajoute plusieurs items (batch — une seule émission). */
  addItems: (items: Array<{ itemId: string; quantity: number }>): boolean => {
    let grid = state.grid;
    for (const { itemId, quantity } of items) {
      const def = ITEM_DB[itemId];
      if (!def) return false;
      const newGrid = addItemToGrid(grid, def, quantity);
      if (!newGrid) return false;
      grid = newGrid;
    }
    state = { ...state, grid };
    emit();
    return true;
  },

  /** Retire un item de la grille. */
  removeItem: (uid: string, quantity?: number): ItemInstance | null => {
    const { grid, removed } = removeItemFromGrid(state.grid, uid, quantity);
    if (!removed) return null;
    state = { ...state, grid };
    emit();
    return removed;
  },

  /** Déplace un item dans la grille. */
  moveItem: (uid: string, newX: number, newY: number): boolean => {
    const newGrid = moveItemInGrid(state.grid, uid, newX, newY);
    if (!newGrid) return false;
    state = { ...state, grid: newGrid };
    emit();
    return true;
  },

  /** Équipe un item depuis la grille (l'instance est retirée de la grille). */
  equipFromGrid: (uid: string): boolean => {
    const inst = state.grid.instances.find((i) => i.uid === uid);
    if (!inst) return false;
    const def = ITEM_DB[inst.itemId];
    if (!def || !def.equipSlot) return false;

    const { grid, removed } = removeItemFromGrid(state.grid, uid);
    if (!removed) return false;

    const { equipment, displaced } = equipToSlot(state.equipment, removed);

    // Si un item a été délogé, on le remet dans la grille
    let finalGrid = grid;
    if (displaced) {
      const displacedDef = ITEM_DB[displaced.itemId];
      if (displacedDef) {
        const result = addItemToGrid(finalGrid, displacedDef, displaced.quantity);
        if (result) finalGrid = result;
      }
    }

    state = { ...state, grid: finalGrid, equipment };
    emit();
    return true;
  },

  /** Déséquipe un slot → l'item retourne dans la grille. */
  unequipToGrid: (slot: import("./ItemDefinition").EquipSlot): boolean => {
    const { equipment, removed } = unequipSlot(state.equipment, slot);
    if (!removed) return false;

    const def = ITEM_DB[removed.itemId];
    if (!def) return false;

    const newGrid = addItemToGrid(state.grid, def, removed.quantity);
    if (!newGrid) return false;

    state = { ...state, grid: newGrid, equipment };
    emit();
    return true;
  },

  /** Ajoute des crédits. */
  addCredits: (amount: number): void => {
    state = { ...state, credits: Math.max(0, state.credits + amount) };
    emit();
  },

  /** Définit les crédits. */
  setCredits: (amount: number): void => {
    state = { ...state, credits: Math.max(0, amount) };
    emit();
  },

  /** Statistiques bonus cumulées de l'équipement. */
  getEquippedStats: (): import("./ItemDefinition").ItemStats => {
    return getEquippedStats(state.equipment);
  },

  subscribe: (l: () => void): (() => void) => {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
};

// ── Hook React ─────────────────────────────────────────────────────────────
export function useInventory(): InventoryStore {
  return useSyncExternalStore(
    inventoryStore.subscribe,
    inventoryStore.get,
    inventoryStore.get
  );
}
