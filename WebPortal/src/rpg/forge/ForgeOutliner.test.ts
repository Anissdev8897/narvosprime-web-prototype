// ForgeOutliner.test.ts — Regroupement catégorie → modèle → instances.
//
// `buildOutline` est de la logique PURE (aucun DOM, aucun R3F) : elle se teste
// donc en env `node`, comme le reste du runtime (cf. CLAUDE.md, Pattern 1).

import { describe, it, expect } from "vitest";
import { buildOutline } from "./ForgeOutliner";
import type { ForgeObject } from "./forgeSceneStore";

function obj(id: string, model: string, x = 0): ForgeObject {
  return { id, model, pos: [x, 0, 0], rot: [0, 0, 0], scale: [1, 1, 1] };
}

describe("buildOutline", () => {
  it("regroupe les instances d'un même modèle sous une seule entrée", () => {
    const out = buildOutline([
      obj("a", "/models/nature/tree01.glb"),
      obj("b", "/models/nature/tree01.glb"),
      obj("c", "/models/nature/tree01.glb"),
    ]);

    expect(out).toHaveLength(1);
    expect(out[0].models).toHaveLength(1);
    expect(out[0].models[0].instances).toHaveLength(3);
    expect(out[0].total).toBe(3);
  });

  it("sépare les catégories d'après le premier segment sous /models/", () => {
    const out = buildOutline([
      obj("a", "/models/nature/tree01.glb"),
      obj("b", "/models/vehicule/car.glb"),
    ]);

    expect(out.map((c) => c.name)).toEqual(["nature", "vehicule"]);
  });

  it("trie les catégories ET les modèles par nom", () => {
    const out = buildOutline([
      obj("a", "/models/vehicule/zeppelin.glb"),
      obj("b", "/models/nature/tree01.glb"),
      obj("c", "/models/nature/bush01.glb"),
      obj("d", "/models/vehicule/avion.glb"),
    ]);

    expect(out.map((c) => c.name)).toEqual(["nature", "vehicule"]);
    expect(out[0].models.map((m) => m.name)).toEqual(["bush01", "tree01"]);
    expect(out[1].models.map((m) => m.name)).toEqual(["avion", "zeppelin"]);
  });

  it("nettoie le nom affiché : extension retirée, séparateurs en espaces", () => {
    const out = buildOutline([obj("a", "/models/nature/pine_tree-02.glb")]);
    expect(out[0].models[0].name).toBe("pine tree 02");
  });

  it("range sous « divers » un chemin hors de /models/", () => {
    const out = buildOutline([obj("a", "/autre/dossier/truc.glb")]);
    expect(out[0].name).toBe("divers");
  });

  it("conserve un identifiant de modèle STABLE (le chemin, pas le nom affiché)", () => {
    // Deux GLB de dossiers différents peuvent porter le même nom de fichier :
    // les distinguer par le nom affiché les fusionnerait à tort.
    const out = buildOutline([
      obj("a", "/models/nature/rock.glb"),
      obj("b", "/models/nature/cliffs/rock.glb"),
    ]);

    expect(out[0].models).toHaveLength(2);
    expect(new Set(out[0].models.map((m) => m.key)).size).toBe(2);
  });

  it("renvoie une liste vide sans objet", () => {
    expect(buildOutline([])).toEqual([]);
  });
});
