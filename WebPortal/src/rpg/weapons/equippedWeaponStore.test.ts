import { describe, it, expect, beforeEach } from "vitest";
import { equippedWeaponStore } from "./equippedWeaponStore";

describe("equippedWeaponStore", () => {
  beforeEach(() => equippedWeaponStore.set({ primary: null, secondary: null }));

  it("set met à jour primaire + secondaire", () => {
    equippedWeaponStore.set({ primary: "cat_sword_1h_short_sword", secondary: "cat_shield_shield00" });
    // activeSlot fait partie de l'état depuis le weapon switch (hotkeys 1/2)
    expect(equippedWeaponStore.get()).toMatchObject({ primary: "cat_sword_1h_short_sword", secondary: "cat_shield_shield00" });
    expect(equippedWeaponStore.get().activeSlot).toBe("primary");
  });

  it("notifie les abonnés uniquement au changement réel", () => {
    let calls = 0;
    const off = equippedWeaponStore.subscribe(() => { calls++; });
    equippedWeaponStore.set({ primary: "a", secondary: null });
    equippedWeaponStore.set({ primary: "a", secondary: null }); // identique → pas de notif
    expect(calls).toBe(1);
    off();
  });
});
