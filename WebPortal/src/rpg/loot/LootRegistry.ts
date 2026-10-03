// Port de LootRegistry.gd (Godot) → TypeScript
// Système de butin pondéré par zone et niveau ennemi

import type { Rarity } from "../types";
import type { GearSlot, ItemCategory } from "./gear";
import type { BodySlot } from "../characters/modular/bodySlots";
import { generateItem } from "./proceduralLoot";
import { WEAPON_LOOT } from "../weapons/weaponShop";

/**
 * Effet appliqué à l'utilisation d'un consommable. Tous les champs sont
 * optionnels — un même item peut combiner plusieurs (ex: potion mixte).
 */
export interface UseEffect {
  /** Soin instantané (HP). Clampé à maxHp côté stats. */
  heal?: number;
  /** Restauration instantanée de mana. */
  mana?: number;
  /** Régénération sur durée (HP/seconde × durée) — future extension. */
  regenHpPerSec?: number;
  /** Durée d'effet (s) pour les régénérations. */
  durationSec?: number;
  /**
   * Invoque un véhicule devant le joueur et embarque automatiquement.
   * Valeur = id d'un VEHICLE_CATALOG (chasseur_avion / longsword / phamtom /
   * vehicule_terrestre).
   */
  summonVehicle?: string;
  /** Répare 100% des PV du véhicule actuellement piloté. */
  repairVehicle?: boolean;
  /** Invoque un PET DE COMBAT (allié temporaire). Valeur = id de PET_SUMMONS. */
  summonPet?: string;
  /** Recharge des MUNITIONS (achat → « Utiliser » → réserve ammoStore). */
  addAmmo?: { kind: "arrows" | "cells"; count: number };
}

export interface LootItem {
  id: string;
  label: string;
  rarity: Rarity;
  /** Valeur en crédits */
  value: number;
  /** Bonus stats (clé → valeur) */
  statBonus: Partial<Record<string, number>>;
  icon: string; // emoji fallback
  /** Slot d'équipement (si défini → objet équipable). */
  slot?: GearSlot;
  /**
   * Emplacement de COMPOSITION (cf. characters/modular/bodySlots).
   *
   * Présent sur les pièces modulaires. Distinct de `slot` : celui-ci porte les
   * bonus et pilote le panneau RPG, `bodySlot` dit quel morceau de maillage
   * remplacer. Un blouson a les deux ; une tête n'a que `bodySlot` ; un
   * pantalon aussi, faute d'emplacement « jambes » dans `GearSlot`.
   */
  bodySlot?: BodySlot;
  /** Vignette rendue hors-ligne — remplace `icon` quand elle existe. */
  thumb?: string;
  /** Pack d'origine (`biker`, `wraith`, `echo`…). */
  source?: string;
  /** Catégorie d'inventaire (défaut : "resource"). */
  category?: ItemCategory;
  /** Poids (kg). Défaut calculé par type dans bags.itemWeight(). */
  weight?: number;
  /**
   * Couleur hex de rareté (présente sur les items procéduraux générés).
   * Utilisée par InventoryPanel pour la bordure colorée.
   */
  color?: string;
  /** Type d'item procédural (weapon / armor / tech_component / space_artifact). */
  kind?: string;
  /**
   * Effet à l'utilisation. Si défini, l'item est CONSOMMABLE :
   *   • Bouton "Utiliser" visible dans l'inventaire
   *   • Raccourcis clavier R (heal) / T (mana) ciblent ces items
   *   • L'item est retiré du sac après utilisation
   */
  useEffect?: UseEffect;
}

export const LOOT_CATALOG: Record<string, LootItem> = {
  // ── POTIONS — consommables instant (useEffect = heal/mana) ──────────────────
  // Utilisables via le bouton "Utiliser" dans l'inventaire ou les raccourcis
  // clavier R (potion de soin) / T (potion de mana).
  potion_soin_mineure:  { id: "potion_soin_mineure",  label: "Potion de Soin Mineure",  rarity: "common",    value: 25,  statBonus: {}, icon: "🧪", category: "consumable", useEffect: { heal: 40 } },
  potion_soin_majeure:  { id: "potion_soin_majeure",  label: "Potion de Soin Majeure",  rarity: "rare",      value: 80,  statBonus: {}, icon: "🩸", category: "consumable", useEffect: { heal: 120 } },
  potion_soin_supreme:  { id: "potion_soin_supreme",  label: "Élixir de Vie Suprême",   rarity: "epic",      value: 250, statBonus: {}, icon: "❤️‍🔥", category: "consumable", useEffect: { heal: 300 } },
  potion_mana_mineure:  { id: "potion_mana_mineure",  label: "Potion de Mana Mineure",  rarity: "common",    value: 25,  statBonus: {}, icon: "💧", category: "consumable", useEffect: { mana: 40 } },
  potion_mana_majeure:  { id: "potion_mana_majeure",  label: "Potion de Mana Majeure",  rarity: "rare",      value: 80,  statBonus: {}, icon: "🔮", category: "consumable", useEffect: { mana: 120 } },
  elixir_vital:         { id: "elixir_vital",         label: "Élixir Vital",            rarity: "legendary", value: 600, statBonus: {}, icon: "✨", category: "consumable", useEffect: { heal: 200, mana: 200 } },

  // ── CLÉ DE DONJON — consommée à l'entrée du Donjon Furiste (P1.2) ───────────
  key_donjon_furiste: { id: "key_donjon_furiste", label: "Clé du Donjon Furiste", rarity: "rare", value: 250, statBonus: {}, icon: "🗝️", category: "consumable" },

  // ── MUNITIONS — rechargent la réserve (archer = flèches, guerrier spatial = cellules) ──
  // Vendues à l'UNITÉ (1 crédit/unité) — achat direct en réserve via le sélecteur Quantité.
  ammo_arrows: { id: "ammo_arrows", label: "Flèche", rarity: "common", value: 1, statBonus: {}, icon: "🏹", category: "consumable", useEffect: { addAmmo: { kind: "arrows", count: 1 } } },
  ammo_cells:  { id: "ammo_cells",  label: "Cellule d'énergie", rarity: "common", value: 1, statBonus: {}, icon: "🔋", category: "consumable", useEffect: { addAmmo: { kind: "cells", count: 1 } } },

  // ── CLÉS D'INVOCATION DE VÉHICULES ─────────────────────────────────────────
  // Items consommables qui spawnent le véhicule correspondant devant le joueur
  // et l'embarquent automatiquement. Achetables chez le marchand de véhicules.
  key_chasseur_avion:    { id: "key_chasseur_avion",    label: "Clé Chasseur Avion",    rarity: "common",    value: 750,  statBonus: {}, icon: "🚀", category: "consumable", useEffect: { summonVehicle: "chasseur_avion" } },
  key_longsword:         { id: "key_longsword",         label: "Clé Longsword",          rarity: "rare",      value: 1500, statBonus: {}, icon: "🛸", category: "consumable", useEffect: { summonVehicle: "longsword" } },
  key_phamtom:           { id: "key_phamtom",           label: "Clé Fantôme Azur",       rarity: "epic",      value: 3000, statBonus: {}, icon: "✈️", category: "consumable", useEffect: { summonVehicle: "phamtom" } },
  key_vehicule_terrestre:{ id: "key_vehicule_terrestre",label: "Clé Véhicule Terrestre", rarity: "common",    value: 400,  statBonus: {}, icon: "🚙", category: "consumable", useEffect: { summonVehicle: "vehicule_terrestre" } },
  key_corvette:          { id: "key_corvette",          label: "Clé Corvette",           rarity: "rare",      value: 1400, statBonus: {}, icon: "🛰️", category: "consumable", useEffect: { summonVehicle: "corvette" } },
  key_interceptor:       { id: "key_interceptor",       label: "Clé Intercepteur",       rarity: "rare",      value: 1750, statBonus: {}, icon: "🚀", category: "consumable", useEffect: { summonVehicle: "interceptor" } },
  key_wraith:            { id: "key_wraith",            label: "Clé Wraith",             rarity: "epic",      value: 2250, statBonus: {}, icon: "🛸", category: "consumable", useEffect: { summonVehicle: "wraith" } },
  key_mech_niko:         { id: "key_mech_niko",         label: "Clé Mécha Niko",         rarity: "epic",      value: 2750, statBonus: {}, icon: "🤖", category: "consumable", useEffect: { summonVehicle: "mech_niko" } },
  key_eclaireur:         { id: "key_eclaireur",         label: "Clé Éclaireur",          rarity: "common",    value: 1000, statBonus: {}, icon: "🛩️", category: "consumable", useEffect: { summonVehicle: "eclaireur" } },
  key_destroyer:         { id: "key_destroyer",         label: "Clé Destroyer",          rarity: "legendary", value: 3500, statBonus: {}, icon: "🚀", category: "consumable", useEffect: { summonVehicle: "destroyer" } },
  key_corsaire:          { id: "key_corsaire",          label: "Clé Corsaire",           rarity: "epic",      value: 2000, statBonus: {}, icon: "🛸", category: "consumable", useEffect: { summonVehicle: "corsaire" } },
  key_raptor:            { id: "key_raptor",            label: "Clé Raptor",             rarity: "rare",      value: 1250, statBonus: {}, icon: "🚀", category: "consumable", useEffect: { summonVehicle: "raptor" } },
  key_croiseur:          { id: "key_croiseur",          label: "Clé Croiseur",           rarity: "epic",      value: 2750, statBonus: {}, icon: "🛰️", category: "consumable", useEffect: { summonVehicle: "croiseur" } },
  key_faucon:            { id: "key_faucon",            label: "Clé Faucon",             rarity: "rare",      value: 1500, statBonus: {}, icon: "🦅", category: "consumable", useEffect: { summonVehicle: "faucon" } },
  key_sentinel:          { id: "key_sentinel",          label: "Clé Sentinelle",         rarity: "epic",      value: 2250, statBonus: {}, icon: "🛸", category: "consumable", useEffect: { summonVehicle: "sentinel" } },
  key_dreadnought:       { id: "key_dreadnought",       label: "Clé Dreadnought",        rarity: "legendary", value: 4500, statBonus: {}, icon: "⚓", category: "consumable", useEffect: { summonVehicle: "dreadnought" } },
  key_chasseur_tie:      { id: "key_chasseur_tie",      label: "Clé Chasseur TIE",       rarity: "rare",      value: 1600, statBonus: {}, icon: "🛸", category: "consumable", useEffect: { summonVehicle: "chasseur_tie" } },
  key_mech_combat:       { id: "key_mech_combat",       label: "Clé Mécha Combat",       rarity: "epic",      value: 3000, statBonus: {}, icon: "🤖", category: "consumable", useEffect: { summonVehicle: "mech_combat" } },
  key_wraith_armed:      { id: "key_wraith_armed",      label: "Clé Wraith Armé",       rarity: "epic",      value: 2750, statBonus: {}, icon: "🔫", category: "consumable", useEffect: { summonVehicle: "wraith_armed" } },

  // ── PIERRES D'INVOCATION (pets de combat — alliés temporaires) ──────────────
  summon_loup: { id: "summon_loup", label: "Pierre d'Invocation : Loup", rarity: "common", value: 500, statBonus: {}, icon: "🐺", category: "consumable", useEffect: { summonPet: "loup" } },
  summon_lion: { id: "summon_lion", label: "Pierre d'Invocation : Lion", rarity: "rare",   value: 900, statBonus: {}, icon: "🦁", category: "consumable", useEffect: { summonPet: "lion" } },

  // Kit de réparation : achetable chez le garagiste, restaure 100% PV du
  // véhicule actuellement piloté. Refusé silencieusement si pas en pilotage.
  repair_kit:            { id: "repair_kit",            label: "Kit de Réparation",      rarity: "common",    value: 1000, statBonus: {}, icon: "🔧", category: "consumable", useEffect: { repairVehicle: true } },

  // ── Ressources / matériaux (non équipables, non consommables instant) ──────
  fragment_vie:    { id: "fragment_vie",    label: "Fragment de Vie",     rarity: "common",    value: 5,   statBonus: { maxHp: 10 },       icon: "💚", category: "consumable" },
  cristal_energie: { id: "cristal_energie", label: "Cristal d'Énergie",   rarity: "common",    value: 8,   statBonus: { maxMana: 10 },      icon: "💠", category: "consumable" },
  adn_alien:       { id: "adn_alien",       label: "ADN Alien",            rarity: "rare",      value: 50,  statBonus: { puissance: 5 },     icon: "🧬", category: "material" },
  metal_rare:      { id: "metal_rare",      label: "Métal Rare",           rarity: "rare",      value: 60,  statBonus: { defense: 5 },       icon: "⚙️", category: "material" },
  noyau_plasma:    { id: "noyau_plasma",    label: "Noyau Plasma",         rarity: "epic",      value: 200, statBonus: { puissance: 15 },    icon: "🔥", category: "material" },
  nano_composant:  { id: "nano_composant",  label: "Nano-Composant",       rarity: "epic",      value: 180, statBonus: { defense: 10, maxHp: 20 }, icon: "🔩", category: "material" },
  powernax:        { id: "powernax",        label: "POWERNAX",             rarity: "legendary", value: 800, statBonus: { puissance: 30, maxMana: 30 }, icon: "⚡", category: "resource" },
  powertox:        { id: "powertox",        label: "POWERTOX",             rarity: "epic",      value: 250, statBonus: { critique: 8 },      icon: "☠️", category: "resource" },
  voidcore:        { id: "voidcore",        label: "Noyau du Vide",        rarity: "legendary", value: 1200,statBonus: { puissance: 50 },    icon: "🌀", category: "resource" },
  cryon_x:         { id: "cryon_x",         label: "CRYON-X",              rarity: "legendary", value: 950, statBonus: { defense: 25, maxHp: 50 }, icon: "❄️", category: "resource" },

  // ── Équipement (slot défini → équipable, modifie les stats) ─────────────────
  plasma_blade:    { id: "plasma_blade",    label: "Lame Plasma",          rarity: "rare",      value: 120, statBonus: { puissance: 12 },               icon: "🗡️", slot: "weapon" },
  void_saber:      { id: "void_saber",      label: "Sabre du Vide",        rarity: "legendary", value: 700, statBonus: { puissance: 38, critique: 6 },   icon: "⚔️", slot: "weapon" },
  cyber_armor:     { id: "cyber_armor",     label: "Armure Cybernétique",  rarity: "epic",      value: 300, statBonus: { defense: 20, maxHp: 30 },       icon: "🛡️", slot: "armor" },
  combat_helmet:   { id: "combat_helmet",   label: "Casque de Combat",     rarity: "rare",      value: 90,  statBonus: { defense: 8, maxHp: 15 },        icon: "⛑️", slot: "helmet" },
  combat_gloves:   { id: "combat_gloves",   label: "Gantelets de Combat",  rarity: "rare",      value: 80,  statBonus: { puissance: 6, critique: 3 },     icon: "🧤", slot: "gloves" },
  combat_boots:    { id: "combat_boots",    label: "Bottes de Combat",     rarity: "common",    value: 45,  statBonus: { defense: 4 },                    icon: "🥾", slot: "boots" },
  guard_belt:      { id: "guard_belt",      label: "Ceinture de Garde",    rarity: "rare",      value: 70,  statBonus: { maxHp: 25 },                     icon: "🎗️", slot: "belt" },
  tactical_cape:   { id: "tactical_cape",   label: "Cape Tactique",        rarity: "epic",      value: 160, statBonus: { defense: 8, maxMana: 20 },       icon: "🧥", slot: "cape" },
  void_amulet:     { id: "void_amulet",     label: "Amulette du Vide",     rarity: "epic",      value: 220, statBonus: { maxMana: 30, puissance: 8 },    icon: "📿", slot: "amulet" },
  power_ring:      { id: "power_ring",       label: "Anneau de Puissance",  rarity: "rare",      value: 110, statBonus: { puissance: 7 },                  icon: "💍", slot: "ring" },
  ward_ring:       { id: "ward_ring",        label: "Anneau de Protection", rarity: "rare",     value: 110, statBonus: { defense: 7, maxHp: 10 },         icon: "💍", slot: "ring" },
  plasma_shield:   { id: "plasma_shield",   label: "Bouclier Plasma",      rarity: "epic",      value: 200, statBonus: { defense: 18 },                   icon: "🛡️", slot: "offhand" },

  // ── ARMES vendables (générées depuis le catalogue d'armes 3D, cf. weaponShop) ──
  // Spread DANS le littéral (pas d'Object.assign après coup) → présentes dès l'évaluation
  // du module, aucun consommateur top-level ne peut les manquer.
  ...WEAPON_LOOT,
};

// Pools pondérés par zone (id → poids)
const ZONE_POOLS: Record<string, Array<{ id: string; weight: number }>> = {
  spore: [
    { id: "fragment_vie",    weight: 40 },
    { id: "cristal_energie", weight: 35 },
    { id: "adn_alien",       weight: 15 },
    { id: "powertox",        weight: 8  },
    { id: "voidcore",        weight: 2  },
  ],
  space: [
    { id: "cristal_energie", weight: 35 },
    { id: "metal_rare",      weight: 25 },
    { id: "noyau_plasma",    weight: 15 },
    { id: "nano_composant",  weight: 12 },
    { id: "powernax",        weight: 8  },
    { id: "voidcore",        weight: 3  },
    { id: "cryon_x",         weight: 2  },
  ],
  forge: [
    { id: "fragment_vie",    weight: 22 },
    { id: "metal_rare",      weight: 18 },
    { id: "combat_boots",    weight: 14 },
    { id: "combat_helmet",   weight: 12 },
    { id: "combat_gloves",   weight: 11 },
    { id: "power_ring",      weight: 9  },
    { id: "plasma_blade",    weight: 8  },
    { id: "cyber_armor",     weight: 6  },
    { id: "void_amulet",     weight: 4  },
    { id: "powernax",        weight: 3  },
    { id: "cryon_x",         weight: 3  },
  ],
};

const DEFAULT_POOL = ZONE_POOLS.forge;

/**
 * Convertit un ProceduralItem en LootItem compatible avec le reste du système.
 * Les champs manquants (`icon`, `statBonus`) sont dérivés du type procédural.
 */
function proceduralToLootItem(proc: ReturnType<typeof generateItem>): LootItem {
  const ICON_BY_KIND: Record<string, string> = {
    weapon:         "⚔️",
    armor:          "🛡️",
    tech_component: "🔩",
    space_artifact: "🌀",
  };
  return {
    id:        proc.id,
    label:     proc.name,
    rarity:    proc.rarity as Rarity,   // ProceduralRarity ⊂ Rarity
    value:     proc.value,
    statBonus: { ...proc.stats },
    icon:      ICON_BY_KIND[proc.kind] ?? "✨",
    category:  "resource" as ItemCategory,
    color:     proc.color,
    kind:      proc.kind,
  };
}

/** Tire 1 à `count` objets de butin pondérés pour une zone + niveau ennemi. */
export function rollLoot(zoneId: string, enemyLevel: number, count = 1): LootItem[] {
  const pool = ZONE_POOLS[zoneId] ?? DEFAULT_POOL;
  const totalWeight = pool.reduce((s, e) => s + e.weight, 0);
  const items: LootItem[] = [];

  // Niveau élevé = chance de rareté bonus
  const rarityBonus = Math.min(3, Math.floor(enemyLevel / 5));

  for (let i = 0; i < count; i++) {
    // ── Drop procédural (50 % de chance) ou drop du catalogue de zone ──────────
    if (Math.random() < 0.5) {
      items.push(proceduralToLootItem(generateItem(enemyLevel, Math.random)));
    } else {
      let roll = Math.random() * totalWeight;
      for (const entry of pool) {
        roll -= entry.weight;
        if (roll <= 0) {
          const item = LOOT_CATALOG[entry.id];
          if (item) items.push(item);
          break;
        }
      }
    }
    // Chance de bonus drop rareté (1 par tranche de 5 niveaux)
    if (rarityBonus > 0 && Math.random() < rarityBonus * 0.05) {
      const epics = Object.values(LOOT_CATALOG).filter(
        (it) => it.rarity === "epic" || it.rarity === "legendary"
      );
      const bonus = epics[Math.floor(Math.random() * epics.length)];
      if (bonus) items.push(bonus);
    }
  }
  return items;
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common:    "#aaaaaa",
  rare:      "#4a9eff",
  epic:      "#a855f7",
  legendary: "#f59e0b",
  mythic:    "#ef4444",
  alien:     "#22c55e",
  divine:    "#f0f",
};
