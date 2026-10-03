import { describe, it, expect } from "vitest";
import { ARCHETYPES, ARCHETYPE_IDS } from "./archetypeCatalog";
import { weaponAnimPackForType } from "../weapons/weaponAnimationBinder";

describe("archetypeCatalog", () => {
  it("définit 5 archétypes", () => {
    expect(ARCHETYPE_IDS).toEqual(["mage", "archer", "guerrier", "guerrier_spatial", "ninja"]);
  });

  it("chaque ULTIME a un cooldown de base de 60 s", () => {
    for (const id of ARCHETYPE_IDS)
      for (const s of ARCHETYPES[id].spells)
        if (s.isUltimate) expect(s.baseCooldown).toBe(60);
  });

  it("le type d'arme de chaque archétype résout un pack d'animation (vide toléré tant que les GLB animation_* sont absents)", () => {
    for (const id of ARCHETYPE_IDS) {
      // Les packs sont vidés tant que public/models/assets_character/animation_*
      // n'existe pas — la résolution doit rester définie (Array, pas de crash).
      expect(Array.isArray(weaponAnimPackForType(ARCHETYPES[id].weaponType))).toBe(true);
    }
  });

  it("les % PV restent dans une plage saine (]0 .. 0.3])", () => {
    for (const id of ARCHETYPE_IDS)
      for (const s of ARCHETYPES[id].spells)
        if (s.pctPlayerHp != null) {
          expect(s.pctPlayerHp).toBeGreaterThan(0);
          expect(s.pctPlayerHp).toBeLessThanOrEqual(0.3);
        }
  });

  it("ids de sorts uniques", () => {
    const ids = ARCHETYPE_IDS.flatMap((a) => ARCHETYPES[a].spells.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
