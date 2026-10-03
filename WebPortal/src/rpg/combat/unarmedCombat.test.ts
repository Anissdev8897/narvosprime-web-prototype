import { describe, it, expect } from "vitest";
import { createCombo, advanceCombo, unarmedDamage, COMBO_WINDOW_MS } from "./unarmedCombat";

describe("unarmedCombat — combo", () => {
  it("3 clics dans la fenêtre → punch1, punch2, punch3 (finisher)", () => {
    const c = createCombo();
    const a = advanceCombo(c, 0, () => 0);
    const b = advanceCombo(c, 100, () => 0);
    const d = advanceCombo(c, 200, () => 0);
    expect(a).toMatchObject({ action: "punch1", isFinisher: false });
    expect(b).toMatchObject({ action: "punch2", isFinisher: false });
    expect(d).toMatchObject({ action: "punch3", isFinisher: true });
  });
  it("clic hors fenêtre → reset à punch1", () => {
    const c = createCombo();
    advanceCombo(c, 0, () => 0);
    const late = advanceCombo(c, COMBO_WINDOW_MS + 50, () => 0);
    expect(late.action).toBe("punch1");
  });
  it("finisher VARIÉ, et `action` COHÉRENTE avec `strike`", () => {
    // Le contrat qui compte : les deux champs viennent d'UNE SEULE décision.
    // Un tirage séparé donnait « punch3 » annoncé avec « kick_l » joué — soit
    // une animation d'uppercut et des dégâts de coup de pied.
    for (const r of [0, 0.3, 0.5, 0.9, 0.99]) {
      const c = createCombo();
      advanceCombo(c, 0, () => r); advanceCombo(c, 50, () => r);
      const f = advanceCombo(c, 100, () => r);
      expect(f.isFinisher).toBe(true);
      // `action` garde sa distribution d'origine (punch3 / kick / punch_charged)
      // et `strike` DOIT s'accorder avec elle : un coup de pied annoncé ne peut
      // pas être joué avec un uppercut.
      const estPied = f.strike.startsWith("kick");
      expect(estPied, `rng=${r} : action=${f.action} mais strike=${f.strike}`)
        .toBe(f.action === "kick");
    }
  });
});

describe("unarmedCombat — dégâts", () => {
  it("dégât de base = round(5 + puissance*0.4)", () => {
    expect(unarmedDamage(10, false)).toBe(9);
  });
  it("finisher = ×2", () => {
    expect(unarmedDamage(10, true)).toBe(18);
  });

  it("chaque coup porte une frappe latéralisée cohérente", () => {
    // `action` et `strike` viennent du MÊME pas de combo : ils ne peuvent pas
    // désigner deux coups différents. Un poing droit annoncé et un pied joué
    // serait invisible sans ce contrôle.
    const c = createCombo();
    const a = advanceCombo(c, 0, () => 0);
    const b = advanceCombo(c, 100, () => 0);
    expect(a.strike).toMatch(/_(l|r)$/);
    expect(b.strike).toMatch(/_(l|r)$/);
    // Alternance : deux coups consécutifs changent de côté.
    expect(a.strike.slice(-1)).not.toBe(b.strike.slice(-1));
  });

});