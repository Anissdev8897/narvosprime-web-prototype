import { describe, it, expect } from "vitest";
import {
  DEFAULT_PROPORTIONS, PROPORTION_DEFS, PROPORTION_RANGE,
  clampProportion, sanitizeProportions, scaleFactor, isDefaultProportions,
} from "./bodyProportions";

describe("clampProportion", () => {
  it("borne à ±1", () => {
    expect(clampProportion(5)).toBe(1);
    expect(clampProportion(-5)).toBe(-1);
    expect(clampProportion(0.4)).toBe(0.4);
  });

  it("une valeur absente ou non numérique vaut 0", () => {
    // Personnages d'avant les curseurs, ou fichier corrompu : on rend la
    // silhouette d'origine, jamais un personnage tordu.
    expect(clampProportion(undefined)).toBe(0);
    expect(clampProportion(NaN)).toBe(0);
    expect(clampProportion(Infinity)).toBe(0);
  });
});

describe("scaleFactor", () => {
  it("0 laisse l'os intact", () => {
    expect(scaleFactor(0)).toBe(1);
  });

  it("les extrêmes restent dans ±10 %", () => {
    expect(scaleFactor(1)).toBeCloseTo(1 + PROPORTION_RANGE, 6);
    expect(scaleFactor(-1)).toBeCloseTo(1 - PROPORTION_RANGE, 6);
  });

  it("reste STRICTEMENT positif, même hors bornes", () => {
    // Une échelle nulle ou négative retournerait l'os : le membre partirait à
    // l'envers. C'est le garde-fou qui compte le plus ici.
    for (const v of [-99, -1, 0, 1, 99, NaN]) {
      expect(scaleFactor(v as number), `valeur ${v}`).toBeGreaterThan(0);
    }
  });
});

describe("sanitizeProportions", () => {
  it("null / undefined donnent la silhouette d'origine", () => {
    expect(sanitizeProportions(null)).toEqual(DEFAULT_PROPORTIONS);
    expect(sanitizeProportions(undefined)).toEqual(DEFAULT_PROPORTIONS);
  });

  it("borne chaque champ indépendamment", () => {
    const p = sanitizeProportions({ shoulderWidth: 9, waistHeight: -9, armLength: 0.5 });
    expect(p).toEqual({ shoulderWidth: 1, waistHeight: -1, armLength: 0.5 });
  });

  it("un champ manquant ne contamine pas les autres", () => {
    const p = sanitizeProportions({ armLength: 0.3 });
    expect(p.armLength).toBe(0.3);
    expect(p.shoulderWidth).toBe(0);
  });
});

describe("PROPORTION_DEFS — la table qui pilote le rendu", () => {
  it("couvre exactement les champs de BodyProportions", () => {
    // Un curseur ajouté au type sans entrée ici serait réglable et sans effet.
    expect(PROPORTION_DEFS.map((d) => d.key).sort())
      .toEqual(Object.keys(DEFAULT_PROPORTIONS).sort());
  });

  it("nomme des os PRÉCIS, jamais un préfixe", () => {
    // `upperarm` matche 24 os sur ce squelette (twists, correctifs, biceps).
    // Les mettre tous à l'échelle déformerait deux fois la même chair.
    for (const d of PROPORTION_DEFS) {
      expect(d.bones.length, `${d.key} sans os`).toBeGreaterThan(0);
      for (const b of d.bones) {
        expect(b, `${b} ressemble à un préfixe`).not.toMatch(/^(upperarm|lowerarm|spine|clavicle|thigh)$/);
      }
    }
  });

  it("la contre-échelle n'annule jamais l'os qu'elle compense", () => {
    // Un os présent dans `bones` ET `counterBones` recevrait f puis 1/f : le
    // réglage n'aurait aucun effet, sans que rien ne le signale.
    for (const d of PROPORTION_DEFS) {
      for (const c of d.counterBones ?? []) {
        expect(d.bones, `${c} des deux côtés`).not.toContain(c);
      }
    }
  });

  it("la contre-échelle reste finie sur toute la plage", () => {
    // `1 / scaleFactor(v)` : si `scaleFactor` pouvait rendre 0, l'enfant partirait
    // à l'infini. C'est la garantie de positivité stricte qui tient ça.
    for (const v of [-1, -0.5, 0, 0.5, 1]) {
      const inv = 1 / scaleFactor(v);
      expect(Number.isFinite(inv), `valeur ${v}`).toBe(true);
      expect(inv).toBeGreaterThan(0);
    }
  });

  it("les os gauche/droite vont par paire", () => {
    // Un seul côté mis à l'échelle donnerait un personnage asymétrique sans
    // que le curseur ne le laisse deviner.
    for (const d of PROPORTION_DEFS) {
      for (const liste of [d.bones, d.counterBones ?? []]) {
        const g = liste.filter((b) => b.endsWith("_l")).length;
        const dr = liste.filter((b) => b.endsWith("_r")).length;
        expect(g, `${d.key} déséquilibré`).toBe(dr);
      }
    }
  });
});

describe("isDefaultProportions", () => {
  it("vrai à l'origine, faux dès qu'un curseur bouge", () => {
    expect(isDefaultProportions(DEFAULT_PROPORTIONS)).toBe(true);
    expect(isDefaultProportions({ ...DEFAULT_PROPORTIONS, armLength: 0.1 })).toBe(false);
  });
});
