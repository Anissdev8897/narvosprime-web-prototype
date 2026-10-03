// ══════════════════════════════════════════════════════════════════════════════
// loot/modularItems.ts — Les pièces découpées deviennent des objets d'inventaire.
//
// Chaque entrée de `partCatalog` (pack Biker + 39 pièces extraites des héros)
// est exposée comme `LootItem`. Une pièce devient donc ramassable, stockable,
// vendable — et l'équiper change la GÉOMÉTRIE du personnage, pas seulement ses
// statistiques.
//
// ── DEUX VOCABULAIRES D'EMPLACEMENTS, VOLONTAIREMENT DISTINCTS ───────────────
//
// `GearSlot` (helmet · armor · boots · ring…) est le vocabulaire RPG historique :
// il porte les bonus de stats et pilote le panneau d'équipement.
// `BodySlot` (top · pants · shoes · head · torso…) est le vocabulaire de
// COMPOSITION : il dit quel morceau de maillage remplacer.
//
// Les fusionner casserait le loot existant. Un objet porte donc les deux quand
// les deux ont un sens : un blouson est `slot: "armor"` ET `bodySlot: "top"`.
//
// ⚠ TROU MESURÉ DANS `GearSlot` : il n'existe AUCUN emplacement pour les jambes.
// helmet · amulet · armor · cape · gloves · belt · ring · boots · weapon ·
// offhand — un pantalon n'est pas équipable dans le système actuel. Les pièces
// `pants` sortent donc avec `bodySlot` seul, sans `slot`. Elles s'équipent par
// la composition, pas par le panneau RPG, tant que `GearSlot` n'a pas de
// `legs`. Ajouter cet emplacement est une décision de gameplay, pas un détail
// technique — d'où le choix de ne pas l'inventer ici.
//
// ── PIÈCES D'ANATOMIE ────────────────────────────────────────────────────────
//
// Têtes, bustes, bras… n'ont aucun `GearSlot` et n'en auront pas : ce ne sont
// pas des équipements mais des variantes de corps. Elles restent des objets
// (catégorie `material`) pour pouvoir être débloquées, échangées ou vendues,
// mais ne s'équipent que par l'éditeur de personnage.
// ══════════════════════════════════════════════════════════════════════════════

import type { LootItem } from "./LootRegistry";
import type { GearSlot } from "./gear";
import type { Rarity } from "../types";
import { type BodySlot, SLOT_CATEGORY, SLOT_LABELS } from "../characters/modular/bodySlots";
import { MODULAR_PARTS, type ModularPart } from "../characters/modular/partCatalog";
import thumbs from "../../data/part-thumbs.json";
import compat from "../../data/part-compat.json";

const THUMBS = thumbs as Record<string, string>;

interface CompatRow { id: string; coverageByWeight: number }
const COMPAT = new Map((compat as CompatRow[]).map((r) => [r.id, r.coverageByWeight]));

/** Préfixe d'identifiant — évite toute collision avec le loot existant. */
export const MODULAR_ITEM_PREFIX = "part:";

/**
 * Emplacement RPG correspondant à un emplacement de corps, si tant est qu'il
 * existe. `undefined` = la pièce ne passe pas par le panneau d'équipement.
 */
export function gearSlotForBodySlot(slot: BodySlot): GearSlot | undefined {
  switch (slot) {
    case "top": return "armor";
    case "shoes": return "boots";
    case "gloves": return "gloves";
    case "headwear": return "helmet";
    case "back": return "cape";
    case "accessory": return "ring";
    // `pants` est ABSENT à dessein : `GearSlot` n'a pas d'emplacement jambes.
    default: return undefined;
  }
}

/**
 * Rareté déduite de la compatibilité mesurée.
 *
 * Ce n'est pas décoratif : une pièce qui ne se lie qu'à moitié est de fait plus
 * rare à utiliser, et l'afficher en gris alors qu'elle refusera de s'équiper
 * serait trompeur. Les pièces du pack de base restent communes.
 */
function rarityOf(part: ModularPart): Rarity {
  if (part.source === "biker") return "common";
  const couverture = COMPAT.get(part.id);
  if (couverture === undefined) return "rare";
  if (couverture < 0.5) return "legendary";   // ne se lie nulle part → pièce unique
  if (couverture < 0.9) return "epic";        // s'assemble, mais fortement retaillée
  return "rare";
}

/** Valeur en crédits — indicative, alignée sur l'échelle de rareté du projet. */
const VALUE_BY_RARITY: Partial<Record<Rarity, number>> = {
  common: 40, rare: 350, epic: 900, legendary: 2200,
  mythic: 5000, alien: 8000, divine: 15000,
};

const ICON_BY_CATEGORY: Record<string, string> = {
  anatomy: "🧬", clothing: "🧥", accessory: "💍",
};

/** Un objet d'inventaire pour une pièce modulaire. */
export function itemFromPart(part: ModularPart): LootItem {
  const rarity = rarityOf(part);
  const gear = gearSlotForBodySlot(part.slot);
  const cat = SLOT_CATEGORY[part.slot];

  return {
    id: MODULAR_ITEM_PREFIX + part.id,
    label: part.label,
    rarity,
    value: VALUE_BY_RARITY[rarity] ?? 40,
    // Aucun bonus : ces pièces changent l'apparence, pas la puissance. Leur en
    // donner ferait de la personnalisation un choix d'optimisation.
    statBonus: {},
    icon: ICON_BY_CATEGORY[cat] ?? "🧩",
    slot: gear,
    // Sans `GearSlot`, l'item n'est pas « equipment » : le ranger là le ferait
    // apparaître dans un panneau qui ne peut pas l'équiper.
    category: gear ? "equipment" : "material",
    bodySlot: part.slot,
    thumb: THUMBS[part.id],
    source: part.source,
  };
}

/** Catalogue complet des pièces modulaires vues comme objets. */
export const MODULAR_ITEMS: LootItem[] = MODULAR_PARTS.map(itemFromPart);

const BY_ID = new Map(MODULAR_ITEMS.map((i) => [i.id, i]));

export function getModularItem(id: string): LootItem | undefined { return BY_ID.get(id); }

/** Un identifiant d'objet désigne-t-il une pièce modulaire ? */
export function isModularItem(id: string): boolean { return id.startsWith(MODULAR_ITEM_PREFIX); }

/** Identifiant de PIÈCE derrière un identifiant d'objet, ou `undefined`. */
export function partIdOfItem(itemId: string): string | undefined {
  return isModularItem(itemId) ? itemId.slice(MODULAR_ITEM_PREFIX.length) : undefined;
}

/**
 * Objets regroupés par emplacement de corps — vue « composition » de
 * l'inventaire, celle qui remplace les listes codées en dur.
 */
export function modularItemsBySlot(): Map<BodySlot, LootItem[]> {
  const out = new Map<BodySlot, LootItem[]>();
  for (const item of MODULAR_ITEMS) {
    if (!item.bodySlot) continue;
    const list = out.get(item.bodySlot);
    if (list) list.push(item);
    else out.set(item.bodySlot, [item]);
  }
  return out;
}

/** Libellé d'emplacement pour l'UI d'inventaire. */
export function slotLabel(slot: BodySlot): string { return SLOT_LABELS[slot]; }
