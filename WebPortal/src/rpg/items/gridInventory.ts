// ══════════════════════════════════════════════════════════════════════════════
// items/gridInventory.ts — Inventaire en grille N×M avec positions
//
// Chaque item occupe une zone rectangulaire (gridW × gridH) dans la grille.
// Pas de chevauchement autorisé. Supporte stacking.
// ══════════════════════════════════════════════════════════════════════════════

import type { ItemDefinition, ItemInstance } from "./ItemDefinition";
import { findStackTarget, addToStack, removeFromStack } from "./stacking";

export const DEFAULT_GRID_COLS = 8;
export const DEFAULT_GRID_ROWS = 10;

/** État de la grille : dimensions + instances placées. */
export interface GridState {
  cols: number;
  rows: number;
  instances: ItemInstance[];
}

/**
 * Crée une grille vide.
 */
export function createGridState(
  cols = DEFAULT_GRID_COLS,
  rows = DEFAULT_GRID_ROWS
): GridState {
  return { cols, rows, instances: [] };
}

/**
 * Vérifie si une zone rectangulaire est libre dans la grille.
 */
export function isAreaFree(
  grid: GridState,
  x: number,
  y: number,
  w: number,
  h: number,
  excludeUid?: string
): boolean {
  for (const inst of grid.instances) {
    if (excludeUid && inst.uid === excludeUid) continue;
    if (
      x < inst.gridX + (inst.gridW ?? 1) &&
      x + w > inst.gridX &&
      y < inst.gridY + (inst.gridH ?? 1) &&
      y + h > inst.gridY
    ) {
      return false;
    }
  }
  // Hors limites ?
  if (x < 0 || y < 0 || x + w > grid.cols || y + h > grid.rows) return false;
  return true;
}

/**
 * Trouve la première position libre pour un item de taille (w × h).
 * Cherche de gauche à droite, haut en bas.
 */
export function findFreeSlot(
  grid: GridState,
  w: number,
  h: number
): { x: number; y: number } | null {
  for (let y = 0; y <= grid.rows - h; y++) {
    for (let x = 0; x <= grid.cols - w; x++) {
      if (isAreaFree(grid, x, y, w, h)) {
        return { x, y };
      }
    }
  }
  return null;
}

/**
 * Ajoute un item dans la grille.
 * - Si l'item est stackable et qu'une pile partielle existe : empile.
 * - Sinon, place dans la première zone libre.
 * Retourne le nouvel état, ou null si impossible.
 */
export function addItemToGrid(
  grid: GridState,
  def: ItemDefinition,
  quantity = 1
): GridState | null {
  let instances = [...grid.instances];

  // Tentative de stack
  if (def.stackable) {
    const target = findStackTarget(def, instances, quantity);
    if (target) {
      instances = instances.map((inst) =>
        inst.uid === target.instance.uid
          ? { ...inst, quantity: addToStack(inst, quantity, def.maxStack) }
          : inst
      );
      return { ...grid, instances };
    }
  }

  // Nouvelle pile : trouver une zone libre
  const w = def.gridW ?? 1;
  const h = def.gridH ?? 1;
  const pos = findFreeSlot(grid, w, h);
  if (!pos) return null;

  const uid = `inst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  instances.push({
    itemId: def.id,
    quantity,
    gridX: pos.x,
    gridY: pos.y,
    uid,
    gridW: w,
    gridH: h,
  });

  return { ...grid, instances };
}

/**
 * Retire une instance (ou une partie) de la grille.
 * Si quantity >= instance.quantity, toute l'instance est retirée.
 * Sinon, quantité décrémentée.
 */
export function removeItemFromGrid(
  grid: GridState,
  uid: string,
  quantity?: number
): { grid: GridState; removed: ItemInstance | null } {
  const idx = grid.instances.findIndex((i) => i.uid === uid);
  if (idx < 0) return { grid, removed: null };

  const inst = grid.instances[idx];

  if (quantity !== undefined && quantity < inst.quantity) {
    // Réduction de quantité seulement
    const instances = grid.instances.map((i) =>
      i.uid === uid ? { ...i, quantity: removeFromStack(i, quantity) } : i
    );
    return {
      grid: { ...grid, instances },
      removed: { ...inst, quantity },
    };
  }

  // Retrait complet
  const instances = grid.instances.slice();
  instances.splice(idx, 1);
  return {
    grid: { ...grid, instances },
    removed: inst,
  };
}

/**
 * Déplace une instance vers une nouvelle position.
 * Retourne null si la position est occupée ou hors limites.
 */
export function moveItemInGrid(
  grid: GridState,
  uid: string,
  newX: number,
  newY: number
): GridState | null {
  const inst = grid.instances.find((i) => i.uid === uid);
  if (!inst) return null;

  const w = inst.gridW ?? 1;
  const h = inst.gridH ?? 1;

  if (!isAreaFree(grid, newX, newY, w, h, uid)) return null;
  if (newX < 0 || newY < 0 || newX + w > grid.cols || newY + h > grid.rows)
    return null;

  return {
    ...grid,
    instances: grid.instances.map((i) =>
      i.uid === uid ? { ...i, gridX: newX, gridY: newY } : i
    ),
  };
}

/**
 * Compte le nombre d'instances d'un item.
 */
export function countItem(grid: GridState, itemId: string): number {
  return grid.instances
    .filter((i) => i.itemId === itemId)
    .reduce((sum, i) => sum + i.quantity, 0);
}

/**
 * Nombre de slots utilisés (chaque instance = 1 slot, même si stackée).
 */
export function usedSlots(grid: GridState): number {
  return grid.instances.length;
}

/**
 * Nombre de slots max.
 */
export function maxSlots(grid: GridState): number {
  return grid.cols * grid.rows;
}
