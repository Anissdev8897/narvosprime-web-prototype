// ══════════════════════════════════════════════════════════════════════════════
// loot/bags.ts — Système de poids + sacs (capacité d'inventaire)
//
// Double contrainte RPG :
//   • SLOTS : nombre de PILES distinctes (un type d'objet = 1 slot, peu importe la quantité)
//   • POIDS : masse totale (chaque exemplaire compte)
// Un sac équipé augmente les deux. Achat de sacs chez le marchand général.
// ══════════════════════════════════════════════════════════════════════════════

import type { LootItem } from "./LootRegistry";
import type { InventoryState } from "./Inventory";

export const BASE_SLOTS = 25;
export const BASE_WEIGHT = 40; // kg

export interface BagDef {
  id: string;
  label: string;
  slots: number;   // slots ajoutés
  weight: number;  // poids max ajouté (kg)
  price: number;   // crédits
}

export const BAGS: Record<string, BagDef> = {
  bag_large: { id: "bag_large", label: "Grand Sac",     slots: 15, weight: 40, price: 10000 },
  bag_huge:  { id: "bag_huge",  label: "Sac de Soute",  slots: 35, weight: 110, price: 25000 },
};

/** Poids d'un objet (défaut par type si non spécifié). */
export function itemWeight(item: LootItem): number {
  if (typeof item.weight === "number") return item.weight;
  if (item.slot === "armor" || item.slot === "weapon" || item.slot === "offhand") return 6;
  if (item.slot) return 2;          // autre équipement
  if (item.category === "material") return 2;
  return 1;                          // ressource / consommable
}

export function maxSlots(inv: InventoryState): number {
  return BASE_SLOTS + (inv.bagId ? BAGS[inv.bagId]?.slots ?? 0 : 0);
}
export function maxWeight(inv: InventoryState): number {
  return BASE_WEIGHT + (inv.bagId ? BAGS[inv.bagId]?.weight ?? 0 : 0);
}

/** Slots utilisés = nombre de types d'objets distincts dans le sac. */
export function usedSlots(inv: InventoryState): number {
  return new Set(inv.items.map((i) => i.id)).size;
}

/** Poids total porté (sac + équipement). */
export function usedWeight(inv: InventoryState): number {
  let w = 0;
  for (const it of inv.items) w += itemWeight(it);
  for (const it of Object.values(inv.equipped)) if (it) w += itemWeight(it);
  return Math.round(w * 10) / 10;
}

/** Peut-on ajouter cet objet ? (nouvelle pile bloquée si slots pleins ; poids toujours vérifié). */
export function canAdd(inv: InventoryState, item: LootItem): boolean {
  const isNewStack = !inv.items.some((i) => i.id === item.id);
  if (isNewStack && usedSlots(inv) >= maxSlots(inv)) return false;
  if (usedWeight(inv) + itemWeight(item) > maxWeight(inv)) return false;
  return true;
}
