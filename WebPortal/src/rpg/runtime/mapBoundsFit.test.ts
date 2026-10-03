import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { fitMapExtent } from "./mapBoundsFit";
import { SHELL_THRESHOLDS } from "./envelopingShell";

/** Mesh boîte de `taille` unités, posé à `pos`, avec `segments` pour densifier. */
function boite(taille: number, pos: [number, number, number], segments = 1): THREE.Mesh {
  const g = new THREE.BoxGeometry(taille, taille, taille, segments, segments, segments);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
  m.position.set(...pos);
  m.updateMatrixWorld(true);
  return m;
}

describe("fitMapExtent", () => {
  it("rend null quand il n'y a rien à mesurer", () => {
    // Poser un mur sur une mesure vide enfermerait le joueur dans un volume
    // dégénéré : ne rien poser est le comportement sûr.
    expect(fitMapExtent(null)).toBeNull();
    expect(fitMapExtent(new THREE.Group())).toBeNull();
  });

  it("cerne la géométrie avec une marge des DEUX côtés", () => {
    const root = new THREE.Group();
    root.add(boite(100, [0, 0, 0]));
    root.updateMatrixWorld(true);
    const r = fitMapExtent(root, [], 10)!;
    expect(r.center).toEqual([0, 0, 0]);
    // 100 de large + 10 de chaque côté = 120, pas 110.
    expect(r.size).toEqual([120, 120, 120]);
    expect(r.meshCount).toBe(1);
  });

  it("écarte les coques enveloppantes", () => {
    // Le cas orbital : une boîte de ciel énorme et peu dense ferait exploser
    // l'emprise et rendrait la limite inutile.
    const root = new THREE.Group();
    root.add(boite(100, [0, 0, 0], 20));                        // décor dense
    root.add(boite(SHELL_THRESHOLDS.DIAGONALE_MIN * 3, [0, 0, 0])); // coque creuse
    root.updateMatrixWorld(true);
    const r = fitMapExtent(root, [], 0)!;
    expect(r.shellsSkipped).toBe(1);
    expect(r.size[0]).toBe(100);
  });

  it("ÉLARGIT l'emprise pour inclure les points fournis", () => {
    // C'est la demande d'origine : les PNJ et les animaux étaient hors zone.
    const root = new THREE.Group();
    root.add(boite(100, [0, 0, 0], 20));
    root.updateMatrixWorld(true);
    const r = fitMapExtent(root, [[300, 0, 0]], 0)!;
    // Emprise de -50 à 300 → centre 125, largeur 350.
    expect(r.center[0]).toBe(125);
    expect(r.size[0]).toBe(350);
  });

  it("les points n'ont jamais l'effet de RÉTRÉCIR l'emprise", () => {
    const root = new THREE.Group();
    root.add(boite(100, [0, 0, 0], 20));
    root.updateMatrixWorld(true);
    const sans = fitMapExtent(root, [], 0)!;
    const avec = fitMapExtent(root, [[0, 0, 0]], 0)!;
    expect(avec.size).toEqual(sans.size);
  });

  it("suit la transform monde du parent, pas les coordonnées locales", () => {
    // Les maps portent un offset ([181, -401, -47] sur la Forge) : mesurer en
    // local donnerait une limite décalée de plusieurs centaines d'unités.
    const root = new THREE.Group();
    root.position.set(181, -401, -47);
    root.add(boite(100, [0, 0, 0], 20));
    root.updateMatrixWorld(true);
    const r = fitMapExtent(root, [], 0)!;
    expect(r.center).toEqual([181, -401, -47]);
  });

  it("fonctionne sans géométrie, à partir des seuls points", () => {
    const r = fitMapExtent(null, [[0, 0, 0], [100, 20, 40]], 0)!;
    expect(r.center).toEqual([50, 10, 20]);
    expect(r.size).toEqual([100, 20, 40]);
    expect(r.meshCount).toBe(0);
  });
});
