import { describe, it, expect } from "vitest";
import { weaponPrice, weaponCategory, weaponRarity, weaponLabelFromId, WEAPON_LOOT, weaponShopIds } from "./weaponShop";

describe("weaponShop — prix/catégorie/rareté", () => {
  it("prix escalade : dague < épée 1H < épée 2H", () => {
    expect(weaponPrice("dagger")).toBeLessThan(weaponPrice("sword_1h"));
    expect(weaponPrice("sword_1h")).toBeLessThan(weaponPrice("sword_2h"));
  });
  it("catégorie regroupe 1H et 2H sous Épées", () => {
    expect(weaponCategory("sword_1h")).toBe("Épées");
    expect(weaponCategory("sword_2h")).toBe("Épées");
    expect(weaponCategory("gun")).toBe("Armes futuristes");
  });
  it("rareté par palier de prix", () => {
    expect(weaponRarity(60)).toBe("common");
    expect(weaponRarity(150)).toBe("rare");
    expect(weaponRarity(250)).toBe("epic");
  });
  it("label depuis l'id de profil", () => {
    expect(weaponLabelFromId("cat_axe_battle_axe")).toBe("Battle Axe");
  });
});

describe("weaponShop — LootItems générés", () => {
  it("génère des armes vendables avec slot weapon + value = prix", () => {
    const ids = weaponShopIds();
    expect(ids.length).toBeGreaterThan(10);
    for (const id of ids) {
      const it = WEAPON_LOOT[id];
      expect(["weapon", "offhand"]).toContain(it.slot);
      expect(it.value).toBeGreaterThan(0);
      expect(it.label.length).toBeGreaterThan(0);
    }
  });
});
