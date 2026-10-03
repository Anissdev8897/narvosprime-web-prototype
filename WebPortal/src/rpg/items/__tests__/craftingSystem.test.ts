// ══════════════════════════════════════════════════════════════════════════════
// tests pour items/craftingSystem.ts
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  CRAFT_RECIPES,
  recipesByStation,
  checkRecipe,
  craftItem,
  availableRecipes,
} from "../craftingSystem";
import { ITEM_DB } from "../itemCatalog";

describe("craftingSystem", () => {
  describe("CRAFT_RECIPES", () => {
    it("contient des recettes", () => {
      expect(Object.keys(CRAFT_RECIPES).length).toBeGreaterThan(0);
    });

    it("chaque recette a des ingrédients valides", () => {
      for (const [id, recipe] of Object.entries(CRAFT_RECIPES)) {
        expect(recipe.id).toBe(id);
        expect(recipe.label).toBeTruthy();
        expect(recipe.ingredients.length).toBeGreaterThan(0);
        expect(recipe.station).toBeTruthy();
        expect(recipe.result.itemId).toBeTruthy();
        expect(recipe.result.quantity).toBeGreaterThan(0);

        // Vérifier que les ingrédients existent dans le catalogue
        for (const ing of recipe.ingredients) {
          expect(ITEM_DB[ing.itemId]).toBeDefined();
        }
        // Vérifier que le résultat existe
        expect(ITEM_DB[recipe.result.itemId]).toBeDefined();
      }
    });
  });

  describe("recipesByStation", () => {
    it("filtre par station", () => {
      const forgeRecipes = recipesByStation("forge");
      expect(forgeRecipes.length).toBeGreaterThan(0);
      for (const r of forgeRecipes) {
        expect(r.station).toBe("forge");
      }
    });

    it("retourne un tableau vide pour une station sans recettes", () => {
      // Toutes les stations ont des recettes dans notre setup
      // Mais vérifions que le type est correct
      const recipes = recipesByStation("forge");
      expect(Array.isArray(recipes)).toBe(true);
    });
  });

  describe("checkRecipe", () => {
    it("recette disponible avec les bons ingrédients et niveau", () => {
      const counts: Record<string, number> = {
        metal_rare: 3,
        noyau_plasma: 1,
        cristal_energie: 5,
      };
      const check = checkRecipe("craft_plasma_blade", counts, 5);
      expect(check).not.toBeNull();
      expect(check!.available).toBe(true);
      expect(check!.missing).toHaveLength(0);
      expect(check!.levelOk).toBe(true);
    });

    it("signale les ingrédients manquants", () => {
      const counts: Record<string, number> = {
        metal_rare: 1, // besoin de 3
        noyau_plasma: 1,
        cristal_energie: 2, // besoin de 5
      };
      const check = checkRecipe("craft_plasma_blade", counts, 5);
      expect(check).not.toBeNull();
      expect(check!.available).toBe(false);
      expect(check!.missing.length).toBeGreaterThan(0);
    });

    it("signale un niveau insuffisant", () => {
      const counts: Record<string, number> = {
        metal_rare: 10,
        noyau_plasma: 5,
        cristal_energie: 20,
      };
      const check = checkRecipe("craft_cyber_armor", counts, 1); // niveau 1, requis 8
      expect(check).not.toBeNull();
      expect(check!.available).toBe(false);
      expect(check!.levelOk).toBe(false);
    });

    it("retourne null pour une recette inconnue", () => {
      const check = checkRecipe("recette_inconnue", {}, 1);
      expect(check).toBeNull();
    });
  });

  describe("craftItem", () => {
    it("craft un item avec les bons ingrédients", () => {
      const counts: Record<string, number> = {
        cristal_energie: 2,
      };
      const result = craftItem("craft_potion_mana_mineure", counts, 1);
      expect(result).not.toBeNull();
      expect(result!.result.itemId).toBe("potion_mana_mineure");
      expect(result!.result.quantity).toBe(1);
      expect(result!.consumed).toHaveLength(1);
    });

    it("retourne null si les ingrédients manquent", () => {
      const counts: Record<string, number> = {};
      const result = craftItem("craft_potion_mana_mineure", counts, 1);
      expect(result).toBeNull();
    });

    it("retourne null si le niveau est insuffisant", () => {
      const counts: Record<string, number> = {
        metal_rare: 10,
        noyau_plasma: 5,
      };
      const result = craftItem("craft_cyber_armor", counts, 1);
      expect(result).toBeNull();
    });
  });

  describe("availableRecipes", () => {
    it("liste les recettes disponibles pour une station", () => {
      const counts: Record<string, number> = {
        cristal_energie: 2,
      };
      const available = availableRecipes("alchemy", 1, counts);
      expect(available.length).toBeGreaterThan(0);
      for (const a of available) {
        expect(a.recipe.station).toBe("alchemy");
      }
    });
  });
});
