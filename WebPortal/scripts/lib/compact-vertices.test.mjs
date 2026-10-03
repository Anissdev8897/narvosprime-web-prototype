// compact-vertices.test.mjs — la compaction ne doit RIEN changer au rendu.
//
// Le test qui compte est le dernier : on reconstruit la géométrie triangle par
// triangle avant et après, et on exige l'égalité. Vérifier seulement les
// tailles laisserait passer une permutation appliquée aux positions mais pas
// aux morph targets — exactement le bug que `draco()` provoque sur ces assets.

import { describe, it, expect } from "vitest";
import { compactionPlan, gatherElements, remapIndices } from "./compact-vertices.mjs";

describe("compactionPlan", () => {
  it("ne garde que les sommets référencés", () => {
    // 6 sommets déclarés, seuls 0, 2, 4 servent.
    const { remap, used, count } = compactionPlan([0, 2, 4], 6);
    expect(count).toBe(3);
    expect(Array.from(used)).toEqual([0, 2, 4]);
    expect(remap[1]).toBe(-1);
    expect(remap[3]).toBe(-1);
    expect(remap[5]).toBe(-1);
  });

  it("numérote dans l'ordre de première apparition, pas croissant", () => {
    // Classement voulu : les sommets d'un même triangle restent voisins.
    const { remap, used } = compactionPlan([5, 3, 1], 6);
    expect(remap[5]).toBe(0);
    expect(remap[3]).toBe(1);
    expect(remap[1]).toBe(2);
    expect(Array.from(used)).toEqual([5, 3, 1]);
  });

  it("dédoublonne un sommet partagé par deux triangles", () => {
    const { count } = compactionPlan([0, 1, 2, 2, 1, 3], 4);
    expect(count).toBe(4);
  });

  it("ne fait rien quand tout est déjà utilisé", () => {
    // Cas de la découpe d'auteur (wraith/torso : 100 % de sommets utiles) —
    // l'appelant doit pouvoir détecter qu'il n'y a rien à gagner.
    const { count } = compactionPlan([0, 1, 2], 3);
    expect(count).toBe(3);
  });

  it("ignore un index hors borne au lieu de corrompre le remap", () => {
    const { count, remap } = compactionPlan([0, 1, 99], 2);
    expect(count).toBe(2);
    expect(remap.length).toBe(2);
  });
});

describe("gatherElements", () => {
  it("préserve le type du tableau source", () => {
    // JOINTS_0 est en Uint16 : repasser en Float32 changerait la sémantique
    // de l'accesseur et casserait le skinning.
    const src = new Uint16Array([10, 11, 12, 13, 20, 21, 22, 23]);
    const out = gatherElements(src, 4, new Uint32Array([1]));
    expect(out).toBeInstanceOf(Uint16Array);
    expect(Array.from(out)).toEqual([20, 21, 22, 23]);
  });

  it("réordonne selon la permutation", () => {
    const src = new Float32Array([0, 0, 0, 1, 1, 1, 2, 2, 2]);
    const out = gatherElements(src, 3, new Uint32Array([2, 0]));
    expect(Array.from(out)).toEqual([2, 2, 2, 0, 0, 0]);
  });
});

describe("remapIndices", () => {
  it("traduit vers la nouvelle numérotation", () => {
    const { remap } = compactionPlan([4, 5, 6], 8);
    expect(Array.from(remapIndices([4, 5, 6], remap))).toEqual([0, 1, 2]);
  });
});

describe("round-trip — la géométrie rendue est identique", () => {
  /** Reconstruit la liste des triangles comme le ferait le GPU. */
  const triangles = (positions, indices, size = 3) =>
    Array.from(indices, (v) => Array.from(positions.slice(v * size, v * size + size)));

  it("positions ET morph targets suivent la même permutation", () => {
    // 5 sommets, mais seuls 3 servent — et un morph target les déplace.
    const vertexCount = 5;
    const positions = new Float32Array([
      0, 0, 0,   9, 9, 9,   1, 0, 0,   8, 8, 8,   0, 1, 0,
    ]);
    const morph = new Float32Array([
      0, 0, 1,   0, 0, 0,   0, 0, 2,   0, 0, 0,   0, 0, 3,
    ]);
    const indices = [0, 2, 4];

    const avant = triangles(positions, indices);
    const avantMorph = triangles(morph, indices);

    const { remap, used, count } = compactionPlan(indices, vertexCount);
    const newPos = gatherElements(positions, 3, used);
    const newMorph = gatherElements(morph, 3, used);
    const newIdx = remapIndices(indices, remap);

    expect(count).toBe(3);
    expect(newPos.length).toBe(9);
    // Le point du test : même géométrie, même déformation, malgré la renumérotation.
    expect(triangles(newPos, newIdx)).toEqual(avant);
    expect(triangles(newMorph, newIdx)).toEqual(avantMorph);
  });

  it("un attribut oublié se voit — garde-fou du test précédent", () => {
    // Si on compacte les positions mais PAS le morph target, le round-trip doit
    // échouer. Sans cette vérification, le test ci-dessus pourrait passer pour
    // de mauvaises raisons.
    const positions = new Float32Array([0, 0, 0, 9, 9, 9, 1, 0, 0]);
    const morph = new Float32Array([0, 0, 1, 0, 0, 0, 0, 0, 2]);
    const indices = [0, 2];

    const { remap, used } = compactionPlan(indices, 3);
    const newPos = gatherElements(positions, 3, used);
    const newIdx = remapIndices(indices, remap);

    expect(triangles(newPos, newIdx)).toEqual(triangles(positions, indices));
    expect(triangles(morph, newIdx)).not.toEqual(triangles(morph, indices));
  });
});
