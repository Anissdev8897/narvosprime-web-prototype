// professions/craftedItems.ts — pont artisanat → inventaire principal.
//
// Chaque sortie de recette devient un vrai LootItem (équipable / consommable) :
//   • Forgeron  → armes (slot weapon) & armures (slot armor) avec statBonus.
//   • Joaillier → bijoux (ring / amulet / helmet) avec statBonus.
//   • Alchimiste→ potions (category consumable) avec useEffect (heal / mana).
// Une fois dans l'inventaire, les systèmes existants gèrent équipement (stats via
// effectiveStats), consommation (R/T + bouton Utiliser) et vente (sellItem).
import type { LootItem, UseEffect } from "../loot/LootRegistry";
import type { GearSlot, ItemCategory } from "../loot/gear";
import type { Rarity } from "../types";
import type { Rarity as ProfRarity } from "./professionTypes";
import { RECIPES } from "./professionCatalog";

const RARITY_MAP: Record<ProfRarity, Rarity> = {
  commun: "common", rare: "rare", epique: "epic", legendaire: "legendary",
};

interface Gameplay {
  slot?: GearSlot;
  statBonus?: Record<string, number>;
  useEffect?: UseEffect;
}

// Propriétés de gameplay par objet fabriqué (label/valeur/rareté viennent de la recette).
const GAMEPLAY: Record<string, Gameplay> = {
  // ── Forgeron : armes & armures ──────────────────────────────────────────────
  dague_fer:       { slot: "weapon", statBonus: { puissance: 6 } },
  epee_acier:      { slot: "weapon", statBonus: { puissance: 14 } },
  hache_raffinee:  { slot: "weapon", statBonus: { puissance: 26, critique: 4 } },
  lame_magique:    { slot: "weapon", statBonus: { puissance: 42, critique: 8 } },
  egide_lunaire:   { slot: "armor",  statBonus: { defense: 30, maxHp: 60 } },
  lame_adamantite: { slot: "weapon", statBonus: { puissance: 80, critique: 12 } },

  // ── Alchimiste : potions & élixirs ──────────────────────────────────────────
  potion_soin_min:       { useEffect: { heal: 50 } },
  elixir_vigueur:        { useEffect: { heal: 60, mana: 30 } },
  philtre_givre:         { useEffect: { mana: 90 } },
  decoction_arcanique:   { useEffect: { heal: 120, mana: 120 } },
  essence_concentree:    { useEffect: { mana: 200 } },
  panacee_eternelle:     { useEffect: { heal: 300, mana: 300 } },

  // ── Joaillier : bijoux ──────────────────────────────────────────────────────
  anneau_fer:        { slot: "ring",   statBonus: { puissance: 5 } },
  pendentif_acier:   { slot: "amulet", statBonus: { maxHp: 25 } },
  bague_givre:       { slot: "ring",   statBonus: { defense: 7, maxMana: 15 } },
  talisman_magique:  { slot: "amulet", statBonus: { puissance: 12, maxMana: 20, cdr: 8 } },
  diademe_lunaire:   { slot: "helmet", statBonus: { maxMana: 40, puissance: 10 } },
  // cdr = réduction de cooldown des ultimes (points %) → cf. effectiveStats.
  couronne_eternelle:{ slot: "helmet", statBonus: { puissance: 25, maxHp: 60, maxMana: 40, cdr: 15 } },
};

export const CRAFTED_ITEMS: Record<string, LootItem> = Object.fromEntries(
  RECIPES.map((r) => {
    const g = GAMEPLAY[r.output.itemId] ?? {};
    const category: ItemCategory = g.slot ? "equipment" : g.useEffect ? "consumable" : "material";
    const item: LootItem = {
      id: r.output.itemId,
      label: r.output.label,
      rarity: RARITY_MAP[r.output.rarity],
      value: r.output.value,
      statBonus: g.statBonus ?? {},
      icon: r.icon,
      slot: g.slot,
      category,
      useEffect: g.useEffect,
    };
    return [r.output.itemId, item];
  }),
);

/** Construit une instance fraîche du LootItem fabriqué (null si inconnu). */
export function craftedLootItem(itemId: string): LootItem | null {
  const base = CRAFTED_ITEMS[itemId];
  return base ? { ...base, statBonus: { ...base.statBonus }, useEffect: base.useEffect ? { ...base.useEffect } : undefined } : null;
}
