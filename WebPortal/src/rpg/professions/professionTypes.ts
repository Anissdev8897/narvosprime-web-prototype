// ══════════════════════════════════════════════════════════════════════════════
// professions/professionTypes.ts — Modèle de données des MÉTIERS (data-driven).
//
// Tout le contenu (métiers, tiers de ressources, recettes) vit dans des objets TS
// → ajouter un métier ou un tier = une entrée de catalogue, zéro logique nouvelle.
// Progression longue type MMO : niveaux 1→50, courbe d'XP exponentielle douce.
// ══════════════════════════════════════════════════════════════════════════════

export type ProfessionId =
  | "bucheron"   // récolte de bois
  | "mineur"     // récolte de minerai
  | "recolteur"  // récolte de plantes
  | "forgeron"   // artisanat d'armes/armures
  | "alchimiste" // artisanat de potions
  | "joaillier"; // artisanat de bijoux

/** Récolte (gather) = ramasser dans le monde · Artisanat (craft) = fabriquer via recettes. */
export type ProfessionKind = "gather" | "craft";

export type Rarity = "commun" | "rare" | "epique" | "legendaire";

/** Un palier de ressource débloqué à un niveau métier donné. */
export interface ResourceTier {
  id: string;          // clé d'item (ex: "bois_use")
  label: string;       // nom affiché
  minLevel: number;    // niveau métier requis pour la récolter
  baseXp: number;      // XP métier octroyée par unité récoltée
  value: number;       // valeur marchande de base (économie)
  rarity: Rarity;
  /** Coups nécessaires pour épuiser un nœud de ce tier (récolte non-instantanée). */
  hits: number;
}

export interface ProfessionDef {
  id: ProfessionId;
  label: string;
  kind: ProfessionKind;
  icon: string;        // emoji d'UI
  color: string;       // teinte d'accent (hex)
  /** Verbe d'action (récolte) : "Couper", "Miner", "Cueillir". */
  gatherVerb: string;
  /** Paliers de ressources récoltables (vide pour les métiers d'artisanat). */
  tiers: ResourceTier[];
}

// ── Artisanat (craft) ─────────────────────────────────────────────────────────
/** Un ingrédient consommé par une recette (itemId d'une ressource récoltée ou craftée). */
export interface RecipeInput { itemId: string; qty: number; }

/** Le produit d'une recette (objet fabriqué). */
export interface RecipeOutput {
  itemId: string;
  label: string;
  qty: number;
  value: number;   // valeur marchande de base (économie)
  rarity: Rarity;
}

/** Une recette d'artisanat débloquée à un niveau métier donné. */
export interface CraftRecipe {
  id: string;
  profession: ProfessionId;   // forgeron | alchimiste | joaillier
  label: string;
  icon: string;
  minLevel: number;
  baseXp: number;             // XP octroyée à la fabrication (×mult qualité)
  inputs: RecipeInput[];
  output: RecipeOutput;
}

// ── Progression ─────────────────────────────────────────────────────────────
export const MAX_PROFESSION_LEVEL = 50;

/** XP requise pour passer du niveau `level` à `level+1`. Courbe douce-exponentielle. */
export function xpForLevel(level: number): number {
  if (level >= MAX_PROFESSION_LEVEL) return Infinity;
  return Math.round(50 * Math.pow(level, 1.55));
}

/** XP cumulée nécessaire pour ATTEINDRE `level` (depuis niveau 1). */
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpForLevel(l);
  return total;
}

/** Le tier de plus haut niveau récoltable au niveau métier donné (ou null). */
export function bestTierForLevel(def: ProfessionDef, level: number): ResourceTier | null {
  let best: ResourceTier | null = null;
  for (const t of def.tiers) {
    if (t.minLevel <= level && (!best || t.minLevel > best.minLevel)) best = t;
  }
  return best;
}
