// ══════════════════════════════════════════════════════════════════════════════
// npc/merchants.ts — Marchands PNJ (6 types) + économie d'achat/vente
//
// Stock dérivé de LOOT_CATALOG. Prix d'ACHAT dynamiques selon la rareté ;
// prix de VENTE = valeur × buyFactor du marchand. Modèles = PNJ Meshy non hostiles.
// ══════════════════════════════════════════════════════════════════════════════

import type { Rarity } from "../types";
import { LOOT_CATALOG, type LootItem } from "../loot/LootRegistry";
import { weaponShopIds } from "../weapons/weaponShop";
import { MODULAR_ITEMS, getModularItem, partIdOfItem } from "../loot/modularItems";
import { SLOT_CATEGORY, slotSource, type BodySlot } from "../characters/modular/bodySlots";
import { getPart } from "../characters/modular/partCatalog";
import { isInCreator } from "../characters/modular/anatomySources";

/**
 * Stock de l'équipementier : toutes les pièces modulaires PORTÉES.
 *
 * L'anatomie (tête, buste nu, mains…) est exclue : on n'achète pas un torse.
 *
 * ── DEUX RÈGLES, PARCE QU'UNE NE SUFFIT PAS (05/08/2026) ─────────────────────
 *
 * 1. L'emplacement est un emplacement d'équipement (`slotSource`). C'est le cas
 *    évident : casque, plastron, bottes.
 *
 * 2. L'emplacement est anatomique, mais la pièce n'est PAS un corps nu. Le
 *    découpeur classe par la région couverte, pas par la nature : une veste de
 *    zombie sort en région `torso`, des bottes en `feet`. Le créateur les refuse
 *    désormais (`isCreatorPart`) — sans cette deuxième règle, elles ne seraient
 *    plus nulle part. Le stock du marchand est le complément EXACT de ce que le
 *    créateur propose : c'est ce que vérifie le test de partition.
 */
export function modularGearIds(): string[] {
  return MODULAR_ITEMS.filter((item) => {
    const partId = partIdOfItem(item.id);
    const part = partId ? getPart(partId) : undefined;
    if (!part) return false;
    // Complément EXACT de ce que le créateur propose : une pièce est ici si et
    // seulement si elle n'y est pas. Écrit ainsi, les deux ne peuvent pas
    // laisser un trou — c'est ce que vérifie le test de partition.
    return !isInCreator(part);
  }).map((item) => item.id);
}

export type MerchantType = "potions" | "weapons" | "armor" | "resources" | "magic" | "general" | "vehicles";

export interface MerchantDef {
  id: string;
  type: MerchantType;
  name: string;
  subtitle: string;
  /** Dossier du modèle Meshy (PNJ avec GLB valide). */
  folder: string;
  /** Réplique de dialogue affichée à l'ouverture. */
  greeting: string;
  /** Objets en vente (ids LOOT_CATALOG). */
  stock: string[];
  /** Ratio de rachat (vente joueur → marchand). */
  buyFactor: number;
}

export const MERCHANTS: MerchantDef[] = [
  {
    id: "mer_potions", type: "potions", name: "Lyra", subtitle: "Apothicaire",
    folder: "soldat_femme", buyFactor: 0.35,
    greeting: "Fatigué, aventurier ? J'ai de quoi te remettre d'aplomb.",
    stock: ["fragment_vie", "cristal_energie"],
  },
  {
    id: "mer_weapons", type: "weapons", name: "Forgemaître Kael", subtitle: "Armurier-Forgeron",
    folder: "gran_cheff", buyFactor: 0.4,
    greeting: "De l'acier, du plasma, du vide… choisis ton tranchant.",
    // Armes plasma/vide existantes + TOUT le catalogue d'armes 3D (épées/haches/arcs/bâtons/
    // futuristes…), priées par catégorie (cf. weaponShop).
    stock: ["ammo_arrows", "ammo_cells", "plasma_blade", "void_saber", "plasma_shield", ...weaponShopIds()],
  },
  {
    id: "mer_armor", type: "armor", name: "Brunha", subtitle: "Armurière",
    folder: "soldat_vert", buyFactor: 0.4,
    greeting: "Une bonne armure vaut mille soins. Regarde mes pièces.",
    stock: ["cyber_armor", "combat_helmet", "combat_gloves", "combat_boots", "guard_belt", "tactical_cape"],
  },
  {
    id: "mer_resources", type: "resources", name: "Drog", subtitle: "Négociant en Ressources",
    folder: "soldat_mercenaire", buyFactor: 0.5,
    greeting: "Matériaux bruts, composants rares — je rachète tout aussi.",
    // Les outils de récolte : sans eux, 5 gisements sur 6 étaient impossibles à
    // exploiter — ils n'étaient ni dans un butin, ni dans un stock, ni dans une
    // recette (audit du 2026-09-11, AUDIT_SYSTEMES §5 n°4). Drog vend ce qu'on
    // récolte ; il vend donc aussi de quoi récolter.
    stock: ["metal_rare", "nano_composant", "adn_alien", "noyau_plasma", "pioche", "foreuse", "collecteur"],
  },
  {
    id: "mer_magic", type: "magic", name: "Oracle Vesh", subtitle: "Marchand Arcanique",
    folder: "sou_major", buyFactor: 0.45,
    greeting: "L'arcane a un prix. Anneaux, amulettes, reliques du vide… et bêtes liées.",
    stock: ["key_donjon_furiste", "void_amulet", "power_ring", "ward_ring", "powertox", "voidcore", "summon_loup", "summon_lion"],
  },
  {
    id: "mer_general", type: "general", name: "Marchand Errant", subtitle: "Bazar Général",
    folder: "general", buyFactor: 0.3,
    greeting: "Un peu de tout, pour tous les goûts. Que te faut-il ?",
    stock: ["fragment_vie", "cristal_energie", "combat_boots", "power_ring", "metal_rare", "plasma_blade"],
  },
  {
    id: "mer_vehicles", type: "vehicles", name: "Garagiste Talen", subtitle: "Vendeur de Véhicules",
    folder: "mercenaire_tank", buyFactor: 0.4,
    greeting: "Tu veux du métal qui roule ou qui vole ? Choisis ton style.",
    stock: [
      "key_vehicule_terrestre", // 400 cr  — accessible à tous, résistant
      "key_chasseur_avion",      // 750 cr  — équilibré
      "key_longsword",           // 1500 cr — rapide
      "key_phamtom",             // 3000 cr — résistant + boost sorts
      "key_corvette",            // 2800 cr — explorateur rapide
      "key_interceptor",         // 3500 cr — très rapide, fragile
      "key_wraith",              // 4500 cr — gunship polyvalent
      "key_mech_niko",           // 5500 cr — mécha lourd résistant
      "key_eclaireur",           // 2000 cr — rapide, fragile
      "key_raptor",              // 2500 cr — agile
      "key_faucon",              // 3000 cr — polyvalent
      "key_chasseur_tie",        // 3200 cr — ultra-rapide, fragile
      "key_corsaire",            // 4000 cr — spell boost
      "key_sentinel",            // 4500 cr — défensif, sorts
      "key_croiseur",            // 5500 cr — tanky
      "key_destroyer",           // 7000 cr — cuirassé lourd
      "key_wraith_armed",        // 5500 cr — wraith avec tourelle
      "key_mech_combat",         // 6000 cr — mécha de combat
      "key_dreadnought",         // 9000 cr — forteresse volante
      "repair_kit",              // 1000 cr — restaure 100% PV véhicule
    ],
  },

  // ── ÉQUIPEMENTIER — ce que le créateur de personnage ne donne plus ──────────
  //
  // Casques, plastrons, gants, bottes, sacs : depuis le 03/08/2026 ils ne se
  // choisissent plus à la création (cf. `slotSource`). Le joueur démarre avec
  // `starterOutfit` seule et s'équipe ici. Le stock est CALCULÉ à partir de la
  // même règle — impossible qu'une pièce sorte du créateur sans arriver en
  // rayon, ni l'inverse.
  {
    id: "mer_equipement", type: "armor", name: "Vasska", subtitle: "Équipementier",
    folder: "soldat_femme", buyFactor: 0.4,
    greeting: "Tu es venu avec ce que tu portes. Repars avec mieux.",
    stock: modularGearIds(),
  },
];

export function getMerchant(id: string): MerchantDef | undefined {
  return MERCHANTS.find((m) => m.id === id);
}

/**
 * Objets en vente résolus (filtre les ids inconnus).
 *
 * Deux catalogues, consultés dans cet ordre : le butin statique
 * (`LOOT_CATALOG`), puis les pièces modulaires (`getModularItem`, ids préfixés
 * `part:`). Elles ne sont PAS fusionnées dans `LOOT_CATALOG` : `modularItems`
 * importe déjà `LootRegistry` pour ses types, et l'import inverse fermerait un
 * cycle. La résolution en cascade donne le même service sans ce risque.
 */
export function merchantStock(def: MerchantDef): LootItem[] {
  return def.stock
    .map((id) => LOOT_CATALOG[id] ?? getModularItem(id))
    .filter((it): it is LootItem => !!it);
}

// ── Prix dynamiques par rareté ────────────────────────────────────────────────
const RARITY_PRICE_MULT: Record<Rarity, number> = {
  common: 1, rare: 1.4, epic: 2, legendary: 3, mythic: 4, alien: 2.5, divine: 5,
};

/** Prix d'achat (marchand → joueur), majoré selon la rareté. */
export function buyPrice(item: LootItem): number {
  return Math.round(item.value * (RARITY_PRICE_MULT[item.rarity] ?? 1));
}

/** Prix de revente (joueur → marchand). */
export function sellPrice(item: LootItem, buyFactor: number): number {
  return Math.max(1, Math.floor(item.value * buyFactor));
}
