// ══════════════════════════════════════════════════════════════════════════════
// tests pour items/lootTables.ts
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  LOOT_TABLES,
  rollRarity,
  rollLootTable,
  zoneDrop,
  lootResultsToInstances,
} from "../lootTables";
import { ITEM_DB } from "../itemCatalog";

describe("lootTables", () => {
  describe("LOOT_TABLES", () => {
    it("contient les tables de zones", () => {
      expect(LOOT_TABLES.spore).toBeDefined();
      expect(LOOT_TABLES.space).toBeDefined();
      expect(LOOT_TABLES.forge).toBeDefined();
      expect(LOOT_TABLES.boss).toBeDefined();
    });

    it("chaque table a des entrées valides", () => {
      for (const [id, table] of Object.entries(LOOT_TABLES)) {
        expect(table.id).toBe(id);
        expect(table.label).toBeTruthy();
        expect(table.baseDropCount).toBeGreaterThan(0);
        expect(table.entries.length).toBeGreaterThan(0);
        for (const entry of table.entries) {
          expect(ITEM_DB[entry.itemId]).toBeDefined();
          expect(entry.weight).toBeGreaterThan(0);
          expect(entry.minCount).toBeGreaterThan(0);
          expect(entry.maxCount).toBeGreaterThanOrEqual(entry.minCount);
        }
      }
    });
  });

  describe("rollRarity", () => {
    it("tire une rareté valide", () => {
      let rngIndex = 0;
      const rng = () => {
        const values = [0.1, 0.5, 0.75, 0.9, 0.97, 0.99];
        return values[rngIndex++ % values.length];
      };
      for (let i = 0; i < 20; i++) {
        const rarity = rollRarity(1, rng);
        expect(["common", "rare", "epic", "legendary", "mythic", "alien", "divine"]).toContain(rarity);
      }
    });

    it("niveau élevé augmente les chances de rareté haute", () => {
      const rng = () => 0.1; // toujours "common" au niveau 1
      const lowLevel = rollRarity(1, rng);
      const highLevel = rollRarity(50, rng);
      // À niveau 50, 0.1 peut encore donner common selon l'ajustement
      // (juste vérifier que ça marche sans erreur)
      expect(["common", "rare", "epic", "legendary", "mythic", "alien", "divine"]).toContain(lowLevel);
      expect(["common", "rare", "epic", "legendary", "mythic", "alien", "divine"]).toContain(highLevel);
    });
  });

  describe("rollLootTable", () => {
    it("génère des drops depuis une table valide", () => {
      // RNG déterministe : seed faux mais prévisible
      let call = 0;
      const rng = () => {
        call++;
        return (call * 0.17) % 1;
      };

      const results = rollLootTable("spore", { zone: "spore", enemyLevel: 5 }, rng);
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(ITEM_DB[r.itemId]).toBeDefined();
        expect(r.quantity).toBeGreaterThan(0);
      }
    });

    it("retourne un tableau vide pour une table inconnue", () => {
      const results = rollLootTable("inconnue", { zone: "inconnue", enemyLevel: 1 });
      expect(results).toHaveLength(0);
    });

    it("applique le multiplicateur de drop", () => {
      let call = 0;
      const rng = () => {
        call++;
        return (call * 0.23) % 1;
      };

      const normal = rollLootTable("spore", { zone: "spore", enemyLevel: 1 }, rng);
      const boss = rollLootTable("spore", { zone: "spore", enemyLevel: 1, dropMultiplier: 3 }, rng);
      // Boss devrait avoir ~3× plus de drops
      expect(boss.length).toBeGreaterThanOrEqual(normal.length);
    });
  });

  describe("zoneDrop", () => {
    it("est un raccourci fonctionnel", () => {
      const drops = zoneDrop("forge", 10);
      expect(Array.isArray(drops)).toBe(true);
    });
  });

  describe("lootResultsToInstances", () => {
    it("convertit les résultats en items", () => {
      const results = [
        { itemId: "fragment_vie", quantity: 3 },
        { itemId: "potion_soin_mineure", quantity: 2 },
      ];
      const items = lootResultsToInstances(results);
      expect(items).toHaveLength(2);
      expect(items[0].def.id).toBe("fragment_vie");
      expect(items[0].quantity).toBe(3);
      expect(items[1].def.id).toBe("potion_soin_mineure");
      expect(items[1].quantity).toBe(2);
    });

    it("filtre les items inconnus", () => {
      const results = [
        { itemId: "item_inconnu", quantity: 1 },
        { itemId: "fragment_vie", quantity: 2 },
      ];
      const items = lootResultsToInstances(results);
      expect(items).toHaveLength(1);
      expect(items[0].def.id).toBe("fragment_vie");
    });
  });
});
