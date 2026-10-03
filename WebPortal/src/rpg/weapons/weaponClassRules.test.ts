import { describe, it, expect } from "vitest";
import {
  archetypeAllowsWeapon, weaponTypeCanReload, archetypeCanReload, allowedWeaponsFor,
} from "./weaponClassRules";

describe("archetypeAllowsWeapon", () => {
  it("archer accepte l'arc, REFUSE l'arme à feu (règle explicite)", () => {
    expect(archetypeAllowsWeapon("archer", "bow")).toBe(true);
    expect(archetypeAllowsWeapon("archer", "gun")).toBe(false);
  });
  it("mage : bâton seulement, pas d'épée", () => {
    expect(archetypeAllowsWeapon("mage", "staff")).toBe(true);
    expect(archetypeAllowsWeapon("mage", "sword_1h")).toBe(false);
  });
  it("guerrier : mêlée + bouclier, pas d'arc/feu/bâton", () => {
    expect(archetypeAllowsWeapon("guerrier", "sword_2h")).toBe(true);
    expect(archetypeAllowsWeapon("guerrier", "shield")).toBe(true);
    expect(archetypeAllowsWeapon("guerrier", "bow")).toBe(false);
    expect(archetypeAllowsWeapon("guerrier", "gun")).toBe(false);
  });
  it("guerrier_spatial : arme à feu", () => {
    expect(archetypeAllowsWeapon("guerrier_spatial", "gun")).toBe(true);
  });
  it("ninja : dague + épée 1 main, pas d'épée 2 mains", () => {
    expect(archetypeAllowsWeapon("ninja", "dagger")).toBe(true);
    expect(archetypeAllowsWeapon("ninja", "sword_1h")).toBe(true);
    expect(archetypeAllowsWeapon("ninja", "sword_2h")).toBe(false);
  });
  it("non-armes (ammo/throwable/ignore) refusées partout", () => {
    for (const a of ["mage", "archer", "guerrier", "guerrier_spatial", "ninja"] as const) {
      expect(archetypeAllowsWeapon(a, "ammo")).toBe(false);
      expect(archetypeAllowsWeapon(a, "ignore")).toBe(false);
    }
  });
});

describe("reload", () => {
  it("seules les armes à feu se rechargent", () => {
    expect(weaponTypeCanReload("gun")).toBe(true);
    expect(weaponTypeCanReload("bow")).toBe(false);
    expect(weaponTypeCanReload("staff")).toBe(false);
  });
  it("seul guerrier_spatial recharge de base", () => {
    expect(archetypeCanReload("guerrier_spatial")).toBe(true);
    expect(archetypeCanReload("archer")).toBe(false);
    expect(archetypeCanReload("mage")).toBe(false);
    expect(archetypeCanReload("guerrier")).toBe(false);
    expect(archetypeCanReload("ninja")).toBe(false);
  });
});

describe("allowedWeaponsFor", () => {
  it("retourne une copie défensive (mutation sans effet de bord)", () => {
    const a = allowedWeaponsFor("archer");
    a.push("gun");
    expect(allowedWeaponsFor("archer")).toEqual(["bow"]);
  });
});
