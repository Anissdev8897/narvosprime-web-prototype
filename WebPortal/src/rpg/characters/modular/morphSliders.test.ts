import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { analyseMorph, construireSliders, poidsDuSlider, poidsDesSliders } from "./morphSliders";
import { parseMorphSet } from "./morphSet";
import type { MorphRegion } from "./morphLoader";
import { REGIONS_FINES } from "./useMorphSliders";

const RACINE = path.resolve(__dirname, "../../../../public/models/personnages/_body/morphs");

function nomsDe(region: MorphRegion): string[] {
  const f = path.join(RACINE, `${region}.morphs`);
  if (!fs.existsSync(f)) return [];
  const set = parseMorphSet(fs.readFileSync(f).buffer as ArrayBuffer);
  return [...set.morphs.keys()];
}

describe("analyseMorph — la convention MakeHuman", () => {
  it("apparie les deux extrémités d'un axe", () => {
    const a = analyseMorph("nose-flaring-decr")!;
    const b = analyseMorph("nose-flaring-incr")!;
    expect(a.axe).toBe(b.axe);
    expect(a.positif).toBe(false);
    expect(b.positif).toBe(true);
  });

  it("ramène gauche et droite sur le MÊME axe", () => {
    // Sans ça, chaque oreille aurait ses propres curseurs : 22 au lieu de 11.
    const g = analyseMorph("l-ear-lobe-incr")!;
    const d = analyseMorph("r-ear-lobe-incr")!;
    expect(g.axe).toBe(d.axe);
    expect(g.cote).toBe("gauche");
    expect(d.cote).toBe("droite");
  });

  it("écarte les formes discrètes — elles ne s'interpolent pas", () => {
    // Un curseur entre « rond » et « triangulaire » traverserait des états qui
    // n'existent pas.
    expect(analyseMorph("head-oval")).toBeNull();
    expect(analyseMorph("head-round")).toBeNull();
  });

  it("écarte l'axe de fermeté — trois ancres, pas deux", () => {
    expect(analyseMorph("breast-something-maxfirmness")).toBeNull();
    expect(analyseMorph("breast-something-averagefirmness")).toBeNull();
  });
});

describe("construireSliders — sur les VRAIS packs", () => {
  const attendus: { region: MorphRegion; min: number }[] = [
    { region: "nose", min: 10 },
    { region: "ears", min: 8 },
    { region: "cheek", min: 3 },
    { region: "stomach", min: 3 },
    { region: "chin", min: 3 },
    { region: "mouth", min: 8 },
  ];

  for (const { region, min } of attendus) {
    it(`« ${region} » produit des curseurs exploitables`, () => {
      const noms = nomsDe(region);
      expect(noms.length, `pack ${region} introuvable ou vide`).toBeGreaterThan(0);

      const sliders = construireSliders(region, noms);
      expect(sliders.length).toBeGreaterThanOrEqual(min);

      // Un curseur sans ses deux extrémités aurait une course asymétrique.
      for (const s of sliders) {
        expect(s.negatif.length, `${s.id} négatif`).toBeGreaterThan(0);
        expect(s.positif.length, `${s.id} positif`).toBeGreaterThan(0);
      }
    });
  }

  it("les oreilles se pilotent symétriquement", () => {
    const sliders = construireSliders("ears", nomsDe("ears"));
    const sym = sliders.filter((s) => s.symetrique);
    expect(sym.length).toBeGreaterThan(0);
    // Un axe symétrique joue les DEUX oreilles à chaque extrémité.
    for (const s of sym) expect(s.positif.length).toBe(2);
  });

  it("aucun id de curseur en double — deux axes peuvent partager un nom", () => {
    // ⚠ OBSERVÉ EN VRAI : `head-trans` existe en `down/up` ET en `in/out`.
    // L'id ne portait que région + axe : React signalait « two children with
    // the same key » et les deux curseurs écrasaient la même valeur sauvegardée.
    for (const region of REGIONS_FINES) {
      const noms = nomsDe(region);
      if (noms.length === 0) continue;
      const ids = construireSliders(region, noms).map((s) => s.id);
      const doublons = ids.filter((x, i) => ids.indexOf(x) !== i);
      expect([...new Set(doublons)], `région ${region}`).toEqual([]);
    }
  });

  it("toute cible référencée existe vraiment dans le pack", () => {
    // Un nom inventé ne lève rien au runtime : `applyMorphs` ignore les morphs
    // inconnus et le curseur reste sans effet, silencieusement.
    for (const region of ["nose", "ears", "cheek", "stomach"] as MorphRegion[]) {
      const noms = new Set(nomsDe(region));
      for (const s of construireSliders(region, [...noms])) {
        for (const c of [...s.negatif, ...s.positif]) {
          expect(noms.has(c), `${s.id} → « ${c} » absent du pack`).toBe(true);
        }
      }
    }
  });
});

describe("poidsDuSlider", () => {
  const slider = { id: "t.a", region: "nose" as MorphRegion, axe: "a",
    negatif: ["a-decr"], positif: ["a-incr"], symetrique: false };

  it("ne joue qu'une extrémité à la fois", () => {
    // Jouer les deux se soustrairait à peu près : le curseur paraîtrait mort.
    expect(poidsDuSlider(slider, 0.5)).toEqual({ "a-incr": 0.5 });
    expect(poidsDuSlider(slider, -0.5)).toEqual({ "a-decr": 0.5 });
  });

  it("borne la course", () => {
    expect(poidsDuSlider(slider, 4)).toEqual({ "a-incr": 1 });
    expect(poidsDuSlider(slider, -4)).toEqual({ "a-decr": 1 });
  });

  it("à zéro, ne joue rien", () => {
    expect(poidsDesSliders([slider], { "t.a": 0 })).toEqual({});
  });

  it("ignore une valeur absente ou NaN", () => {
    expect(poidsDesSliders([slider], {})).toEqual({});
    expect(poidsDesSliders([slider], { "t.a": NaN })).toEqual({});
  });
});
