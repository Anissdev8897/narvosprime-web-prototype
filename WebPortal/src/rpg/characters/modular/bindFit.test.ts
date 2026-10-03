// bindFit.test.ts — l'ajustement de pose de bind entre deux morphologies.
//
// Les squelettes sont construits à la main plutôt que chargés depuis un GLB :
// les tests tournent en environnement `node` sans DOM (cf. vitest.config.ts), et
// une géométrie de 4 sommets rend l'attendu vérifiable à la main.

import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { computeFitMatrices, applyFit, maxFitDisplacement } from "./bindFit";

/** Squelette à deux os alignés sur Y, séparés de `span`. */
function makeSkeleton(span: number): THREE.Skeleton {
  const racine = new THREE.Bone();
  const tete = new THREE.Bone();
  racine.name = "pelvis";
  tete.name = "head";
  racine.add(tete);
  tete.position.set(0, span, 0);
  racine.updateMatrixWorld(true);

  const inverses = [racine, tete].map((b) => b.matrixWorld.clone().invert());
  return new THREE.Skeleton([racine, tete], inverses);
}

/** Géométrie d'un sommet unique, entièrement pesé sur l'os `bone`. */
function makeGeometry(p: [number, number, number], bone: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([...p], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0], 3));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute([bone, 0, 0, 0], 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute([1, 0, 0, 0], 4));
  return g;
}

const identite = new Int32Array([0, 1]);

describe("computeFitMatrices", () => {
  it("rend l'identité entre deux squelettes identiques", () => {
    // Cas du pack Biker : corps et vêtements partagent la pose de bind, donc
    // l'ajustement ne doit RIEN faire. Une régression ici déformerait des
    // assemblages qui fonctionnaient.
    const sk = makeSkeleton(1.7);
    const mats = computeFitMatrices(sk, makeSkeleton(1.7), identite);
    expect(maxFitDisplacement(mats)).toBeLessThan(1e-6);
    for (const m of mats) {
      expect(m.elements.map((e) => Math.round(e * 1e6) / 1e6))
        .toEqual(new THREE.Matrix4().elements.map((e) => e));
    }
  });

  it("produit une matrice par os source", () => {
    const mats = computeFitMatrices(makeSkeleton(1), makeSkeleton(2), identite);
    expect(mats).toHaveLength(2);
  });

  it("laisse l'identité pour un os non apparié", () => {
    // -1 = aucun équivalent. Le sommet ne doit pas être déplacé au hasard ; son
    // poids sera de toute façon neutralisé par `zeroUnmatchedWeights`.
    const mats = computeFitMatrices(makeSkeleton(1), makeSkeleton(2), new Int32Array([0, -1]));
    const v = new THREE.Vector3().setFromMatrixPosition(mats[1]);
    expect(v.length()).toBeLessThan(1e-6);
  });
});

describe("applyFit — déplacement effectif", () => {
  it("ramène un sommet de tête à la hauteur du corps d'accueil", () => {
    // Pièce modelée sur un rig de 2,0 ; corps d'accueil à 1,0. Le sommet est à
    // la hauteur de la tête source (2,0) et doit atterrir à 1,0.
    const source = makeSkeleton(2);
    const cible = makeSkeleton(1);
    const geom = makeGeometry([0, 2, 0], 1);

    const bouges = applyFit(geom, computeFitMatrices(source, cible, identite));
    const pos = geom.getAttribute("position").array as Float32Array;

    expect(bouges).toBe(1);
    expect(pos[1]).toBeCloseTo(1, 5);
  });

  it("ne touche pas un sommet quand les rigs sont identiques", () => {
    const geom = makeGeometry([0.3, 1.4, -0.2], 1);
    const bouges = applyFit(geom, computeFitMatrices(makeSkeleton(1.7), makeSkeleton(1.7), identite));
    const pos = geom.getAttribute("position").array as Float32Array;

    expect(bouges).toBe(0);
    expect(pos[0]).toBeCloseTo(0.3, 6);
    expect(pos[1]).toBeCloseTo(1.4, 6);
    expect(pos[2]).toBeCloseTo(-0.2, 6);
  });

  it("laisse en place un sommet sans influence", () => {
    // Poids nuls : renvoyer le sommet à l'origine produirait une pointe vers le
    // centre du modèle, artefact très visible et difficile à diagnostiquer.
    const geom = makeGeometry([0, 2, 0], 1);
    geom.setAttribute("skinWeight", new THREE.Float32BufferAttribute([0, 0, 0, 0], 4));

    applyFit(geom, computeFitMatrices(makeSkeleton(2), makeSkeleton(1), identite));
    const pos = geom.getAttribute("position").array as Float32Array;
    expect(pos[1]).toBeCloseTo(2, 6);
  });

  it("mélange les influences au lieu de choisir un os", () => {
    // Sommet à mi-chemin, pesé 50/50. L'ajustement attendu est la moyenne des
    // deux corrections, pas celle de l'os dominant.
    const geom = makeGeometry([0, 2, 0], 0);
    geom.setAttribute("skinIndex", new THREE.Uint16BufferAttribute([0, 1, 0, 0], 4));
    geom.setAttribute("skinWeight", new THREE.Float32BufferAttribute([0.5, 0.5, 0, 0], 4));

    applyFit(geom, computeFitMatrices(makeSkeleton(2), makeSkeleton(1), identite));
    const pos = geom.getAttribute("position").array as Float32Array;
    // os 0 (racine) : identité → 2,0 · os 1 (tête) : −1 → 1,0 · moyenne 1,5
    expect(pos[1]).toBeCloseTo(1.5, 5);
  });

  it("renvoie 0 sur une géométrie sans skinning", () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([0, 1, 0], 3));
    expect(applyFit(g, [])).toBe(0);
  });
});

describe("maxFitDisplacement", () => {
  it("mesure l'amplitude de la correction", () => {
    const mats = computeFitMatrices(makeSkeleton(2), makeSkeleton(1), identite);
    // La tête descend de 1,0 : c'est exactement ce que l'UI doit pouvoir annoncer.
    expect(maxFitDisplacement(mats)).toBeCloseTo(1, 5);
  });

  it("liste vide → 0", () => {
    expect(maxFitDisplacement([])).toBe(0);
  });
});
