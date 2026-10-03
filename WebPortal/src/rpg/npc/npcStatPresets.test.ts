import { describe, it, expect } from "vitest";
import { clampResist, DIFFICULTY_PRESETS, BOSS_STATS, MOB_STATS } from "./npcStatPresets";

describe("npcStatPresets", () => {
  it("clampResist borne 0..0.9", () => {
    expect(clampResist(-1)).toBe(0);
    expect(clampResist(0.5)).toBe(0.5);
    expect(clampResist(5)).toBe(0.9);
  });
  it("chaque preset difficulté expose scaleMult/hpMult/resistMult", () => {
    for (const d of ["facile", "difficile", "expert"] as const) {
      const p = DIFFICULTY_PRESETS[d];
      expect(typeof p.scaleMult).toBe("number");
      expect(typeof p.hpMult).toBe("number");
      expect(typeof p.resistMult).toBe("number");
    }
  });
  it("BOSS_STATS plus costaud que MOB_STATS", () => {
    expect(BOSS_STATS.hpMult).toBeGreaterThan(MOB_STATS.hpMult);
    expect(BOSS_STATS.scaleMult).toBeGreaterThan(MOB_STATS.scaleMult);
  });
});
