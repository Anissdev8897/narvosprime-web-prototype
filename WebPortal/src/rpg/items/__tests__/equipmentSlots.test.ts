// ══════════════════════════════════════════════════════════════════════════════
// tests pour items/equipmentSlots.ts
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { createEmptyEquipment, equipItem, unequipSlot, canEquip, getEquippedStats, EQUIPMENT_SLOTS_ORDERED } from "../equipmentSlots";
import { ITEM_DB } from "../itemCatalog";

describe("equipmentSlots", () => {
  const sword = ITEM_DB.arch_sword;
  const shield = ITEM_DB.arch_shield;
  const helmet = ITEM_DB.combat_helmet;

  describe("createEmptyEquipment", () => {
    it("crée un équipement vide", () => {
      const eq = createEmptyEquipment();
      expect(eq.helmet).toBeNull();
      expect(eq.armor).toBeNull();
      expect(eq.legs).toBeNull();
      expect(eq.weapon).toBeNull();
      expect(eq.offhand).toBeNull();
      expect(eq.accessory).toBeNull();
    });
  });

  describe("equipItem", () => {
    it("équipe un item dans le bon slot", () => {
      const eq = createEmptyEquipment();
      const inst = { itemId: "arch_sword", quantity: 1, gridX: 0, gridY: 0, uid: "u1", gridW: 2, gridH: 3 };
      const { equipment, displaced } = equipItem(eq, inst);
      expect(equipment.weapon).toEqual(inst);
      expect(displaced).toBeNull();
    });

    it("déloge l'item précédent si le slot est occupé", () => {
      const eq = createEmptyEquipment();
      const inst1 = { itemId: "arch_sword", quantity: 1, gridX: 0, gridY: 0, uid: "u1", gridW: 2, gridH: 3 };
      const inst2 = { itemId: "plasma_blade", quantity: 1, gridX: 0, gridY: 0, uid: "u2", gridW: 2, gridH: 3 };

      const { equipment: eq1 } = equipItem(eq, inst1);
      const { equipment: eq2, displaced } = equipItem(eq1, inst2);

      expect(eq2.weapon).toEqual(inst2);
      expect(displaced).toEqual(inst1);
    });
  });

  describe("unequipSlot", () => {
    it("déséquipe un slot", () => {
      const eq = createEmptyEquipment();
      const inst = { itemId: "arch_sword", quantity: 1, gridX: 0, gridY: 0, uid: "u1", gridW: 2, gridH: 3 };
      const { equipment: eq1 } = equipItem(eq, inst);
      const { equipment: eq2, removed } = unequipSlot(eq1, "weapon");
      expect(eq2.weapon).toBeNull();
      expect(removed).toEqual(inst);
    });

    it("ne fait rien si le slot est vide", () => {
      const eq = createEmptyEquipment();
      const { equipment, removed } = unequipSlot(eq, "weapon");
      expect(equipment).toBe(eq);
      expect(removed).toBeNull();
    });
  });

  describe("canEquip", () => {
    it("vérifie si un item est équipable", () => {
      expect(canEquip(sword)).toBe(true);
      expect(canEquip(shield)).toBe(true);
      expect(canEquip(helmet)).toBe(true);
    });

    it("vérifie le slot cible", () => {
      expect(canEquip(sword, "weapon")).toBe(true);
      expect(canEquip(sword, "helmet")).toBe(false);
    });
  });

  describe("getEquippedStats", () => {
    it("calcule les stats cumulées", () => {
      const eq = createEmptyEquipment();
      const swordInst = { itemId: "arch_sword", quantity: 1, gridX: 0, gridY: 0, uid: "u1", gridW: 2, gridH: 3 };
      const shieldInst = { itemId: "arch_shield", quantity: 1, gridX: 0, gridY: 0, uid: "u2", gridW: 2, gridH: 3 };

      const { equipment: eq1 } = equipItem(eq, swordInst);
      const { equipment: eq2 } = equipItem(eq1, shieldInst);

      const stats = getEquippedStats(eq2);
      expect(stats.attackPower).toBe(5);
      expect(stats.defense).toBe(6);
      expect(stats.puissance).toBe(3);
      expect(stats.maxHp).toBe(10);
    });

    it("retourne un objet vide si rien d'équipé", () => {
      const eq = createEmptyEquipment();
      expect(getEquippedStats(eq)).toEqual({});
    });
  });

  describe("EQUIPMENT_SLOTS_ORDERED", () => {
    it("contient les 6 slots", () => {
      expect(EQUIPMENT_SLOTS_ORDERED).toHaveLength(6);
      const slots = EQUIPMENT_SLOTS_ORDERED.map((s) => s.slot);
      expect(slots).toContain("helmet");
      expect(slots).toContain("armor");
      expect(slots).toContain("legs");
      expect(slots).toContain("weapon");
      expect(slots).toContain("offhand");
      expect(slots).toContain("accessory");
    });
  });
});
