// morph-prune.test.mjs — ne supprimer QUE des cibles qui ne déplacent rien.
//
// Le test décisif est « OU logique entre primitives » : c'est la seule erreur
// de cette passe qui serait invisible à l'écriture du fichier et ne se verrait
// qu'en jeu, sur une expression faciale figée.

import { describe, it, expect } from "vitest";
import { isNullDelta, combineAliveMasks, filterByMask } from "./morph-prune.mjs";

describe("isNullDelta", () => {
  it("détecte une cible entièrement nulle", () => {
    expect(isNullDelta([new Float32Array([0, 0, 0, 0, 0, 0])])).toBe(true);
  });

  it("un seul delta non nul suffit à la garder", () => {
    expect(isNullDelta([new Float32Array([0, 0, 0, 0, 0.5, 0])])).toBe(false);
  });

  it("regarde TOUTES les sémantiques, pas seulement la première", () => {
    // Une cible peut ne bouger aucune position mais tordre les normales.
    const positions = new Float32Array([0, 0, 0]);
    const normals = new Float32Array([0, 1, 0]);
    expect(isNullDelta([positions, normals])).toBe(false);
  });

  it("un delta négatif compte autant qu'un positif", () => {
    expect(isNullDelta([new Float32Array([0, -0.5, 0])])).toBe(false);
  });

  it("applique le seuil quand il est fourni", () => {
    const bruit = new Float32Array([0, 1e-7, 0]);
    expect(isNullDelta([bruit], 0)).toBe(false);
    expect(isNullDelta([bruit], 1e-5)).toBe(true);
  });

  it("tolère une sémantique absente", () => {
    expect(isNullDelta([null, new Float32Array([0, 0, 0])])).toBe(true);
  });
});

describe("combineAliveMasks", () => {
  it("une cible survit si UNE SEULE primitive la fait bouger", () => {
    // Le piège central : la tête d'Echo est répartie sur 9 primitives. Un ET
    // logique tuerait des cibles encore utilisées par une primitive voisine.
    const alive = combineAliveMasks([
      [false, false, true],
      [false, false, false],
      [true, false, false],
    ]);
    expect(alive).toEqual([true, false, true]);
  });

  it("toutes nulles partout → toutes supprimables", () => {
    expect(combineAliveMasks([[false, false], [false, false]])).toEqual([false, false]);
  });

  it("un seul jeu de primitives passe tel quel", () => {
    expect(combineAliveMasks([[true, false, true]])).toEqual([true, false, true]);
  });

  it("mesh sans primitive → aucune cible", () => {
    expect(combineAliveMasks([])).toEqual([]);
  });
});

describe("filterByMask", () => {
  it("aligne les poids du mesh sur les cibles conservées", () => {
    // Si les poids ne suivent pas, chaque cible restante prend la valeur de sa
    // voisine — décalage silencieux.
    expect(filterByMask([0.1, 0.2, 0.3], [true, false, true])).toEqual([0.1, 0.3]);
  });

  it("aligne aussi les noms de cibles", () => {
    expect(filterByMask(["sourire", "clignement", "mâchoire"], [false, true, true]))
      .toEqual(["clignement", "mâchoire"]);
  });

  it("rend undefined quand l'entrée l'était", () => {
    // Un mesh sans poids déclarés ne doit pas s'en voir inventer.
    expect(filterByMask(undefined, [true])).toBeUndefined();
  });
});
