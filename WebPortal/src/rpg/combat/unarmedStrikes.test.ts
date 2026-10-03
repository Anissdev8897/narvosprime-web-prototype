import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { STRIKES, strikeForStep, strikeDamage, isMirrored, type StrikeId } from "./unarmedStrikes";

const FPP = path.resolve(__dirname, "../../../public/models/animations/FPP_combat_fists/Animations/No_Rootmotion");

describe("catalogue de frappes", () => {
  it("chaque coup a ses deux côtés", () => {
    for (const base of ["jab", "hook", "uppercut", "kick"]) {
      expect(STRIKES[`${base}_l`], `${base}_l`).toBeDefined();
      expect(STRIKES[`${base}_r`], `${base}_r`).toBeDefined();
    }
  });

  it("le côté déclaré correspond au suffixe", () => {
    for (const [id, s] of Object.entries(STRIKES)) {
      expect(s.side, id).toBe(id.endsWith("_l") ? "left" : "right");
    }
  });

  it("le premier clip de chaque POING existe réellement sur le disque", () => {
    // Les poings ont 36 clips latéralisés à la source : aucun ne doit manquer.
    // (Les pieds sont exclus : un seul clip existe, le gauche est un miroir.)
    const manquants: string[] = [];
    for (const [id, s] of Object.entries(STRIKES)) {
      if (s.kind === "kick") continue;
      const f = path.join(FPP, `${s.clips[0]}.glb`);
      if (!fs.existsSync(f)) manquants.push(`${id} → ${s.clips[0]}.glb`);
    }
    expect(manquants, `clips absents :\n${manquants.join("\n")}`).toEqual([]);
  });

  it("le clip de coup de pied existe, et il est unique", () => {
    expect(fs.existsSync(path.join(FPP, "attack_special_kick.glb"))).toBe(true);
    // Les DEUX pieds pointent sur le MÊME fichier — c'est voulu : il n'en
    // existe qu'un, le gauche s'obtient par miroir.
    expect(STRIKES.kick_l.clips[0]).toBe(STRIKES.kick_r.clips[0]);
  });

  it("seul le pied GAUCHE est miroité", () => {
    expect(isMirrored("kick_l")).toBe(true);
    expect(isMirrored("kick_r")).toBe(false);
    for (const id of ["jab_l", "jab_r", "hook_l", "hook_r", "uppercut_l", "uppercut_r"] as StrikeId[]) {
      expect(isMirrored(id), id).toBe(false);
    }
  });
});

describe("strikeForStep", () => {
  it("ALTERNE les côtés — jamais deux fois le même poing d'affilée", () => {
    // Le point qui compte : une série « gauche gauche gauche » se lit comme une
    // animation en boucle, pas comme un combat. L'alternance vient de la
    // PARITÉ du pas, elle ne peut donc pas dépendre d'un tirage.
    const cotes = [1, 2, 3, 4, 5, 6].map((s) => STRIKES[strikeForStep(s, false)].side);
    for (let i = 1; i < cotes.length; i++) {
      expect(cotes[i], `pas ${i + 1} identique au précédent`).not.toBe(cotes[i - 1]);
    }
  });

  it("le côté du finisher ne dépend PAS du hasard", () => {
    // Le tirage choisit la NATURE (pied ou uppercut), jamais le côté.
    const gauche = [0, 0.49, 0.5, 0.99].map((r) => STRIKES[strikeForStep(3, true, () => r)].side);
    expect(new Set(gauche).size, "le côté a varié avec le rng").toBe(1);
  });

  it("le finisher varie en nature", () => {
    const pied = STRIKES[strikeForStep(3, true, () => 0.1)].kind;
    const poing = STRIKES[strikeForStep(3, true, () => 0.9)].kind;
    expect(pied).toBe("kick");
    expect(poing).toBe("uppercut");
  });

  it("commence par un jab, enchaîne sur un crochet", () => {
    expect(STRIKES[strikeForStep(1, false)].kind).toBe("jab");
    expect(STRIKES[strikeForStep(2, false)].kind).toBe("jab");
    expect(STRIKES[strikeForStep(3, false)].kind).toBe("hook");
  });
});

describe("strikeDamage", () => {
  it("un uppercut frappe plus fort qu'un jab", () => {
    expect(strikeDamage("uppercut_r", 10, false)).toBeGreaterThan(strikeDamage("jab_r", 10, false));
  });

  it("les deux côtés font les MÊMES dégâts", () => {
    // Sinon le joueur serait puni d'avoir enchaîné du mauvais pied.
    for (const b of ["jab", "hook", "uppercut", "kick"]) {
      expect(strikeDamage(`${b}_l`, 12, false)).toBe(strikeDamage(`${b}_r`, 12, false));
    }
  });

  it("le finisher double, et se COMPOSE avec le type de coup", () => {
    const simple = strikeDamage("uppercut_r", 10, false);
    expect(strikeDamage("uppercut_r", 10, true)).toBe(simple * 2);
  });

  it("monte avec la puissance et ne descend jamais sous 1", () => {
    expect(strikeDamage("jab_l", 50, false)).toBeGreaterThan(strikeDamage("jab_l", 0, false));
    expect(strikeDamage("jab_l", 0, false)).toBeGreaterThanOrEqual(1);
  });

  it("un pied porte plus loin qu'un jab", () => {
    expect(STRIKES.kick_r.range).toBeGreaterThan(STRIKES.jab_r.range);
  });
});
