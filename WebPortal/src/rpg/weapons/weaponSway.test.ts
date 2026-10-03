import { describe, it, expect } from "vitest";
import { WeaponSway } from "./weaponSway";

describe("WeaponSway", () => {
  it("returns zero when camera is stationary", () => {
    const s = new WeaponSway();
    s.update(0, 0, 0.016);
    s.update(0, 0, 0.016);
    const off = s.getOffset();
    expect(off.x).toBe(0);
    expect(off.y).toBe(0);
  });

  it("produces offset on yaw change", () => {
    const s = new WeaponSway();
    s.update(0, 0, 0.016);
    s.update(0.1, 0, 0.016);
    s.update(0.2, 0, 0.016);
    const off = s.getOffset();
    expect(off.x).not.toBe(0);
  });

  it("clamps offset within maxOffset", () => {
    const maxOff = 0.06;
    const s = new WeaponSway(80, 10, 4, maxOff);
    s.update(0, 0, 0.016);
    for (let i = 0; i < 100; i++) {
      s.update(i * 0.5, 0, 0.016);
    }
    const off = s.getOffset();
    expect(Math.abs(off.x)).toBeLessThanOrEqual(maxOff);
    expect(Math.abs(off.y)).toBeLessThanOrEqual(maxOff);
  });

  it("resets to zero", () => {
    const s = new WeaponSway();
    s.update(0, 0, 0.016);
    s.update(1, 0, 0.016);
    s.reset();
    const off = s.getOffset();
    expect(off.x).toBe(0);
    expect(off.y).toBe(0);
  });
});
