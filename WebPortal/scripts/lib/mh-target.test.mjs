// mh-target.test.mjs — lecture du format de cibles MakeHuman.
//
// Les échantillons proviennent des vrais fichiers MPFB2 (`nose-base-down`,
// mesuré le 03/08/2026). Les trois pièges de parsing y sont : flottants sans
// zéro initial, séparateurs variables, lignes vides.

import { describe, it, expect } from "vitest";
import {
  parseTarget, applyTarget, parseObjPositions, targetIdFromPath, maxDelta,
} from "./mh-target.mjs";

const REEL = `161 0 -.011 0
184 0 -.005 0
197 0 -.026 0`;

describe("parseTarget", () => {
  it("lit un extrait réel de nose-base-down", () => {
    const { indices, deltas, skipped } = parseTarget(REEL);
    expect(Array.from(indices)).toEqual([161, 184, 197]);
    expect(deltas[1]).toBeCloseTo(-0.011, 6);
    expect(deltas[7]).toBeCloseTo(-0.026, 6);
    expect(skipped).toBe(0);
  });

  it("accepte un flottant sans zéro initial", () => {
    // `-.011` est la graphie standard des fichiers MakeHuman. Un parseur qui
    // exige `-0.011` perdrait la quasi-totalité des deltas.
    expect(parseTarget("5 .5 -.25 0").deltas[0]).toBeCloseTo(0.5, 6);
    expect(parseTarget("5 .5 -.25 0").deltas[1]).toBeCloseTo(-0.25, 6);
  });

  it("tolère tabulations, espaces multiples et lignes vides", () => {
    const { indices, skipped } = parseTarget("1\t0\t1\t0\n\n  2   0  2  0  \n\n");
    expect(Array.from(indices)).toEqual([1, 2]);
    expect(skipped).toBe(0);
  });

  it("ignore les commentaires", () => {
    expect(parseTarget("# entête\n7 1 1 1").indices).toHaveLength(1);
  });

  it("ÉCARTE un indice hors bornes au lieu de le garder", () => {
    // Conserver un indice supérieur au nombre de sommets provoquerait une
    // écriture hors tableau à l'application du delta.
    const { indices, skipped } = parseTarget("3 1 1 1\n99999 1 1 1", 10);
    expect(Array.from(indices)).toEqual([3]);
    expect(skipped).toBe(1);
  });

  it("écarte une ligne incomplète ou non numérique", () => {
    const { indices, skipped } = parseTarget("1 0 1\nabc 0 1 0\n2 0 1 0");
    expect(Array.from(indices)).toEqual([2]);
    expect(skipped).toBe(2);
  });

  it("fichier vide → cible vide, pas une erreur", () => {
    const { indices, deltas } = parseTarget("");
    expect(indices).toHaveLength(0);
    expect(deltas).toHaveLength(0);
  });
});

describe("applyTarget", () => {
  const base = () => Float32Array.from([0, 0, 0, 10, 10, 10, 20, 20, 20]);

  it("déplace uniquement les sommets listés", () => {
    const p = base();
    const { indices, deltas } = parseTarget("1 1 2 3");
    applyTarget(p, indices, deltas, 1);
    expect(Array.from(p)).toEqual([0, 0, 0, 11, 12, 13, 20, 20, 20]);
  });

  it("pondère le déplacement", () => {
    const p = base();
    const { indices, deltas } = parseTarget("1 2 0 0");
    applyTarget(p, indices, deltas, 0.5);
    expect(p[3]).toBeCloseTo(11, 6);
  });

  it("un poids nul ne touche rien et ne coûte rien", () => {
    const p = base();
    const { indices, deltas } = parseTarget("1 5 5 5");
    expect(applyTarget(p, indices, deltas, 0)).toBe(0);
    expect(Array.from(p)).toEqual(Array.from(base()));
  });

  it("les cibles s'additionnent", () => {
    // Nez plus long ET plus large : deux curseurs, un seul maillage.
    const p = base();
    applyTarget(p, ...Object.values(parseTarget("1 1 0 0")).slice(0, 2), 1);
    applyTarget(p, ...Object.values(parseTarget("1 0 3 0")).slice(0, 2), 1);
    expect(p[3]).toBeCloseTo(11, 6);
    expect(p[4]).toBeCloseTo(13, 6);
  });

  it("un poids négatif inverse la déformation", () => {
    // MakeHuman livre souvent une paire `-up` / `-down` ; un curseur bipolaire
    // peut n'en utiliser qu'une, appliquée en négatif.
    const p = base();
    const { indices, deltas } = parseTarget("1 0 1 0");
    applyTarget(p, indices, deltas, -1);
    expect(p[4]).toBeCloseTo(9, 6);
  });
});

describe("parseObjPositions", () => {
  it("ne retient QUE les lignes `v`", () => {
    // `vt` et `vn` commencent aussi par `v` : les inclure décalerait tous les
    // indices de cible et déformerait le maillage n'importe comment.
    const obj = [
      "# base.obj",
      "v 1 2 3",
      "vt 0.5 0.5",
      "vn 0 1 0",
      "v 4 5 6",
      "f 1/1/1 2/2/2 3/3/3",
    ].join("\n");
    expect(Array.from(parseObjPositions(obj))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("gère les coordonnées négatives et décimales", () => {
    expect(Array.from(parseObjPositions("v -0.5 1.25 -3"))).toEqual([-0.5, 1.25, -3]);
  });
});

describe("targetIdFromPath", () => {
  it("encode le chemin, pas un compteur", () => {
    const t = targetIdFromPath("macrodetails/height/height-baby.target.gz");
    expect(t.id).toBe("macrodetails.height.height-baby");
    expect(t.category).toBe("macrodetails/height");
    expect(t.name).toBe("height-baby");
  });

  it("accepte les séparateurs Windows", () => {
    expect(targetIdFromPath("nose\\nose-base-down.target.gz").id).toBe("nose.nose-base-down");
  });

  it("une cible à la racine reste identifiable", () => {
    const t = targetIdFromPath("solo.target");
    expect(t.id).toBe("solo");
    expect(t.category).toBe("root");
  });
});

describe("maxDelta", () => {
  it("trouve l'amplitude, signe indifférent", () => {
    expect(maxDelta(Float32Array.from([0.001, -0.026, 0.01]))).toBeCloseTo(0.026, 6);
  });

  it("cible vide → 0", () => {
    expect(maxDelta(Float32Array.from([]))).toBe(0);
  });
});
