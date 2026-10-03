import { describe, it, expect } from "vitest";
import { distanceBand, Band, NEAR_MAX, MID_MAX } from "./distanceBand";

describe("distanceBand", () => {
  it("NEAR sous NEAR_MAX", () => {
    expect(distanceBand((NEAR_MAX - 1) ** 2)).toBe(Band.NEAR);
  });
  it("MID entre NEAR_MAX et MID_MAX", () => {
    expect(distanceBand((NEAR_MAX + 1) ** 2)).toBe(Band.MID);
    expect(distanceBand((MID_MAX - 1) ** 2)).toBe(Band.MID);
  });
  it("FAR au-delà de MID_MAX", () => {
    expect(distanceBand((MID_MAX + 1) ** 2)).toBe(Band.FAR);
  });
  it("borne exacte NEAR_MAX = NEAR (inclusif)", () => {
    expect(distanceBand(NEAR_MAX ** 2)).toBe(Band.NEAR);
  });
});
