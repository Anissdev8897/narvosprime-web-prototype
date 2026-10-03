// weightedCoverage.test.ts — le critère qui décide d'accepter ou refuser une pièce.
//
// Mesuré le 02/08/2026 : sur le critère par NOMS d'os, 26 des 39 pièces
// découpées étaient refusées, dont `wraith/torso` qui suit pourtant le
// squelette d'accueil à 100 %. Ces tests verrouillent la différence entre les
// deux mesures — c'est elle qui rend l'éditeur modulaire possible.

import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { weightedCoverage, buildBoneRemap } from "./boneRemap";

describe("weightedCoverage", () => {
  it("ignore les os non appariés qui ne portent aucun poids", () => {
    // Le cas Paragon : os 1 et 2 sont des twist non appariés, à poids nul.
    const remap = new Int32Array([0, -1, -1]);
    const idx = [0, 1, 2, 0];
    const poids = [1, 0, 0, 0];
    expect(weightedCoverage(idx, poids, remap)).toBe(1);
  });

  it("condamne une pièce dont le poids repose sur des os absents", () => {
    // Le cas des têtes à rig facial (murdock/head : 17,9 % du poids apparié).
    const remap = new Int32Array([0, -1]);
    const idx = [0, 1, 1, 1];
    const poids = [0.2, 0.4, 0.2, 0.2];
    expect(weightedCoverage(idx, poids, remap)).toBeCloseTo(0.2, 6);
  });

  it("diverge du critère par noms — c'est tout l'intérêt", () => {
    // 1 os apparié sur 3 = 33 % par noms, mais il porte tout le poids.
    const remap = new Int32Array([0, -1, -1]);
    const parNom = 1 / 3;
    const parPoids = weightedCoverage([0, 0, 0, 0], [0.25, 0.25, 0.25, 0.25], remap);
    expect(parNom).toBeLessThan(0.5);
    expect(parPoids).toBe(1);
  });

  it("rend 0 sur une pièce sans aucun poids", () => {
    // Renvoyer 1 (« tout le poids apparié ») ferait passer un maillage
    // inexploitable pour un succès.
    expect(weightedCoverage([0, 0, 0, 0], [0, 0, 0, 0], new Int32Array([0]))).toBe(0);
  });

  it("traite un index hors borne comme non apparié", () => {
    expect(weightedCoverage([5], [1], new Int32Array([0]))).toBe(0);
  });

  it("s'accorde avec buildBoneRemap sur des noms réels", () => {
    // `upperarm_twist_01_l` n'existe pas sur le mannequin UE5 : non apparié,
    // mais il ne porte ici que 1 % du poids.
    const { remap } = buildBoneRemap(
      ["pelvis", "spine_01", "upperarm_twist_01_l"],
      ["pelvis", "spine_01", "head"],
    );
    expect(remap[2]).toBe(-1);
    expect(weightedCoverage([0, 1, 2, 0], [0.5, 0.49, 0.01, 0], remap)).toBeCloseTo(0.99, 6);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Attribut ENTRELACÉ — le défaut qui refusait des pièces greffables.
//
// `getAttribute("skinIndex").array` d'un `InterleavedBufferAttribute` rend le
// TAMPON PARTAGÉ entier (positions, normales, UV, joints, poids mélangés), pas
// les seuls indices. `rebindSkinnedMesh` le lisait tel quel : les valeurs lues
// étaient arbitraires, la plupart hors bornes, donc non comptées.
//
// Mesuré en jeu : `samurai_hair` refusé à 17 % de poids, alors que le même
// fichier donne 100 % hors ligne avec 100 % de noms appariés — deux chiffres
// qui ne peuvent pas coexister si la lecture est juste.
// ══════════════════════════════════════════════════════════════════════════════

describe("lecture d'un attribut entrelacé", () => {
  /** Reproduit `aplatir` de rebindSkinnedMesh : accesseurs, jamais `.array`. */
  const aplatir = (a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) => {
    const out: number[] = [];
    for (let i = 0; i < a.count; i++) out.push(a.getX(i), a.getY(i), a.getZ(i), a.getW(i));
    return out;
  };

  it("`.array` d'un attribut entrelacé n'est PAS l'attribut", () => {
    // 2 sommets · stride 12 : position(3) + normale(3) + joints(4) + poids… ici
    // on ne garde que les 4 joints à l'offset 6, le reste est du remplissage.
    const brut = new Float32Array([
      /* v0 */ 9, 9, 9, 8, 8, 8, 0, 1, 0, 0, 7, 7,
      /* v1 */ 9, 9, 9, 8, 8, 8, 1, 0, 0, 0, 7, 7,
    ]);
    const inter = new THREE.InterleavedBuffer(brut, 12);
    const joints = new THREE.InterleavedBufferAttribute(inter, 4, 6);

    // Le piège, rendu explicite : le tampon fait 24 valeurs pour 2 sommets.
    expect(joints.array.length).toBe(24);
    expect(joints.count).toBe(2);
    // Et sa 1re valeur est une POSITION, pas un indice d'os.
    expect(joints.array[0]).toBe(9);

    // Les accesseurs, eux, rendent les vrais joints.
    expect(aplatir(joints)).toEqual([0, 1, 0, 0, 1, 0, 0, 0]);
  });

  it("couverture 100 % en entrelacé quand tous les os sont appariés", () => {
    const brut = new Float32Array([
      /* v0 */ 9, 9, 9, 0, 1, 0, 0, 0.5, 0.5, 0, 0,
      /* v1 */ 9, 9, 9, 1, 0, 0, 0, 1.0, 0.0, 0, 0,
    ]);
    const inter = new THREE.InterleavedBuffer(brut, 11);
    const joints = new THREE.InterleavedBufferAttribute(inter, 4, 3);
    const poids = new THREE.InterleavedBufferAttribute(inter, 4, 7);

    const { remap, coverage } = buildBoneRemap(["pelvis", "spine_01"], ["pelvis", "spine_01"]);
    expect(coverage).toBe(1); // tous les noms appariés…

    // …donc le poids DOIT suivre. C'est l'égalité que le défaut brisait.
    expect(weightedCoverage(aplatir(joints), aplatir(poids), remap)).toBeCloseTo(1, 6);
  });
});
