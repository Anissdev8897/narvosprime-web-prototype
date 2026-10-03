import { describe, it, expect } from "vitest";
import { calcArchetypeDamage } from "./spellDamage";

describe("calcArchetypeDamage (% PV joueur)", () => {
  it("base = pct × PV max joueur (sans atk ni def)", () => {
    expect(calcArchetypeDamage({ pctPlayerHp: 0.15, playerMaxHp: 100, playerAtk: 0 })).toBe(15);
    expect(calcArchetypeDamage({ pctPlayerHp: 0.25, playerMaxHp: 200, playerAtk: 0 })).toBe(50);
  });

  it("la puissance augmente les dégâts (+1% par point)", () => {
    expect(calcArchetypeDamage({ pctPlayerHp: 0.15, playerMaxHp: 100, playerAtk: 100 })).toBe(30); // ×2
  });

  it("la défense ennemie atténue (def=100 → moitié)", () => {
    expect(calcArchetypeDamage({ pctPlayerHp: 0.2, playerMaxHp: 100, playerAtk: 0, enemyDefense: 100 })).toBe(10);
  });

  it("crit ×1.5", () => {
    expect(calcArchetypeDamage({ pctPlayerHp: 0.2, playerMaxHp: 100, playerAtk: 0, crit: true })).toBe(30);
  });

  it("robuste aux valeurs négatives", () => {
    expect(calcArchetypeDamage({ pctPlayerHp: -1, playerMaxHp: 100, playerAtk: -50 })).toBe(0);
  });
});
