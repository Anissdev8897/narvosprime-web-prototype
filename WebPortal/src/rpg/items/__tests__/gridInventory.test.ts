// ══════════════════════════════════════════════════════════════════════════════
// tests pour items/gridInventory.ts
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { createGridState, addItemToGrid, removeItemFromGrid, moveItemInGrid, findFreeSlot, isAreaFree, countItem } from "../gridInventory";
import { ITEM_DB } from "../itemCatalog";

describe("gridInventory", () => {
  const def = ITEM_DB.arch_sword; // 2×3
  const smallDef = ITEM_DB.potion_soin_mineure; // 1×1 stackable

  describe("createGridState", () => {
    it("crée une grille vide avec les dimensions par défaut", () => {
      const grid = createGridState();
      expect(grid.cols).toBe(8);
      expect(grid.rows).toBe(10);
      expect(grid.instances).toHaveLength(0);
    });

    it("crée une grille avec des dimensions custom", () => {
      const grid = createGridState(6, 8);
      expect(grid.cols).toBe(6);
      expect(grid.rows).toBe(8);
    });
  });

  describe("isAreaFree", () => {
    it("grille vide = toute zone libre", () => {
      const grid = createGridState();
      expect(isAreaFree(grid, 0, 0, 1, 1)).toBe(true);
      expect(isAreaFree(grid, 7, 9, 1, 1)).toBe(true);
    });

    it("détecte une collision", () => {
      const grid = createGridState();
      grid.instances.push({
        itemId: "test", quantity: 1, gridX: 2, gridY: 2, uid: "u1", gridW: 2, gridH: 2,
      });
      expect(isAreaFree(grid, 2, 2, 1, 1)).toBe(false);
      expect(isAreaFree(grid, 3, 3, 1, 1)).toBe(false);
      expect(isAreaFree(grid, 0, 0, 1, 1)).toBe(true);
      expect(isAreaFree(grid, 4, 4, 1, 1)).toBe(true);
    });

    it("exclut l'uid spécifié (pour déplacement)", () => {
      const grid = createGridState();
      grid.instances.push({
        itemId: "test", quantity: 1, gridX: 2, gridY: 2, uid: "u1", gridW: 2, gridH: 2,
      });
      expect(isAreaFree(grid, 2, 2, 1, 1, "u1")).toBe(true);
    });
  });

  describe("findFreeSlot", () => {
    it("trouve la première case libre dans une grille vide", () => {
      const grid = createGridState();
      const pos = findFreeSlot(grid, 1, 1);
      expect(pos).toEqual({ x: 0, y: 0 });
    });

    it("trouve après un item placé", () => {
      const grid = createGridState(4, 4);
      grid.instances.push({
        itemId: "test", quantity: 1, gridX: 0, gridY: 0, uid: "u1", gridW: 2, gridH: 2,
      });
      const pos = findFreeSlot(grid, 1, 1);
      // Devrait trouver (2,0) ou (0,2)
      expect(pos).toBeTruthy();
    });

    it("retourne null si aucun slot libre", () => {
      const grid = createGridState(1, 1);
      grid.instances.push({
        itemId: "test", quantity: 1, gridX: 0, gridY: 0, uid: "u1", gridW: 1, gridH: 1,
      });
      expect(findFreeSlot(grid, 1, 1)).toBeNull();
    });
  });

  describe("addItemToGrid", () => {
    it("ajoute un item non-stackable dans la grille", () => {
      const grid = createGridState();
      const result = addItemToGrid(grid, def);
      expect(result).not.toBeNull();
      expect(result!.instances).toHaveLength(1);
      expect(result!.instances[0].itemId).toBe("arch_sword");
      expect(result!.instances[0].gridX).toBe(0);
      expect(result!.instances[0].gridY).toBe(0);
      expect(result!.instances[0].gridW).toBe(2);
      expect(result!.instances[0].gridH).toBe(3);
    });

    it("stacks un item stackable", () => {
      const grid = createGridState();
      const r1 = addItemToGrid(grid, smallDef, 3);
      expect(r1).not.toBeNull();
      expect(r1!.instances).toHaveLength(1);
      expect(r1!.instances[0].quantity).toBe(3);

      const r2 = addItemToGrid(r1!, smallDef, 2);
      expect(r2).not.toBeNull();
      expect(r2!.instances).toHaveLength(1);
      expect(r2!.instances[0].quantity).toBe(5);
    });

    it("crée une nouvelle pile si la première est pleine", () => {
      const grid = createGridState();
      const r1 = addItemToGrid(grid, smallDef, smallDef.maxStack);
      expect(r1!.instances).toHaveLength(1);

      const r2 = addItemToGrid(r1!, smallDef, 1);
      expect(r2!.instances).toHaveLength(2); // Nouvelle pile
    });

    it("retourne null si la grille est pleine", () => {
      // Grille 1×1 avec un item 1×1 déjà dedans
      const grid = { cols: 1, rows: 1, instances: [{
        itemId: "test", quantity: 1, gridX: 0, gridY: 0, uid: "u1", gridW: 1, gridH: 1,
      }]};
      const result = addItemToGrid(grid, { ...def, gridW: 1, gridH: 1 });
      expect(result).toBeNull();
    });

    it("gère plusieurs items de tailles différentes", () => {
      const grid = createGridState(5, 5);

      // Ajouter un item 2×2
      const r1 = addItemToGrid(grid, { ...def, id: "item1", gridW: 2, gridH: 2 });
      expect(r1).not.toBeNull();

      // Ajouter un autre item 1×1
      const r2 = addItemToGrid(r1!, { ...smallDef, id: "item2" });
      expect(r2).not.toBeNull();
      expect(r2!.instances).toHaveLength(2);
    });
  });

  describe("removeItemFromGrid", () => {
    it("retire une instance complète", () => {
      const grid = createGridState();
      const r1 = addItemToGrid(grid, smallDef, 5);
      const uid = r1!.instances[0].uid;

      const { grid: g2, removed } = removeItemFromGrid(r1!, uid);
      expect(removed).not.toBeNull();
      expect(removed!.quantity).toBe(5);
      expect(g2.instances).toHaveLength(0);
    });

    it("retire une partie d'une pile", () => {
      const grid = createGridState();
      const r1 = addItemToGrid(grid, smallDef, 10);
      const uid = r1!.instances[0].uid;

      const { grid: g2, removed } = removeItemFromGrid(r1!, uid, 3);
      expect(removed).not.toBeNull();
      expect(removed!.quantity).toBe(3);
      expect(g2.instances).toHaveLength(1);
      expect(g2.instances[0].quantity).toBe(7);
    });

    it("retourne null si l'uid n'existe pas", () => {
      const grid = createGridState();
      const { removed } = removeItemFromGrid(grid, "inconnu");
      expect(removed).toBeNull();
    });
  });

  describe("moveItemInGrid", () => {
    it("déplace un item vers une position libre", () => {
      const grid = createGridState();
      const r1 = addItemToGrid(grid, def);
      const uid = r1!.instances[0].uid;

      const moved = moveItemInGrid(r1!, uid, 4, 4);
      expect(moved).not.toBeNull();
      expect(moved!.instances[0].gridX).toBe(4);
      expect(moved!.instances[0].gridY).toBe(4);
    });

    it("refuse si la position est occupée", () => {
      const grid = createGridState(4, 4);
      const r1 = addItemToGrid(grid, { ...def, id: "item1", gridW: 1, gridH: 1 });
      const r2 = addItemToGrid(r1!, { ...smallDef, id: "item2" });
      const uid1 = r2!.instances[0].uid;
      const uid2 = r2!.instances[1].uid;

      // Tentative de déplacer item2 sur item1
      const moved = moveItemInGrid(r2!, uid2, 0, 0);
      expect(moved).toBeNull();
    });
  });

  describe("countItem", () => {
    it("compte la quantité totale", () => {
      const grid = createGridState();
      const r1 = addItemToGrid(grid, smallDef, 5);
      const r2 = addItemToGrid(r1!, smallDef, 3);
      expect(countItem(r2!, smallDef.id)).toBe(8);
    });
  });
});
