// ══════════════════════════════════════════════════════════════════════════════
// loot/gear.ts — Système d'équipement RPG (slots, catégories, bonus)
//
// • GearSlot   = slot LOGIQUE porté par un objet ("ring" générique).
// • GearSlotKey = slot PHYSIQUE équipé (ring → ring1/ring2).
// • equippedBonuses() additionne les statBonus de tout l'équipement porté
//   → consommé par effectiveStats() (base + équipement).
// ══════════════════════════════════════════════════════════════════════════════

import type { LootItem } from "./LootRegistry";

/** Slot logique inscrit sur un objet équipable. */
export type GearSlot =
  | "helmet" | "amulet" | "armor" | "cape" | "gloves"
  | "belt" | "ring" | "boots" | "weapon" | "offhand";

/** Slot physique dans l'équipement (les anneaux ont 2 emplacements). */
export type GearSlotKey =
  | "helmet" | "amulet" | "armor" | "cape" | "gloves"
  | "belt" | "ring1" | "ring2" | "boots" | "weapon" | "offhand";

/** Catégorie d'objet (onglets d'inventaire). */
export type ItemCategory = "equipment" | "resource" | "consumable" | "material" | "quest";

/** Emplacements physiques, ordonnés pour l'affichage du panneau d'équipement. */
export const GEAR_SLOTS: { key: GearSlotKey; label: string; accepts: GearSlot }[] = [
  { key: "helmet",  label: "Visière",         accepts: "helmet"  },
  { key: "amulet",  label: "Implant neural",  accepts: "amulet"  },
  { key: "armor",   label: "Exosquelette",    accepts: "armor"   },
  { key: "cape",    label: "Dorsale",         accepts: "cape"    },
  { key: "gloves",  label: "Gantelets",       accepts: "gloves"  },
  { key: "belt",    label: "Ceinture tac.",   accepts: "belt"    },
  { key: "ring1",   label: "Module I",        accepts: "ring"    },
  { key: "ring2",   label: "Module II",       accepts: "ring"    },
  { key: "boots",   label: "Propulseurs",     accepts: "boots"   },
  { key: "weapon",  label: "Arme principale", accepts: "weapon"  },
  { key: "offhand", label: "Arme secondaire", accepts: "offhand" },
];

/** Slots physiques candidats pour un slot logique (ring → 2 emplacements). */
export function physicalSlotsFor(slot: GearSlot): GearSlotKey[] {
  if (slot === "ring") return ["ring1", "ring2"];
  return [slot as GearSlotKey];
}

/** Catégorie d'un objet (équipement si slot, sinon sa catégorie déclarée). */
export function categoryOf(item: LootItem): ItemCategory {
  if (item.slot) return "equipment";
  return item.category ?? "resource";
}

/** Libellés FR des catégories (pour les onglets). */
export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  equipment:  "Équipement",
  resource:   "Ressources",
  consumable: "Consommables",
  material:   "Matériaux",
  quest:      "Quête",
};

/** Additionne les bonus de stats de tout l'équipement porté. */
export function equippedBonuses(
  equipped: Partial<Record<GearSlotKey, LootItem>>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of Object.values(equipped)) {
    if (!item) continue;
    for (const [k, v] of Object.entries(item.statBonus)) {
      out[k] = (out[k] ?? 0) + (v ?? 0);
    }
  }
  return out;
}
