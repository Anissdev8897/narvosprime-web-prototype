import { describe, it, expect } from "vitest";
import { buildRegistry, weaponRegistry } from "./weaponRegistry";

describe("buildRegistry", () => {
  it("ignore le profil malformé, garde le valide", () => {
    const reg = buildRegistry({
      good: { id: "good", type: "staff", path: "/g.glb", socket: "RightHand", offset: {} },
      bad: { id: 123 },
    });
    expect(reg.good).toBeDefined();
    expect(reg.bad).toBeUndefined();
  });
  it("normalise les défauts (visibility=always, grip=one_hand)", () => {
    const reg = buildRegistry({
      m: { id: "m", type: "staff", path: "/m.glb", socket: "RightHand", offset: {} },
    });
    expect(reg.m.visibility).toBe("always");
    expect(reg.m.grip).toBe("one_hand");
  });
});

describe("weaponRegistry (seed)", () => {
  it("expose les armes d'archétype valides et résiste aux ids inconnus", () => {
    // Les bâtons rpg/ (fantasy_staff…) ont été retirés : leurs fichiers sont supprimés.
    expect(weaponRegistry.has("arch_sword")).toBe(true);
    expect(weaponRegistry.get("arch_staff")?.type).toBe("staff");
    expect(weaponRegistry.get("nope")).toBeUndefined();
    expect(weaponRegistry.get(undefined)).toBeUndefined();
    expect(weaponRegistry.all().length).toBeGreaterThanOrEqual(3);
  });
});
