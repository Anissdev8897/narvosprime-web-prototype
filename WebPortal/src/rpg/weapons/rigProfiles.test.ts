import { describe, it, expect } from "vitest";
import { RIG_PROFILES } from "./rigProfiles";

describe("RIG_PROFILES", () => {
  const families = ["mixamo", "quaternius", "custom"] as const;
  const sockets = ["RightHand", "LeftHand", "Spine", "Head"] as const;

  it("chaque famille a un pattern RegExp pour chaque socket", () => {
    for (const f of families) for (const s of sockets)
      expect(RIG_PROFILES[f][s]).toBeInstanceOf(RegExp);
  });

  it("mixamo.RightHand matche RightHand & mixamorig:RightHand, pas RightHandIndex1", () => {
    const re = RIG_PROFILES.mixamo.RightHand;
    expect(re.test("RightHand")).toBe(true);
    expect(re.test("mixamorig:RightHand")).toBe(true);
    expect(re.test("RightHandIndex1")).toBe(false);
  });

  it("quaternius.RightHand matche hand_r ; custom.RightHand matche ValveBiped.Hand_R", () => {
    expect(RIG_PROFILES.quaternius.RightHand.test("hand_r")).toBe(true);
    expect(RIG_PROFILES.custom.RightHand.test("ValveBiped.Hand_R")).toBe(true);
  });
});
