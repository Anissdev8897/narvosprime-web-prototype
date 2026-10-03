// Inventaire joueur + gestion équipement (slots pied, tête, etc.)
// Construit sur LootItem — les items peuvent s'équiper selon leur type

import type { LootItem } from "./LootRegistry";
import { physicalSlotsFor, type GearSlotKey } from "./gear";
import { BAGS } from "./bags";
import type { ClassId } from "../types";

export interface InventoryState {
  items: LootItem[];
  /** Équipement porté (slot physique → objet). */
  equipped: Partial<Record<GearSlotKey, LootItem>>;
  credits: number;
  /** Sac équipé (capacité supplémentaire). undefined = sac de base. */
  bagId?: string;
}

/** Items de départ donnés à tout nouveau personnage. */
export const STARTER_ITEMS: LootItem[] = [
  // Potions de soin × 3
  { id: "potion_soin_mineure",  label: "Potion de Soin Mineure",  rarity: "common",    value: 25,  statBonus: {}, icon: "🧪", category: "consumable", useEffect: { heal: 40 } },
  { id: "potion_soin_mineure",  label: "Potion de Soin Mineure",  rarity: "common",    value: 25,  statBonus: {}, icon: "🧪", category: "consumable", useEffect: { heal: 40 } },
  { id: "potion_soin_mineure",  label: "Potion de Soin Mineure",  rarity: "common",    value: 25,  statBonus: {}, icon: "🧪", category: "consumable", useEffect: { heal: 40 } },
  // Potions de mana × 2
  { id: "potion_mana_mineure",  label: "Potion de Mana Mineure",  rarity: "common",    value: 25,  statBonus: {}, icon: "💧", category: "consumable", useEffect: { mana: 40 } },
  { id: "potion_mana_mineure",  label: "Potion de Mana Mineure",  rarity: "common",    value: 25,  statBonus: {}, icon: "💧", category: "consumable", useEffect: { mana: 40 } },
  // Ressources de base
  { id: "fragment_vie",    label: "Fragment de Vie",     rarity: "common",    value: 5,   statBonus: { maxHp: 10 },       icon: "💚", category: "consumable" },
  { id: "fragment_vie",    label: "Fragment de Vie",     rarity: "common",    value: 5,   statBonus: { maxHp: 10 },       icon: "💚", category: "consumable" },
  { id: "cristal_energie", label: "Cristal d'Énergie",   rarity: "common",    value: 8,   statBonus: { maxMana: 10 },      icon: "💠", category: "consumable" },
  // Matériaux — communs et sans bonus : un objet `rare` au tour 0 se revend
  // 110 crédits via `sellItem`, ce qui rendait le démarrage « sans équipement »
  // purement décoratif.
  { id: "ferraille",       label: "Ferraille",            rarity: "common",    value: 6,   statBonus: {},                   icon: "⚙️", category: "material" },
  { id: "fibre_synth",     label: "Fibre Synthétique",    rarity: "common",    value: 5,   statBonus: {},                   icon: "🧵", category: "material" },
];

/**
 * Crédits d'un personnage neuf.
 *
 * ── POURQUOI 50 ET PAS 200 ───────────────────────────────────────────────────
 *
 * 200 était exactement le prix de la Lame Plasma au marchand. Démarrer « sans
 * équipement » avec de quoi en acheter immédiatement annulait la consigne.
 * 50 laisse les consommables accessibles sans court-circuiter la progression.
 *
 * ⚠ Cette constante est lue à TROIS endroits qui doivent rester d'accord :
 * `createInventory`, `createInventoryForClass`, et le plancher de
 * `RpgGameWorld.tsx` (`Math.max(base.credits, …)`). Les désynchroniser fait
 * remonter les crédits en silence au premier chargement.
 */
export const STARTER_CREDITS = 1500; // suit Roster.CREDITS_DEPART (jeu Lua) : 1 500 au départ, aucune tenue offerte ; ce TS doit suivre, pas diverger

export function createInventory(): InventoryState {
  return { items: [...STARTER_ITEMS], equipped: {}, credits: STARTER_CREDITS };
}

const CLASS_STARTER_WEAPON: Record<ClassId, { weapon: LootItem; offhand?: LootItem }> = {
  warrior_bruiser: {
    weapon: { id: "arch_sword", label: "Épée de Combat", rarity: "common", value: 30, statBonus: { attackPower: 5 }, icon: "⚔️", slot: "weapon" },
  },
  warrior_dps: {
    weapon: { id: "arch_gun", label: "Pistolet Standard", rarity: "common", value: 30, statBonus: { attackPower: 6 }, icon: "🔫", slot: "weapon" },
  },
  warrior_tank: {
    weapon:  { id: "arch_sword", label: "Épée de Combat", rarity: "common", value: 30, statBonus: { attackPower: 4 }, icon: "⚔️", slot: "weapon" },
    offhand: { id: "arch_shield", label: "Bouclier Tactique", rarity: "common", value: 30, statBonus: { defense: 6 }, icon: "🛡️", slot: "offhand" },
  },
  warrior_heal: {
    weapon: { id: "arch_gun", label: "Pistolet Standard", rarity: "common", value: 30, statBonus: { attackPower: 3 }, icon: "🔫", slot: "weapon" },
  },
};

/**
 * Inventaire de départ selon la classe.
 *
 * ── L'ARME N'EST PLUS PRÉ-ÉQUIPÉE (décision D2) ──────────────────────────────
 *
 * L'arme de classe — et le bouclier du `warrior_tank` — étaient posés
 * directement dans `equipped`. Le personnage démarrait donc armé et blindé,
 * ce qui contredit « commencer sans équipement ».
 *
 * Elle reste dans le SAC : le joueur la trouve à l'ouverture de l'inventaire et
 * l'équipe lui-même. Le premier geste devient un choix, pas un état de fait.
 * Retirer l'arme du sac aussi rendrait le premier combat injouable — le joueur
 * démarre sur `orbital`, sans marchand accessible immédiatement.
 */
export function createInventoryForClass(classId: ClassId): InventoryState {
  const starter = CLASS_STARTER_WEAPON[classId];
  const items: LootItem[] = [...STARTER_ITEMS, starter.weapon];
  if (starter.offhand) items.push(starter.offhand);
  return { items, equipped: {}, credits: STARTER_CREDITS };
}

export function addItem(inv: InventoryState, item: LootItem): InventoryState {
  return { ...inv, items: [...inv.items, item] };
}

export function addCredits(inv: InventoryState, amount: number): InventoryState {
  return { ...inv, credits: inv.credits + amount };
}

export function sellItem(inv: InventoryState, itemId: string): InventoryState {
  // Retire UNE instance par index (les objets de butin peuvent partager une réf).
  const idx = inv.items.findIndex((i) => i.id === itemId);
  if (idx < 0) return inv;
  const item = inv.items[idx];
  const items = inv.items.slice();
  items.splice(idx, 1);
  return { ...inv, items, credits: inv.credits + item.value };
}

/**
 * Retire UNE instance d'un item du sac (utilisation de consommable).
 * Différent de sellItem : pas de gain de crédits. L'appelant applique
 * l'effet (useEffect.heal / .mana) sur les stats joueur.
 *
 * @returns null si l'item n'existe pas dans l'inventaire.
 */
export function consumeItem(inv: InventoryState, itemId: string): InventoryState | null {
  const idx = inv.items.findIndex((i) => i.id === itemId);
  if (idx < 0) return null;
  const items = inv.items.slice();
  items.splice(idx, 1);
  return { ...inv, items };
}

/** Trouve la première potion qui SOIGNE dans l'inventaire (heal > 0). */
export function findFirstHealPotion(inv: InventoryState): LootItem | null {
  return inv.items.find((i) => (i.useEffect?.heal ?? 0) > 0) ?? null;
}

/** Trouve la première potion qui RESTAURE MANA dans l'inventaire (mana > 0). */
export function findFirstManaPotion(inv: InventoryState): LootItem | null {
  return inv.items.find((i) => (i.useEffect?.mana ?? 0) > 0) ?? null;
}

/** Équipe un objet (slot libre prioritaire, sinon échange l'objet déjà porté). */
export function equipItem(inv: InventoryState, itemId: string): InventoryState {
  const idx = inv.items.findIndex((i) => i.id === itemId && i.slot);
  if (idx < 0) return inv;
  const item = inv.items[idx];
  const candidates = physicalSlotsFor(item.slot!);
  const target = candidates.find((s) => !inv.equipped[s]) ?? candidates[0];
  const displaced = inv.equipped[target];
  const items = inv.items.slice();
  items.splice(idx, 1);
  if (displaced) items.push(displaced); // l'objet remplacé retourne au sac
  return { ...inv, items, equipped: { ...inv.equipped, [target]: item } };
}

/** Déséquipe le slot indiqué → l'objet retourne dans le sac. */
export function unequipItem(inv: InventoryState, slot: GearSlotKey): InventoryState {
  const item = inv.equipped[slot];
  if (!item) return inv;
  const equipped = { ...inv.equipped };
  delete equipped[slot];
  return { ...inv, equipped, items: [...inv.items, item] };
}

// ── Catalogue de la boutique ──────────────────────────────────────────────────
export interface ShopItem {
  id: string;
  label: string;
  price: number;
  item: LootItem;
}

export const SHOP_CATALOG: ShopItem[] = [
  // ── Potions consommables (achetables) ─────────────────────────────────────
  { id: "shop_potion_soin_min",   label: "Potion de Soin Mineure",  price: 30,  item: { id: "potion_soin_mineure",  label: "Potion de Soin Mineure",  rarity: "common", value: 25,  statBonus: {}, icon: "🧪", category: "consumable", useEffect: { heal: 40 } } },
  { id: "shop_potion_soin_maj",   label: "Potion de Soin Majeure",  price: 100, item: { id: "potion_soin_majeure",  label: "Potion de Soin Majeure",  rarity: "rare",   value: 80,  statBonus: {}, icon: "🩸", category: "consumable", useEffect: { heal: 120 } } },
  { id: "shop_potion_mana_min",   label: "Potion de Mana Mineure",  price: 30,  item: { id: "potion_mana_mineure",  label: "Potion de Mana Mineure",  rarity: "common", value: 25,  statBonus: {}, icon: "💧", category: "consumable", useEffect: { mana: 40 } } },
  { id: "shop_potion_mana_maj",   label: "Potion de Mana Majeure",  price: 100, item: { id: "potion_mana_majeure",  label: "Potion de Mana Majeure",  rarity: "rare",   value: 80,  statBonus: {}, icon: "🔮", category: "consumable", useEffect: { mana: 120 } } },
  // ── Ressources / matériaux ───────────────────────────────────────────────
  { id: "shop_fragment_vie",    label: "Fragment de Vie",     price: 10,  item: { id: "fragment_vie",    label: "Fragment de Vie",     rarity: "common",    value: 5,   statBonus: { maxHp: 10 },       icon: "💚" } },
  { id: "shop_cristal_energie", label: "Cristal d'Énergie",   price: 15,  item: { id: "cristal_energie", label: "Cristal d'Énergie",   rarity: "common",    value: 8,   statBonus: { maxMana: 10 },      icon: "💠" } },
  { id: "shop_plasma_blade",    label: "Lame Plasma",          price: 200, item: { id: "plasma_blade",    label: "Lame Plasma",          rarity: "rare",      value: 120, statBonus: { puissance: 12 },    icon: "🗡️" } },
  { id: "shop_cyber_armor",     label: "Armure Cybernétique",  price: 450, item: { id: "cyber_armor",     label: "Armure Cybernétique",  rarity: "epic",      value: 300, statBonus: { defense: 20, maxHp: 30 }, icon: "🛡️" } },
  { id: "shop_noyau_plasma",    label: "Noyau Plasma",         price: 350, item: { id: "noyau_plasma",    label: "Noyau Plasma",         rarity: "epic",      value: 200, statBonus: { puissance: 15 },    icon: "🔥" } },
];

export function buyItem(inv: InventoryState, shopItemId: string): InventoryState | null {
  const shopEntry = SHOP_CATALOG.find((s) => s.id === shopItemId);
  if (!shopEntry || inv.credits < shopEntry.price) return null;
  return addCredits(addItem(inv, shopEntry.item), -shopEntry.price);
}

/** Achète un sac (augmente la capacité). null si fonds insuffisants ou déjà équipé. */
export function buyBag(inv: InventoryState, bagId: string): InventoryState | null {
  const bag = BAGS[bagId];
  if (!bag || inv.bagId === bagId || inv.credits < bag.price) return null;
  return { ...inv, credits: inv.credits - bag.price, bagId };
}
