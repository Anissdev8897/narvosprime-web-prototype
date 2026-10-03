// ══════════════════════════════════════════════════════════════════════════════
// items/craftingSystem.ts — Système de craft
//
// Recettes, ingrédients, stations de craft.
// Supporte les recettes à plusieurs ingrédients et résultats.
// ══════════════════════════════════════════════════════════════════════════════

import { ITEM_DB } from "./itemCatalog";
import type { ItemDefinition } from "./ItemDefinition";

// ── Type de station de craft ────────────────────────────────────────────────
export type CraftStation =
  | "forge"       // Forge de base (armes, armures)
  | "workbench"   // Établi (équipement, accessoires)
  | "alchemy"     // Table d'alchimie (potions, consommables)
  | "refinery";   // Raffinerie (matériaux, composants)

// ── Ingrédient de recette ───────────────────────────────────────────────────
export interface CraftIngredient {
  itemId: string;
  quantity: number;
}

// ── Recette ─────────────────────────────────────────────────────────────────
export interface CraftRecipe {
  id: string;
  label: string;
  description: string;
  /** Station requise */
  station: CraftStation;
  /** Ingrédients nécessaires */
  ingredients: CraftIngredient[];
  /** Résultat de la recette */
  result: CraftIngredient;
  /** Temps de craft (secondes, 0 = instantané) */
  craftTimeSec: number;
  /** Niveau minimum requis */
  requiredLevel: number;
  /** Difficulté (0-100) pour les jets d'échec */
  difficulty: number;
}

// ── État d'une session de craft ─────────────────────────────────────────────
export interface CraftingSession {
  recipeId: string;
  /** Progression 0..1 */
  progress: number;
  /** Timestamp de début */
  startedAt: number;
  /** Durée totale en ms */
  durationMs: number;
}

// ── Catalogue des recettes ──────────────────────────────────────────────────
export const CRAFT_RECIPES: Record<string, CraftRecipe> = {
  // ── FORGE (armes et armures) ─────────────────────────────────────────────
  craft_plasma_blade: {
    id: "craft_plasma_blade",
    label: "Lame Plasma",
    description: "Forge une lame plasma à partir de métal rare et d'un noyau plasma.",
    station: "forge",
    ingredients: [
      { itemId: "metal_rare", quantity: 3 },
      { itemId: "noyau_plasma", quantity: 1 },
      { itemId: "cristal_energie", quantity: 5 },
    ],
    result: { itemId: "plasma_blade", quantity: 1 },
    craftTimeSec: 10,
    requiredLevel: 5,
    difficulty: 30,
  },
  craft_cyber_armor: {
    id: "craft_cyber_armor",
    label: "Armure Cybernétique",
    description: "Assemble une armure cybernétique complète.",
    station: "forge",
    ingredients: [
      { itemId: "metal_rare", quantity: 5 },
      { itemId: "noyau_plasma", quantity: 2 },
      { itemId: "adn_alien", quantity: 2 },
    ],
    result: { itemId: "cyber_armor", quantity: 1 },
    craftTimeSec: 15,
    requiredLevel: 8,
    difficulty: 40,
  },
  craft_plasma_shield: {
    id: "craft_plasma_shield",
    label: "Bouclier Plasma",
    description: "Façonne un bouclier à frompe plasma déflecteur.",
    station: "forge",
    ingredients: [
      { itemId: "metal_rare", quantity: 4 },
      { itemId: "noyau_plasma", quantity: 1 },
      { itemId: "cristal_energie", quantity: 8 },
    ],
    result: { itemId: "plasma_shield", quantity: 1 },
    craftTimeSec: 12,
    requiredLevel: 10,
    difficulty: 35,
  },

  // ── WORKBENCH (accessoires) ──────────────────────────────────────────────
  craft_void_amulet: {
    id: "craft_void_amulet",
    label: "Amulette du Vide",
    description: "Tisse une amulette à partir du vide cristallisé.",
    station: "workbench",
    ingredients: [
      { itemId: "powernax", quantity: 2 },
      { itemId: "cristal_energie", quantity: 10 },
      { itemId: "metal_rare", quantity: 2 },
    ],
    result: { itemId: "void_amulet", quantity: 1 },
    craftTimeSec: 8,
    requiredLevel: 8,
    difficulty: 25,
  },
  craft_power_ring: {
    id: "craft_power_ring",
    label: "Anneau de Puissance",
    description: "Faconne un anneau qui amplifie la puissance.",
    station: "workbench",
    ingredients: [
      { itemId: "metal_rare", quantity: 2 },
      { itemId: "cristal_energie", quantity: 5 },
    ],
    result: { itemId: "power_ring", quantity: 1 },
    craftTimeSec: 5,
    requiredLevel: 4,
    difficulty: 15,
  },

  // ── ALCHEMY (potions) ────────────────────────────────────────────────────
  craft_potion_soin_majeure: {
    id: "craft_potion_soin_majeure",
    label: "Potion de Soin Majeure",
    description: "Distille une potion de soin avancée.",
    station: "alchemy",
    ingredients: [
      { itemId: "fragment_vie", quantity: 5 },
      { itemId: "cristal_energie", quantity: 3 },
    ],
    result: { itemId: "potion_soin_majeure", quantity: 1 },
    craftTimeSec: 4,
    requiredLevel: 5,
    difficulty: 20,
  },
  craft_potion_mana_mineure: {
    id: "craft_potion_mana_mineure",
    label: "Potion de Mana Mineure",
    description: "Prépare une potion de mana basique.",
    station: "alchemy",
    ingredients: [
      { itemId: "cristal_energie", quantity: 2 },
    ],
    result: { itemId: "potion_mana_mineure", quantity: 1 },
    craftTimeSec: 2,
    requiredLevel: 1,
    difficulty: 5,
  },

  // ── REFINERY (matériaux) ─────────────────────────────────────────────────
  craft_noyau_plasma: {
    id: "craft_noyau_plasma",
    label: "Noyau Plasma",
    description: "Condense de l'énergie en un noyau plasma stable.",
    station: "refinery",
    ingredients: [
      { itemId: "cristal_energie", quantity: 10 },
      { itemId: "metal_rare", quantity: 1 },
    ],
    result: { itemId: "noyau_plasma", quantity: 1 },
    craftTimeSec: 6,
    requiredLevel: 5,
    difficulty: 20,
  },
  craft_metal_rare: {
    id: "craft_metal_rare",
    label: "Métal Rare",
    description: "Raffine du minerai brut en métal rare utilisable.",
    station: "refinery",
    ingredients: [
      { itemId: "fragment_vie", quantity: 3 },
      { itemId: "cristal_energie", quantity: 3 },
    ],
    result: { itemId: "metal_rare", quantity: 1 },
    craftTimeSec: 3,
    requiredLevel: 3,
    difficulty: 10,
  },
};

// ── Recettes groupées par station ───────────────────────────────────────────
export function recipesByStation(station: CraftStation): CraftRecipe[] {
  return Object.values(CRAFT_RECIPES).filter((r) => r.station === station);
}

// ── Vérification des ingrédients ───────────────────────────────────────────
export interface IngredientCheck {
  recipe: CraftRecipe;
  missing: CraftIngredient[];      // Ce qui manque
  available: boolean;              // Tout est dispo ?
  playerLevel: number;             // Niveau du joueur
  levelOk: boolean;                // Niveau suffisant ?
}

/**
 * Vérifie si un joueur peut crafter une recette.
 */
export function checkRecipe(
  recipeId: string,
  inventoryCounts: Record<string, number>,
  playerLevel: number
): IngredientCheck | null {
  const recipe = CRAFT_RECIPES[recipeId];
  if (!recipe) return null;

  // Vérification du niveau
  const levelOk = playerLevel >= recipe.requiredLevel;

  // Vérification des ingrédients
  const missing: CraftIngredient[] = [];
  for (const ing of recipe.ingredients) {
    const have = inventoryCounts[ing.itemId] ?? 0;
    if (have < ing.quantity) {
      missing.push({
        itemId: ing.itemId,
        quantity: ing.quantity - have,
      });
    }
  }

  return {
    recipe,
    missing,
    available: missing.length === 0 && levelOk,
    playerLevel,
    levelOk,
  };
}

/**
 * Consomme les ingrédients et retourne le résultat.
 * Retourne null si la recette n'est pas disponible.
 */
export function craftItem(
  recipeId: string,
  inventoryCounts: Record<string, number>,
  playerLevel: number
): { consumed: CraftIngredient[]; result: CraftIngredient } | null {
  const check = checkRecipe(recipeId, inventoryCounts, playerLevel);
  if (!check || !check.available) return null;

  // Consommation des ingrédients
  const consumed: CraftIngredient[] = [];
  for (const ing of check.recipe.ingredients) {
    consumed.push({ itemId: ing.itemId, quantity: ing.quantity });
  }

  return {
    consumed,
    result: { ...check.recipe.result },
  };
}

/**
 * Récupère les recettes disponibles pour un joueur (selon son niveau et station).
 */
export function availableRecipes(
  station: CraftStation,
  playerLevel: number,
  inventoryCounts: Record<string, number>
): IngredientCheck[] {
  return recipesByStation(station)
    .map((r) => checkRecipe(r.id, inventoryCounts, playerLevel))
    .filter((c): c is IngredientCheck => c !== null);
}
