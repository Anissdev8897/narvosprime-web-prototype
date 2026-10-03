// ══════════════════════════════════════════════════════════════════════════════
// items/stacking.ts — Gestion des piles d'items
//
// Les items stackables (munitions, ressources, matériaux) peuvent être groupés
// en une seule instance dans la grille. maxStack = nombre max par pile.
// ══════════════════════════════════════════════════════════════════════════════

import type { ItemDefinition, ItemInstance } from "./ItemDefinition";

/**
 * Peut-on ajouter `amount` unités de l'item à une pile existante ?
 * Retourne l'instance cible si oui, null si toutes les piles sont pleines.
 */
export function findStackTarget(
  def: ItemDefinition,
  instances: ItemInstance[],
  amount: number
): { instance: ItemInstance; space: number } | null {
  if (!def.stackable) return null;

  for (const inst of instances) {
    if (inst.itemId !== def.id) continue;
    const space = def.maxStack - inst.quantity;
    if (space >= amount) return { instance: inst, space };
    if (space > 0) return { instance: inst, space };
  }
  return null;
}

/**
 * Ajoute une quantité à une pile existante.
 * Retourne la nouvelle quantité, ou l'ancienne si dépassement.
 */
export function addToStack(
  instance: ItemInstance,
  amount: number,
  maxStack: number
): number {
  return Math.min(instance.quantity + amount, maxStack);
}

/**
 * Retire une quantité d'une pile.
 * Retourne la quantité restante (0 = pile vide → doit être supprimée).
 */
export function removeFromStack(
  instance: ItemInstance,
  amount: number
): number {
  return Math.max(0, instance.quantity - amount);
}

/**
 * Sépare une pile en deux : prend `amount` de l'instance source
 * et crée une nouvelle instance à la position donnée.
 * Retourne la nouvelle instance, ou null si la séparation est invalide.
 */
export function splitStack(
  source: ItemInstance,
  amount: number,
  newGridX: number,
  newGridY: number
): { source: ItemInstance; split: ItemInstance } | null {
  if (amount <= 0 || amount >= source.quantity) return null;

  const newUid = `inst_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    source: { ...source, quantity: source.quantity - amount },
    split: {
      itemId: source.itemId,
      quantity: amount,
      gridX: newGridX,
      gridY: newGridY,
      gridW: source.gridW,
      gridH: source.gridH,
      uid: newUid,
    },
  };
}

/**
 * Fusionne deux instances du même item si la destination n'est pas pleine.
 * Retourne l'état fusionné, ou null si impossible.
 */
export function mergeStacks(
  source: ItemInstance,
  dest: ItemInstance,
  maxStack: number
): { source: ItemInstance | null; dest: ItemInstance } | null {
  if (source.itemId !== dest.itemId) return null;
  const space = maxStack - dest.quantity;
  if (space <= 0) return null;

  const moved = Math.min(source.quantity, space);
  return {
    source: source.quantity - moved > 0
      ? { ...source, quantity: source.quantity - moved }
      : null,
    dest: { ...dest, quantity: dest.quantity + moved },
  };
}
