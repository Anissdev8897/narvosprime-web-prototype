import { describe, it, expect, beforeEach } from "vitest";
import { damageEvents } from "./damageEvents";
import { rollDamage, CRIT_MULT } from "./rollDamage";

describe("damageEvents", () => {
  beforeEach(() => damageEvents.clear());

  it("emit → drain dans l'ordre, puis file vide", () => {
    damageEvents.emit(1, 2, 3, 10, "hit");
    damageEvents.emit(4, 5, 6, 20, "crit");
    const buf = damageEvents.drain([]);
    expect(buf.map((e) => e.amount)).toEqual([10, 20]);
    expect(damageEvents.drain([]).length).toBe(0);
  });

  it("markNextCrit consommé UNE seule fois", () => {
    damageEvents.markNextCrit();
    expect(damageEvents.consumeNextCrit()).toBe(true);
    expect(damageEvents.consumeNextCrit()).toBe(false);
  });

  it("file bornée (64) — les plus anciens sortent", () => {
    for (let i = 0; i < 70; i++) damageEvents.emit(0, 0, 0, i, "hit");
    const buf = damageEvents.drain([]);
    expect(buf.length).toBe(64);
    expect(buf[0].amount).toBe(6); // 0-5 évincés
  });
});

describe("rollDamage", () => {
  it("crit = ×1,75 arrondi ; sinon base", () => {
    expect(rollDamage(100, 100, () => 0.5)).toEqual({ amount: Math.round(100 * CRIT_MULT), isCrit: true });
    expect(rollDamage(100, 0, () => 0.5)).toEqual({ amount: 100, isCrit: false });
  });
  it("probabilité respectée (critPct en %)", () => {
    expect(rollDamage(50, 30, () => 0.29).isCrit).toBe(true);
    expect(rollDamage(50, 30, () => 0.31).isCrit).toBe(false);
  });
});
