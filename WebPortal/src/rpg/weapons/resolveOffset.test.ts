import { describe, it, expect } from "vitest";
import { resolveOffset } from "./resolveOffset";
import type { WeaponProfile } from "./weaponTypes";

const base: WeaponProfile = {
  id: "x", type: "staff", path: "/x.glb", grip: "two_hand", socket: "RightHand",
  visibility: "always",
  offset: { position: [1, 2, 3], rotation: [0.1, 0.2, 0.3], scale: 2 },
  offsets: { mixamo: { rotation: [9, 9, 9] } },
};

describe("resolveOffset", () => {
  it("override de famille prioritaire ; le reste vient de la base", () => {
    const r = resolveOffset(base, "mixamo");
    expect(r.rotation).toEqual([9, 9, 9]);
    expect(r.position).toEqual([1, 2, 3]);
    expect(r.scale).toBe(2);
  });
  it("sans override → base", () => {
    expect(resolveOffset(base, "quaternius").rotation).toEqual([0.1, 0.2, 0.3]);
  });
  it("sans offset du tout → identité, jamais d'exception", () => {
    const empty = { ...base, offset: {}, offsets: undefined };
    expect(resolveOffset(empty, "custom")).toEqual({ position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 });
  });
});
