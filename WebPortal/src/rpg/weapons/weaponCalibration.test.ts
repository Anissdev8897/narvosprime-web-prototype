// weapons/weaponCalibration.test.ts — calibrage classe×type + enregistrement catalogue.
import { describe, it, expect } from "vitest";
import { catalogProfiles, EQUIPPABLE_WEAPONS } from "./weaponCatalog";
import { weaponRegistry } from "./weaponRegistry";
import { calibrationKey, weaponCalibrationStore } from "./weaponCalibrationStore";

describe("catalogProfiles", () => {
  it("génère un profil par arme équipable, avec id unique", () => {
    const profiles = catalogProfiles();
    expect(profiles.length).toBe(EQUIPPABLE_WEAPONS.length);
    const ids = new Set(profiles.map((p) => p.id));
    expect(ids.size).toBe(profiles.length); // pas de collision
    for (const p of profiles) {
      expect(p.id.startsWith("cat_")).toBe(true);
      expect(p.path.startsWith("/models/")).toBe(true);
      expect(p.socket).toBeDefined();
    }
  });

  it("toutes les armes du catalogue sont enregistrées (équipables par id)", () => {
    for (const p of catalogProfiles()) {
      expect(weaponRegistry.has(p.id)).toBe(true);
    }
  });

  it("les profils JSON réglés à la main restent présents (arch_*)", () => {
    expect(weaponRegistry.has("arch_sword")).toBe(true);
    expect(weaponRegistry.has("arch_bow")).toBe(true);
  });
});

describe("weaponCalibrationStore", () => {
  it("compose la clé classe::type", () => {
    expect(calibrationKey("guerrier", "sword_1h")).toBe("guerrier::sword_1h");
  });

  it("set/getExact + repli sur default", () => {
    weaponCalibrationStore.set("default", "bow", { rotation: [1, 0, 0] });
    // archer::bow non défini → resolve retombe sur default::bow
    expect(weaponCalibrationStore.resolve("archer", "bow")?.rotation).toEqual([1, 0, 0]);
    weaponCalibrationStore.set("archer", "bow", { rotation: [0, 2, 0] });
    expect(weaponCalibrationStore.resolve("archer", "bow")?.rotation).toEqual([0, 2, 0]); // exact gagne
    expect(weaponCalibrationStore.getExact("mage", "bow")).toBeUndefined();
    weaponCalibrationStore.reset("archer", "bow");
    weaponCalibrationStore.reset("default", "bow");
  });

  it("fusion partielle par champ (ne pas écraser scale en réglant la position)", () => {
    weaponCalibrationStore.set("guerrier", "sword_1h", { scale: 0.5 });
    weaponCalibrationStore.set("guerrier", "sword_1h", { position: [0.1, 0, 0] });
    const c = weaponCalibrationStore.getExact("guerrier", "sword_1h");
    expect(c?.scale).toBe(0.5);
    expect(c?.position).toEqual([0.1, 0, 0]);
    weaponCalibrationStore.reset("guerrier", "sword_1h");
  });
});
