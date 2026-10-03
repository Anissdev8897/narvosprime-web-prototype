// weapons/weaponShop.ts — Catalogue d'armes VENDABLES (prix + label + catégorie).
//
// Dérive un LootItem par arme équipable du catalogue (weaponCatalog.catalogProfiles).
// L'id du LootItem = l'id du WeaponProfile (cat_<type>_<slug>) → le futur système
// d'équipement (SP-B2) relie directement l'objet acheté à son arme 3D.
// Prix cohérents avec l'économie : kills 15-110 cr, quêtes 40-180, potions 25-600,
// armes existantes (Lame Plasma 120 / Sabre du Vide 700). Prix = base catégorie × rareté.
import { catalogProfiles } from "./weaponCatalog";
import type { WeaponType } from "./weaponClassifier";
import type { Rarity } from "../types";
import type { LootItem } from "../loot/LootRegistry";

/** Catégorie d'affichage (regroupe les WeaponType en familles lisibles). */
const CATEGORY_LABEL: Record<WeaponType, string> = {
  sword_1h: "Épées", sword_2h: "Épées", dagger: "Dagues", axe: "Haches",
  blunt: "Masses", spear: "Lances", bow: "Arcs", staff: "Bâtons",
  gun: "Armes futuristes", shield: "Boucliers", ammo: "Munitions",
  throwable: "Jetables", clip: "—", ignore: "—",
};

/** Prix de BASE (crédits) par type — escalade selon la puissance/2-mains. */
const BASE_PRICE: Record<WeaponType, number> = {
  dagger: 60, sword_1h: 120, axe: 110, blunt: 130, spear: 140,
  sword_2h: 250, bow: 150, staff: 180, gun: 220, shield: 100,
  ammo: 10, throwable: 30,
  // Prix 0 ET isWeapon=false : un clip ne peut ni s'acheter ni s'équiper.
  clip: 0, ignore: 0,
};

const ICON: Record<WeaponType, string> = {
  sword_1h: "🗡️", sword_2h: "⚔️", dagger: "🔪", axe: "🪓", blunt: "🔨",
  spear: "🔱", bow: "🏹", staff: "🪄", gun: "🔫", shield: "🛡️",
  ammo: "➴", throwable: "💣", clip: "🎬", ignore: "❔",
};

/** Prix de base d'un type d'arme (crédits). */
export function weaponPrice(type: WeaponType): number {
  return BASE_PRICE[type] ?? 100;
}

/** Catégorie d'affichage d'un type d'arme. */
export function weaponCategory(type: WeaponType): string {
  return CATEGORY_LABEL[type] ?? "—";
}

/** Rareté dérivée du prix (paliers) → couleur + multiplicateur d'achat marchand. */
export function weaponRarity(price: number): Rarity {
  if (price >= 240) return "epic";
  if (price >= 150) return "rare";
  return "common";
}

/** Libellé humain depuis l'id de profil `cat_<type>_<slug>` → "Slug Title". */
export function weaponLabelFromId(id: string): string {
  const slug = id.replace(/^cat_[a-z0-9]+_/, "").replace(/_/g, " ").trim();
  return slug.replace(/\b\w/g, (c) => c.toUpperCase()) || "Arme";
}

/** LootItems d'arme, indexés par id (= id du WeaponProfile). Mergés dans LOOT_CATALOG. */
export const WEAPON_LOOT: Record<string, LootItem> = (() => {
  const out: Record<string, LootItem> = {};
  for (const p of catalogProfiles()) {
    const type = p.type as WeaponType;
    const price = weaponPrice(type);
    out[p.id] = {
      id: p.id,
      label: weaponLabelFromId(p.id),
      rarity: weaponRarity(price),
      value: price,
      statBonus: {},
      icon: ICON[type] ?? "🗡️",
      slot: type === "shield" ? "offhand" : "weapon", // bouclier = arme SECONDAIRE (offhand)
      category: "equipment",
      kind: "weapon",
    };
  }
  return out;
})();

/** Ids des armes vendables (stock marchand). */
export function weaponShopIds(): string[] {
  return Object.keys(WEAPON_LOOT);
}

/** Catégorie d'affichage par id d'arme (pour le groupement du panneau marchand). */
export const WEAPON_CATEGORY_BY_ID: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const p of catalogProfiles()) out[p.id] = weaponCategory(p.type as WeaponType);
  return out;
})();
