// ══════════════════════════════════════════════════════════════════════════════
// tests pour items/inventoryStore.ts
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from "vitest";
import { inventoryStore } from "../inventoryStore";

describe("inventoryStore", () => {
  beforeEach(() => {
    inventoryStore.reset();
  });

  it("état initial", () => {
    const state = inventoryStore.get();
    expect(state.grid.instances).toHaveLength(0);
    expect(state.credits).toBe(200);
    expect(state.equipment.weapon).toBeNull();
  });

  it("addItemById ajoute un item à la grille", () => {
    const ok = inventoryStore.addItemById("arch_sword");
    expect(ok).toBe(true);
    const state = inventoryStore.get();
    expect(state.grid.instances).toHaveLength(1);
    expect(state.grid.instances[0].itemId).toBe("arch_sword");
  });

  it("addItemById retourne false si l'item n'existe pas", () => {
    const ok = inventoryStore.addItemById("item_inconnu");
    expect(ok).toBe(false);
  });

  it("removeItem retire un item", () => {
    inventoryStore.addItemById("potion_soin_mineure", 5);
    const uid = inventoryStore.get().grid.instances[0].uid;
    const removed = inventoryStore.removeItem(uid);
    expect(removed).not.toBeNull();
    expect(inventoryStore.get().grid.instances).toHaveLength(0);
  });

  it("equipFromGrid équipe un item et le retire de la grille", () => {
    inventoryStore.addItemById("arch_sword");
    const uid = inventoryStore.get().grid.instances[0].uid;
    const ok = inventoryStore.equipFromGrid(uid);
    expect(ok).toBe(true);
    const state = inventoryStore.get();
    expect(state.grid.instances).toHaveLength(0);
    expect(state.equipment.weapon).not.toBeNull();
    expect(state.equipment.weapon!.itemId).toBe("arch_sword");
  });

  it("equipFromGrid déloge l'item précédent dans la grille", () => {
    inventoryStore.addItemById("arch_sword");
    inventoryStore.addItemById("plasma_blade");
    const state1 = inventoryStore.get();
    const uid1 = state1.grid.instances[0].uid;
    const uid2 = state1.grid.instances[1].uid;

    // Équiper l'épée
    inventoryStore.equipFromGrid(uid1);
    // Équiper la lame plasma (délage l'épée)
    inventoryStore.equipFromGrid(uid2);

    const state2 = inventoryStore.get();
    expect(state2.equipment.weapon!.itemId).toBe("plasma_blade");
    // L'épée délogée devrait être revenue dans la grille
    expect(state2.grid.instances.some((i) => i.itemId === "arch_sword")).toBe(true);
  });

  it("unequipToGrid déséquipe et remet dans la grille", () => {
    inventoryStore.addItemById("arch_sword");
    const uid = inventoryStore.get().grid.instances[0].uid;
    inventoryStore.equipFromGrid(uid);
    expect(inventoryStore.get().grid.instances).toHaveLength(0);

    const ok = inventoryStore.unequipToGrid("weapon");
    expect(ok).toBe(true);
    const state = inventoryStore.get();
    expect(state.equipment.weapon).toBeNull();
    expect(state.grid.instances).toHaveLength(1);
    expect(state.grid.instances[0].itemId).toBe("arch_sword");
  });

  it("addCredits fonctionne", () => {
    inventoryStore.addCredits(50);
    expect(inventoryStore.get().credits).toBe(250);
    inventoryStore.addCredits(-300);
    expect(inventoryStore.get().credits).toBe(0);
  });

  it("setCredits fonctionne", () => {
    inventoryStore.setCredits(999);
    expect(inventoryStore.get().credits).toBe(999);
    inventoryStore.setCredits(-5);
    expect(inventoryStore.get().credits).toBe(0);
  });

  it("addItems ajoute plusieurs items en batch", () => {
    const ok = inventoryStore.addItems([
      { itemId: "arch_sword", quantity: 1 },
      { itemId: "potion_soin_mineure", quantity: 5 },
    ]);
    expect(ok).toBe(true);
    const state = inventoryStore.get();
    expect(state.grid.instances).toHaveLength(2);
  });

  it("moveItem déplace un item dans la grille", () => {
    inventoryStore.addItemById("arch_sword");
    const inst = inventoryStore.get().grid.instances[0];
    const ok = inventoryStore.moveItem(inst.uid, 3, 4);
    expect(ok).toBe(true);
    expect(inventoryStore.get().grid.instances[0].gridX).toBe(3);
    expect(inventoryStore.get().grid.instances[0].gridY).toBe(4);
  });

  it("reset réinitialise tout", () => {
    inventoryStore.addItemById("arch_sword");
    inventoryStore.addCredits(500);
    inventoryStore.reset();
    const state = inventoryStore.get();
    expect(state.grid.instances).toHaveLength(0);
    expect(state.credits).toBe(200);
  });

  it("getEquippedStats retourne les stats de l'équipement", () => {
    inventoryStore.addItemById("arch_sword");
    const uid = inventoryStore.get().grid.instances[0].uid;
    inventoryStore.equipFromGrid(uid);
    const stats = inventoryStore.getEquippedStats();
    expect(stats.attackPower).toBe(5);
    expect(stats.puissance).toBe(3);
  });
});
