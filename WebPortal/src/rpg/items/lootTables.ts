// ══════════════════════════════════════════════════════════════════════════════
// items/lootTables.ts — Tables de butin pondérées par rareté et niveau
//
// Système de loot professionnel avec :
//   - Pools pondérés par zone/map
//   - Roll par rareté avec bonus de niveau
//   - Génération procédurale d'équipement
// ══════════════════════════════════════════════════════════════════════════════

import type { ItemDefinition, ItemStats, Rarity } from "./ItemDefinition";
import { ITEM_DB } from "./itemCatalog";

// ── Entrée d'une table de butin ─────────────────────────────────────────────
export interface LootTableEntry {
  /** ID de l'item (dans ITEM_DB) */
  itemId: string;
  /** Poids de drop (plus haut = plus fréquent) */
  weight: number;
  /** Quantité minimale */
  minCount: number;
  /** Quantité maximale */
  maxCount: number;
}

// ── Table de butin ──────────────────────────────────────────────────────────
export interface LootTable {
  id: string;
  label: string;
  entries: LootTableEntry[];
  /** Nombre de drops à générer (avant multiplicateur de niveau) */
  baseDropCount: number;
}

// ── Résultat de loot ────────────────────────────────────────────────────────
export interface LootRollResult {
  itemId: string;
  quantity: number;
}

// ── Paramètres de génération de loot ────────────────────────────────────────
export interface LootGenerationParams {
  zone: string;
  enemyLevel: number;
  /** Multiplicateur de drops (boss = 3, élite = 2, normal = 1) */
  dropMultiplier?: number;
  /** Seed optionnelle pour reproductibilité */
  seed?: number;
}

// ── Tables de butin prédéfinies par zone ────────────────────────────────────
export const LOOT_TABLES: Record<string, LootTable> = {
  // Zone "spore" (début)
  spore: {
    id: "spore",
    label: "Zone Spore",
    baseDropCount: 2,
    entries: [
      { itemId: "fragment_vie",    weight: 40, minCount: 1, maxCount: 3 },
      { itemId: "cristal_energie", weight: 35, minCount: 1, maxCount: 3 },
      { itemId: "potion_soin_mineure", weight: 30, minCount: 1, maxCount: 2 },
      { itemId: "ammo_cells",      weight: 25, minCount: 2, maxCount: 5 },
      { itemId: "adn_alien",       weight: 15, minCount: 1, maxCount: 1 },
      { itemId: "combat_boots",    weight: 10, minCount: 1, maxCount: 1 },
      { itemId: "power_ring",      weight: 5,  minCount: 1, maxCount: 1 },
    ],
  },

  // Zone "space" (milieu)
  space: {
    id: "space",
    label: "Espace",
    baseDropCount: 3,
    entries: [
      { itemId: "cristal_energie", weight: 35, minCount: 1, maxCount: 5 },
      { itemId: "metal_rare",      weight: 25, minCount: 1, maxCount: 2 },
      { itemId: "noyau_plasma",    weight: 15, minCount: 1, maxCount: 1 },
      { itemId: "potion_soin_majeure", weight: 20, minCount: 1, maxCount: 2 },
      { itemId: "plasma_blade",    weight: 10, minCount: 1, maxCount: 1 },
      { itemId: "void_amulet",     weight: 8,  minCount: 1, maxCount: 1 },
      { itemId: "powernax",        weight: 3,  minCount: 1, maxCount: 1 },
    ],
  },

  // Zone "forge" (test/équipement)
  forge: {
    id: "forge",
    label: "Forge",
    baseDropCount: 2,
    entries: [
      { itemId: "fragment_vie",    weight: 22, minCount: 1, maxCount: 3 },
      { itemId: "metal_rare",      weight: 18, minCount: 1, maxCount: 2 },
      { itemId: "combat_boots",    weight: 14, minCount: 1, maxCount: 1 },
      { itemId: "combat_helmet",   weight: 12, minCount: 1, maxCount: 1 },
      { itemId: "combat_gloves",   weight: 11, minCount: 1, maxCount: 1 },
      { itemId: "power_ring",      weight: 9,  minCount: 1, maxCount: 1 },
      { itemId: "plasma_blade",    weight: 8,  minCount: 1, maxCount: 1 },
      { itemId: "cyber_armor",     weight: 6,  minCount: 1, maxCount: 1 },
      { itemId: "void_amulet",     weight: 4,  minCount: 1, maxCount: 1 },
      { itemId: "powernax",        weight: 3,  minCount: 1, maxCount: 1 },
    ],
  },

  // Butin de boss
  boss: {
    id: "boss",
    label: "Boss",
    baseDropCount: 4,
    entries: [
      { itemId: "noyau_plasma",    weight: 30, minCount: 1, maxCount: 3 },
      { itemId: "void_saber",      weight: 15, minCount: 1, maxCount: 1 },
      { itemId: "plasma_shield",   weight: 15, minCount: 1, maxCount: 1 },
      { itemId: "cyber_armor",     weight: 20, minCount: 1, maxCount: 1 },
      { itemId: "void_amulet",     weight: 20, minCount: 1, maxCount: 1 },
      { itemId: "powernax",        weight: 25, minCount: 1, maxCount: 2 },
      { itemId: "ward_ring",       weight: 18, minCount: 1, maxCount: 1 },
    ],
  },
};

// ── Tables de rareté pondérées ──────────────────────────────────────────────
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common:    55,
  rare:      25,
  epic:      12,
  legendary: 5,
  mythic:    2,
  alien:     1,
  divine:    0,
};

/**
 * Tire une rareté pondérée par les poids ci-dessus,
 * avec bonus selon le niveau de l'ennemi.
 */
export function rollRarity(
  enemyLevel: number,
  rng: () => number
): Rarity {
  const bonus = Math.min(10, Math.floor(enemyLevel / 3));
  const adjusted: Record<string, number> = {};

  // Plus l'ennemi est haut niveau, plus les raretés hautes sont favorisées
  const rareties: Rarity[] = ["common", "rare", "epic", "legendary", "mythic", "alien", "divine"];
  for (const r of rareties) {
    const idx = rareties.indexOf(r);
    adjusted[r] = Math.max(1, RARITY_WEIGHTS[r] + bonus * (idx - 1));
  }

  const total = Object.values(adjusted).reduce((a, b) => a + b, 0);
  let roll = rng() * total;

  for (const r of rareties) {
    roll -= adjusted[r];
    if (roll <= 0) return r;
  }

  return "common";
}

/**
 * Lance un drop depuis une table de butin.
 * Retourne un tableau d'items dropés.
 */
export function rollLootTable(
  tableId: string,
  params: LootGenerationParams,
  rng: () => number = Math.random
): LootRollResult[] {
  const table = LOOT_TABLES[tableId];
  if (!table) return [];

  const multiplier = params.dropMultiplier ?? 1;
  const count = Math.round(table.baseDropCount * multiplier);
  const results: LootRollResult[] = [];

  for (let i = 0; i < count; i++) {
    const roll = rollTableEntry(table, rng);
    if (!roll) continue;

    // Bonus quantité selon niveau
    const qtyBonus = Math.min(3, Math.floor(params.enemyLevel / 5));
    const quantity = roll.minCount + Math.floor(rng() * (roll.maxCount - roll.minCount + 1)) + qtyBonus;

    // Fusion avec une entrée existante du même type
    const existing = results.find((r) => r.itemId === roll.itemId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      results.push({ itemId: roll.itemId, quantity });
    }
  }

  return results;
}

/**
 * Tire une entrée dans une table selon les poids.
 */
function rollTableEntry(
  table: LootTable,
  rng: () => number
): LootTableEntry | null {
  const totalWeight = table.entries.reduce((s, e) => s + e.weight, 0);
  if (totalWeight <= 0) return null;

  let roll = rng() * totalWeight;
  for (const entry of table.entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }

  return table.entries[table.entries.length - 1] ?? null;
}

/**
 * Raccourci : drop depuis une zone + niveau.
 */
export function zoneDrop(
  zone: string,
  enemyLevel: number,
  rng: () => number = Math.random
): LootRollResult[] {
  const table = LOOT_TABLES[zone];
  if (!table) return [];
  return rollLootTable(zone, { zone, enemyLevel }, rng);
}

/**
 * Convertit un résultat de loot en instances d'items.
 */
export function lootResultsToInstances(
  results: LootRollResult[]
): Array<{ def: ItemDefinition; quantity: number }> {
  return results
    .map((r) => {
      const def = ITEM_DB[r.itemId];
      if (!def) return null;
      return { def, quantity: r.quantity };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}
