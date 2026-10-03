// ══════════════════════════════════════════════════════════════════════════════
// tests pour items/itemCatalog.ts
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { ITEM_DB, getItemDef, getItemsByType, getItemsByRarity } from "../itemCatalog";

describe("itemCatalog", () => {
  it("contient des items", () => {
    expect(Object.keys(ITEM_DB).length).toBeGreaterThan(20);
  });

  it("chaque item a les champs requis", () => {
    for (const [id, item] of Object.entries(ITEM_DB)) {
      expect(item.id).toBe(id);
      expect(item.label).toBeTruthy();
      expect(item.type).toBeTruthy();
      expect(item.rarity).toBeTruthy();
      expect(typeof item.gridW).toBe("number");
      expect(typeof item.gridH).toBe("number");
      expect(typeof item.stackable).toBe("boolean");
      expect(typeof item.maxStack).toBe("number");
      expect(typeof item.value).toBe("number");
      expect(typeof item.weight).toBe("number");
      expect(item.icon).toBeTruthy();
    }
  });

  it("les items stackables ont maxStack > 1", () => {
    for (const item of Object.values(ITEM_DB)) {
      if (item.stackable) {
        expect(item.maxStack).toBeGreaterThan(1);
      }
    }
  });

  it("les items non-stackables ont maxStack = 1", () => {
    for (const item of Object.values(ITEM_DB)) {
      if (!item.stackable) {
        expect(item.maxStack).toBe(1);
      }
    }
  });

  it("getItemDef retourne la bonne définition", () => {
    const def = getItemDef("arch_sword");
    expect(def).toBeDefined();
    expect(def!.label).toBe("Épée de Combat");
  });

  it("getItemDef retourne undefined pour un ID inconnu", () => {
    expect(getItemDef("item_inconnu")).toBeUndefined();
  });

  it("getItemsByType filtre correctement", () => {
    const weapons = getItemsByType("weapon");
    expect(weapons.length).toBeGreaterThan(0);
    for (const w of weapons) {
      expect(w.type).toBe("weapon");
    }
  });

  it("getItemsByRarity filtre correctement", () => {
    const legendaries = getItemsByRarity("legendary");
    expect(legendaries.length).toBeGreaterThan(0);
    for (const l of legendaries) {
      expect(l.rarity).toBe("legendary");
    }
  });

  it("les items équipables ont un equipSlot valide", () => {
    for (const item of Object.values(ITEM_DB)) {
      if (item.equipSlot) {
        expect(["helmet", "armor", "legs", "weapon", "offhand", "accessory"]).toContain(item.equipSlot);
      }
    }
  });
});
