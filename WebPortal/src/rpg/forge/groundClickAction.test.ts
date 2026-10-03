import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { decideGroundClick } from "./groundClickAction";
import type { SurfacePick } from "../runtime/CollisionWorld";

// Un sol de Forge : bien SOUS zéro. C'est tout l'enjeu de M1 — se rabattre sur
// le plan capteur (y ≈ 0) plaçait les objets ~51 m au-dessus du terrain.
const SOL_FORGE = new THREE.Vector3(12, -51, 7);

const hit = (): SurfacePick => ({
  status: "hit",
  point: SOL_FORGE.clone(),
  normal: new THREE.Vector3(0, 1, 0),
  object: new THREE.Mesh(),
});
const miss = (): SurfacePick => ({ status: "miss" });
const empty = (): SurfacePick => ({ status: "empty" });

describe("decideGroundClick — pose uniquement sur une surface réelle", () => {
  it("pose l'objet au point touché, très en dessous de zéro", () => {
    const a = decideGroundClick(hit(), "select", true);
    expect(a.kind).toBe("place");
    if (a.kind !== "place") return;
    expect(a.point.y).toBeCloseTo(-51, 3);
    expect(a.point.y).not.toBeCloseTo(0, 1); // le repli M1 rendrait 0
  });

  it("l'outil spline pose aussi au point réel — le chemin qui était resté troué", () => {
    // Ce chemin utilisait `surfacePt = hit ? point : e.point`, donc y ≈ 0 hors hit.
    const a = decideGroundClick(hit(), "spline", false);
    expect(a.kind).toBe("spline");
    if (a.kind !== "spline") return;
    expect(a.point.y).toBeCloseTo(-51, 3);
  });

  it("la végétation se disperse au point réel", () => {
    const a = decideGroundClick(hit(), "vegetation", true);
    expect(a.kind).toBe("scatter");
    if (a.kind !== "scatter") return;
    expect(a.point.y).toBeCloseTo(-51, 3);
  });
});

describe("decideGroundClick — jamais de pose hors « hit »", () => {
  const modes = ["select", "spline", "vegetation"] as const;

  it("aucun mode ne pose quoi que ce soit sur un « miss »", () => {
    for (const m of modes) {
      for (const asset of [true, false]) {
        const a = decideGroundClick(miss(), m, asset);
        expect(["none", "deselect"]).toContain(a.kind);
      }
    }
  });

  it("aucun mode ne pose quoi que ce soit sur un « empty »", () => {
    for (const m of modes) {
      for (const asset of [true, false]) {
        expect(decideGroundClick(empty(), m, asset).kind).toBe("none");
      }
    }
  });
});

describe("decideGroundClick — empty ≠ miss", () => {
  it("« empty » ne désélectionne pas : on ignore le clic, on ne sait rien", () => {
    // Le monde n'est pas encore peuplé. Désélectionner ferait perdre la sélection
    // du joueur sur un simple clic pendant le chargement.
    expect(decideGroundClick(empty(), "select", false).kind).toBe("none");
  });

  it("« miss » désélectionne : le monde est là, le joueur a cliqué dans le vide", () => {
    expect(decideGroundClick(miss(), "select", false).kind).toBe("deselect");
  });

  it("un asset en main n'est jamais perdu sur un clic raté", () => {
    // Régression M1-C : `onPlacementMode(false)` s'exécutait même en échec, donc
    // le joueur perdait sa sélection sans rien obtenir.
    expect(decideGroundClick(miss(), "select", true).kind).toBe("none");
    expect(decideGroundClick(empty(), "select", true).kind).toBe("none");
  });

  it("un « hit » sans asset ni outil désélectionne", () => {
    expect(decideGroundClick(hit(), "select", false).kind).toBe("deselect");
  });
});
