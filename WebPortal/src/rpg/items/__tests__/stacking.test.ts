// ══════════════════════════════════════════════════════════════════════════════
// tests pour items/stacking.ts
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { findStackTarget, addToStack, removeFromStack, splitStack, mergeStacks } from "../stacking";
import { ITEM_DB } from "../itemCatalog";

describe("stacking", () => {
  const def = ITEM_DB.potion_soin_mineure;

  describe("findStackTarget", () => {
    it("trouve une pile avec de l'espace", () => {
      const instances = [
        { itemId: def.id, quantity: 3, gridX: 0, gridY: 0, uid: "u1", gridW: 1, gridH: 1 },
      ];
      const target = findStackTarget(def, instances, 2);
      expect(target).not.toBeNull();
      expect(target!.instance.uid).toBe("u1");
      expect(target!.space).toBe(7); // maxStack=10, qty=3
    });

    it("retourne null si les piles sont pleines", () => {
      const instances = [
        { itemId: def.id, quantity: 10, gridX: 0, gridY: 0, uid: "u1", gridW: 1, gridH: 1 },
      ];
      const target = findStackTarget(def, instances, 1);
      expect(target).toBeNull();
    });

    it("retourne null pour un item non-stackable", () => {
      const nonStackable = ITEM_DB.arch_sword;
      const instances = [
        { itemId: nonStackable.id, quantity: 1, gridX: 0, gridY: 0, uid: "u1", gridW: 1, gridH: 1 },
      ];
      const target = findStackTarget(nonStackable, instances, 1);
      expect(target).toBeNull();
    });
  });

  describe("addToStack", () => {
    it("ajoute dans les limites", () => {
      expect(addToStack({ itemId: "x", quantity: 3, gridX: 0, gridY: 0, uid: "u", gridW: 1, gridH: 1 }, 5, 10)).toBe(8);
    });

    it("ne dépasse pas maxStack", () => {
      expect(addToStack({ itemId: "x", quantity: 7, gridX: 0, gridY: 0, uid: "u", gridW: 1, gridH: 1 }, 5, 10)).toBe(10);
    });
  });

  describe("removeFromStack", () => {
    it("retire la quantité demandée", () => {
      expect(removeFromStack({ itemId: "x", quantity: 10, gridX: 0, gridY: 0, uid: "u", gridW: 1, gridH: 1 }, 3)).toBe(7);
    });

    it("ne descend pas en dessous de 0", () => {
      expect(removeFromStack({ itemId: "x", quantity: 3, gridX: 0, gridY: 0, uid: "u", gridW: 1, gridH: 1 }, 10)).toBe(0);
    });
  });

  describe("splitStack", () => {
    it("sépare une pile en deux", () => {
      const source = { itemId: "test", quantity: 10, gridX: 0, gridY: 0, uid: "u1", gridW: 1, gridH: 1 };
      const result = splitStack(source, 3, 2, 2);
      expect(result).not.toBeNull();
      expect(result!.source.quantity).toBe(7);
      expect(result!.split.quantity).toBe(3);
      expect(result!.split.gridX).toBe(2);
      expect(result!.split.gridY).toBe(2);
      expect(result!.split.uid).not.toBe("u1");
    });

    it("refuse de séparer avec amount <= 0", () => {
      const source = { itemId: "test", quantity: 5, gridX: 0, gridY: 0, uid: "u1", gridW: 1, gridH: 1 };
      expect(splitStack(source, 0, 1, 1)).toBeNull();
    });

    it("refuse de séparer avec amount >= quantity", () => {
      const source = { itemId: "test", quantity: 5, gridX: 0, gridY: 0, uid: "u1", gridW: 1, gridH: 1 };
      expect(splitStack(source, 5, 1, 1)).toBeNull();
    });
  });

  describe("mergeStacks", () => {
    it("fusionne deux piles du même item", () => {
      const src = { itemId: "test", quantity: 3, gridX: 0, gridY: 0, uid: "u1", gridW: 1, gridH: 1 };
      const dst = { itemId: "test", quantity: 5, gridX: 2, gridY: 0, uid: "u2", gridW: 1, gridH: 1 };
      const result = mergeStacks(src, dst, 10);
      expect(result).not.toBeNull();
      expect(result!.source).toBeNull(); // tout déplacé
      expect(result!.dest.quantity).toBe(8);
    });

    it("laisse un reste si la destination est presque pleine", () => {
      const src = { itemId: "test", quantity: 5, gridX: 0, gridY: 0, uid: "u1", gridW: 1, gridH: 1 };
      const dst = { itemId: "test", quantity: 8, gridX: 2, gridY: 0, uid: "u2", gridW: 1, gridH: 1 };
      const result = mergeStacks(src, dst, 10);
      expect(result).not.toBeNull();
      expect(result!.source).not.toBeNull();
      expect(result!.source!.quantity).toBe(3); // reste
      expect(result!.dest.quantity).toBe(10);    // plein
    });

    it("refuse si les IDs sont différents", () => {
      const src = { itemId: "item_a", quantity: 3, gridX: 0, gridY: 0, uid: "u1", gridW: 1, gridH: 1 };
      const dst = { itemId: "item_b", quantity: 5, gridX: 2, gridY: 0, uid: "u2", gridW: 1, gridH: 1 };
      expect(mergeStacks(src, dst, 10)).toBeNull();
    });

    it("refuse si la destination est pleine", () => {
      const src = { itemId: "test", quantity: 3, gridX: 0, gridY: 0, uid: "u1", gridW: 1, gridH: 1 };
      const dst = { itemId: "test", quantity: 10, gridX: 2, gridY: 0, uid: "u2", gridW: 1, gridH: 1 };
      expect(mergeStacks(src, dst, 10)).toBeNull();
    });
  });
});
