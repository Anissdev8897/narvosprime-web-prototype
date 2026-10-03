// ══════════════════════════════════════════════════════════════════════════════
// items/ItemDefinition.ts — Définition complète d'un item NARVOS PRIME P2
//
// Repense l'ancien LootItem (LootRegistry.ts) avec :
//   - des types stricts (ItemType, Rarity)
//   - la taille dans la grille (gridW × gridH)
//   - le support du stacking (maxStack)
//   - les stats formelles (ItemStats)
//   - la référence au modèle 3D (modelPath)
//   - des effets de set (setBonus)
// ══════════════════════════════════════════════════════════════════════════════

import type { Rarity } from "../types";
export type { Rarity };

// ── Types d'items ───────────────────────────────────────────────────────────
export type ItemType =
  | "weapon"
  | "armor"
  | "helmet"
  | "legs"
  | "boots"
  | "accessory"
  | "consumable"
  | "resource"
  | "material"
  | "quest"
  | "ammo"
  | "piece"    // Pièce d'assemblage (véhicule, arme…) — chantier assemblage
  | "vehicle"; // Véhicule assemblé (item échangé contre le spawn par l'exécutant)

// ── Slot d'équipement (6 slots) ─────────────────────────────────────────────
export type EquipSlot =
  | "helmet"    // Casque
  | "armor"     // Torse
  | "legs"      // Jambes
  | "weapon"    // Arme principale
  | "offhand"   // Arme secondaire / bouclier
  | "accessory";// Accessoire

// ── Statistiques d'un item ──────────────────────────────────────────────────
export interface ItemStats {
  attackPower?: number;
  defense?: number;
  maxHp?: number;
  maxMana?: number;
  puissance?: number;
  critique?: number;       // 0..100
  vitesse?: number;
  initative?: number;
}

// ── Effet de set (bonus quand on porte plusieurs pièces du même set) ────────
export interface SetBonusEffect {
  piecesRequired: number;   // 2, 3, 4…
  stats: ItemStats;
  description: string;
}

export interface SetDefinition {
  id: string;
  name: string;
  bonus: SetBonusEffect[];
}

// ── Effet utilisable (consommable) ──────────────────────────────────────────
export interface ItemUseEffect {
  heal?: number;
  mana?: number;
  buffStats?: ItemStats;
  buffDurationSec?: number;
  description?: string;
}

// ── Définition complète d'un item ───────────────────────────────────────────
export interface ItemDefinition {
  id: string;
  label: string;
  type: ItemType;
  rarity: Rarity;
  description: string;

  // Grille
  gridW: number;            // largeur dans la grille (1, 2…)
  gridH: number;            // hauteur dans la grille (1, 2…)

  // Stacking
  stackable: boolean;
  maxStack: number;         // 1 = non empilable

  // Stats
  stats: ItemStats;
  level: number;

  // Équipement
  equipSlot?: EquipSlot;    // si défini → équipable

  // Visuel
  icon: string;             // emoji fallback
  iconFile?: string;        // nom d'icône WebP (public/textures/icons/craft/<iconFile>.webp), vérifié sur disque par scripts
  color?: string;           // couleur hex (bordure rareté)
  modelPath?: string;       // référence au modèle 3D (GLB)

  // Économie
  value: number;            // prix en crédits
  weight: number;           // poids (kg)

  // Catégorie secondaire (pour filtres)
  category?: "equipment" | "consumable" | "resource" | "material" | "quest" | "ammo" | "vehicule";

  // Set
  setId?: string;

  // Effet utilisable
  useEffect?: ItemUseEffect;
}

// ── Instance d'un item dans l'inventaire (une PILE) ─────────────────────────
export interface ItemInstance {
  /** Référence à la définition (ItemDefinition.id) */
  itemId: string;
  /** Quantité dans cette pile */
  quantity: number;
  /** Position dans la grille (null = non placé / en attente) */
  gridX: number;
  gridY: number;
  /** Identifiant unique de l'instance (pour drag & drop) */
  uid: string;
  /** Taille dans la grille (copiée de la définition au placement). */
  gridW: number;
  gridH: number;
}

// ── Mapping rareté → couleur ────────────────────────────────────────────────
export const RARITY_COLORS: Record<Rarity, string> = {
  common:    "#aaaaaa",
  rare:      "#4a9eff",
  epic:      "#a855f7",
  legendary: "#f59e0b",
  mythic:    "#ef4444",
  alien:     "#22c55e",
  divine:    "#ff00ff",
};

// ── Rarete display ──────────────────────────────────────────────────────────
export const RARITY_LABELS: Record<Rarity, string> = {
  common:    "Commun",
  rare:      "Rare",
  epic:      "Épique",
  legendary: "Légendaire",
  mythic:    "Mythique",
  alien:     "Alien",
  divine:    "Divin",
};

// ── ÉquipSlot display ───────────────────────────────────────────────────────
export const EQUIP_SLOT_LABELS: Record<EquipSlot, string> = {
  helmet:    "Casque",
  armor:     "Torse",
  legs:      "Jambes",
  weapon:    "Arme principale",
  offhand:   "Arme secondaire",
  accessory: "Accessoire",
};

// ── Type display ────────────────────────────────────────────────────────────
export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  weapon:      "Arme",
  armor:       "Armure",
  helmet:      "Casque",
  legs:        "Jambières",
  boots:       "Bottes",
  accessory:   "Accessoire",
  consumable:  "Consommable",
  resource:    "Ressource",
  material:    "Matériau",
  quest:       "Quête",
  ammo:        "Munition",
  piece:       "Pièce",
  vehicle:     "Véhicule",
};
