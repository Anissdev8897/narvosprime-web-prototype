// ══════════════════════════════════════════════════════════════════════════════
// items/equipmentSlots.ts — Système d'équipement à 6 slots
//
// Casque, Torse, Jambes, Arme principale, Arme secondaire, Accessoire.
// Bonus stats cumulés de l'équipement porté.
// ══════════════════════════════════════════════════════════════════════════════

import type { EquipSlot, ItemDefinition, ItemStats, ItemInstance } from "./ItemDefinition";
import { ITEM_DB } from "./itemCatalog";

export { EQUIP_SLOT_LABELS } from "./ItemDefinition";

/** État de l'équipement : slot → instance équipée (ou null). */
export type EquipmentState = Record<EquipSlot, ItemInstance | null>;

/** État initial (tous slots vides). */
export function createEmptyEquipment(): EquipmentState {
  return {
    helmet: null,
    armor: null,
    legs: null,
    weapon: null,
    offhand: null,
    accessory: null,
  };
}

/**
 * Équipe un item dans son slot.
 * Retourne le nouvel état + l'item délogé (si le slot était occupé).
 */
export function equipItem(
  equipment: EquipmentState,
  instance: ItemInstance
): { equipment: EquipmentState; displaced: ItemInstance | null } {
  const def = ITEM_DB[instance.itemId];
  if (!def?.equipSlot) return { equipment, displaced: null };

  const slot = def.equipSlot;
  const displaced = equipment[slot];
  return {
    equipment: { ...equipment, [slot]: instance },
    displaced,
  };
}

/**
 * Déséquipe un slot.
 * Retourne l'item retiré (ou null si vide).
 */
export function unequipSlot(
  equipment: EquipmentState,
  slot: EquipSlot
): { equipment: EquipmentState; removed: ItemInstance | null } {
  const removed = equipment[slot];
  if (!removed) return { equipment, removed: null };
  const next = { ...equipment, [slot]: null };
  return { equipment: next, removed };
}

/**
 * Vérifie si un item peut être équipé dans le slot demandé.
 */
export function canEquip(
  def: ItemDefinition,
  targetSlot?: EquipSlot
): boolean {
  if (!def.equipSlot) return false;
  if (targetSlot && def.equipSlot !== targetSlot) return false;
  return true;
}

/**
 * Calcule les bonus cumulés de tout l'équipement porté.
 */
export function getEquippedStats(
  equipment: EquipmentState
): ItemStats {
  const total: ItemStats = {};
  for (const slot of Object.keys(equipment) as EquipSlot[]) {
    const inst = equipment[slot];
    if (!inst) continue;
    const def = ITEM_DB[inst.itemId];
    if (!def) continue;
    for (const [key, value] of Object.entries(def.stats)) {
      if (typeof value === "number") {
        total[key as keyof ItemStats] =
          (total[key as keyof ItemStats] ?? 0) + value;
      }
    }
  }
  return total;
}

/**
 * Liste des slots ordonnés pour l'affichage.
 */
export const EQUIPMENT_SLOTS_ORDERED: {
  slot: EquipSlot;
  label: string;
  icon: string;
}[] = [
  { slot: "helmet",    label: "Casque",         icon: "🪖" },
  { slot: "armor",     label: "Torse",          icon: "🛡️" },
  { slot: "legs",      label: "Jambes",         icon: "👖" },
  { slot: "weapon",    label: "Arme principale", icon: "⚔️" },
  { slot: "offhand",   label: "Arme secondaire", icon: "🛡️" },
  { slot: "accessory", label: "Accessoire",     icon: "💍" },
];
