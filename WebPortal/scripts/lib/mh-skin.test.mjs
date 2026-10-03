// mh-skin.test.mjs — conversion des poids MakeHuman vers le skinning glTF.
//
// Trois défaillances silencieuses sont verrouillées ici : troncature non triée,
// poids non renormalisés, sommets orphelins. Aucune ne produit d'erreur — elles
// produisent un personnage qui se déforme mal.

import { describe, it, expect } from "vitest";
import {
  buildSkinAttributes, boneHeadPosition, topologicalBoneOrder, INFLUENCES,
} from "./mh-skin.mjs";

const OS = ["mixamorig:Hips", "mixamorig:Spine", "mixamorig:Head", "mixamorig:LeftArm", "mixamorig:RightArm"];

describe("buildSkinAttributes", () => {
  it("répartit un groupe par os en influences par sommet", () => {
    const { joints, weights } = buildSkinAttributes(
      { "mixamorig:Head": [[0, 1]], "mixamorig:Spine": [[1, 1]] }, OS, 2,
    );
    expect(joints[0]).toBe(2);                  // Head = index 2
    expect(weights[0]).toBe(1);
    expect(joints[INFLUENCES]).toBe(1);         // Spine = index 1
  });

  it("garde les QUATRE PLUS FORTES, pas les quatre premières", () => {
    // L'ordre des clés JSON n'a aucun sens anatomique. Tronquer sans trier
    // ferait qu'un bras suivrait la tête selon la sérialisation du fichier.
    const { joints, weights } = buildSkinAttributes({
      "mixamorig:Hips": [[0, 0.05]],
      "mixamorig:Spine": [[0, 0.05]],
      "mixamorig:Head": [[0, 0.05]],
      "mixamorig:LeftArm": [[0, 0.05]],
      "mixamorig:RightArm": [[0, 0.8]],         // dernière déclarée, mais dominante
    }, OS, 1);

    expect(Array.from(joints.slice(0, 4))).toContain(4);   // RightArm conservé
    expect(weights[0]).toBeCloseTo(0.8 / 0.95, 5);          // et dominant
  });

  it("renormalise à 1 après troncature", () => {
    // Sans ça, le sommet rétrécit vers l'origine dès que le squelette bouge.
    const { weights } = buildSkinAttributes({
      "mixamorig:Hips": [[0, 0.3]], "mixamorig:Spine": [[0, 0.3]],
      "mixamorig:Head": [[0, 0.2]], "mixamorig:LeftArm": [[0, 0.1]],
      "mixamorig:RightArm": [[0, 0.1]],
    }, OS, 1);
    const somme = weights[0] + weights[1] + weights[2] + weights[3];
    expect(somme).toBeCloseTo(1, 6);
  });

  it("renormalise aussi des groupes déjà non normalisés", () => {
    const { weights } = buildSkinAttributes({ "mixamorig:Hips": [[0, 3]], "mixamorig:Head": [[0, 1]] }, OS, 1);
    expect(weights[0] + weights[1]).toBeCloseTo(1, 6);
    expect(weights[0]).toBeCloseTo(0.75, 6);
  });

  it("rattache les sommets orphelins au lieu de les laisser à zéro", () => {
    // Un sommet sans influence est figé à l'origine du modèle : il tire une
    // pointe visible depuis le centre du personnage.
    const { joints, weights, orphans } = buildSkinAttributes({ "mixamorig:Head": [[0, 1]] }, OS, 3);
    expect(orphans).toBe(2);
    expect(weights[1 * INFLUENCES]).toBe(1);
    expect(joints[1 * INFLUENCES]).toBe(0);     // os de repli
  });

  it("ignore un os absent du squelette retenu", () => {
    const { joints, orphans } = buildSkinAttributes({ "mixamorig:Tail": [[0, 1]] }, OS, 1);
    expect(orphans).toBe(1);
    expect(joints[0]).toBe(0);
  });

  it("écarte poids nuls, négatifs et indices hors bornes", () => {
    const { orphans } = buildSkinAttributes({
      "mixamorig:Head": [[0, 0], [1, -1], [99, 1]],
    }, OS, 2);
    expect(orphans).toBe(2);
  });

  it("compte les sommets tronqués", () => {
    const { truncated } = buildSkinAttributes({
      "mixamorig:Hips": [[0, 1]], "mixamorig:Spine": [[0, 1]], "mixamorig:Head": [[0, 1]],
      "mixamorig:LeftArm": [[0, 1]], "mixamorig:RightArm": [[0, 1]],
    }, OS, 1);
    expect(truncated).toBe(1);
  });
});

describe("boneHeadPosition", () => {
  it("moyenne les sommets qui définissent l'os", () => {
    // `strategy: "MEAN"` de MPFB2 — c'est ce qui fait suivre le squelette quand
    // les curseurs de morphologie déforment le corps.
    const p = Float32Array.from([0, 0, 0, 2, 4, 6]);
    expect(boneHeadPosition(p, [0, 1], [9, 9, 9])).toEqual([1, 2, 3]);
  });

  it("retombe sur la position par défaut sans indices", () => {
    expect(boneHeadPosition(Float32Array.from([0, 0, 0]), [], [1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("ignore un indice hors bornes plutôt que de lire du vide", () => {
    const p = Float32Array.from([1, 1, 1]);
    expect(boneHeadPosition(p, [0, 500], [9, 9, 9])).toEqual([1, 1, 1]);
  });

  it("tous les indices hors bornes → position par défaut", () => {
    expect(boneHeadPosition(Float32Array.from([1, 1, 1]), [500], [7, 7, 7])).toEqual([7, 7, 7]);
  });
});

describe("topologicalBoneOrder", () => {
  it("place chaque parent avant ses enfants", () => {
    const bones = {
      "Head": { parent: "Neck" },
      "Hips": { parent: "" },
      "Neck": { parent: "Spine" },
      "Spine": { parent: "Hips" },
    };
    const ordre = topologicalBoneOrder(bones);
    for (const [nom, def] of Object.entries(bones)) {
      if (!def.parent) continue;
      expect(ordre.indexOf(def.parent), `${def.parent} après ${nom}`).toBeLessThan(ordre.indexOf(nom));
    }
  });

  it("conserve tous les os", () => {
    const bones = { A: { parent: "" }, B: { parent: "A" }, C: { parent: "A" } };
    expect(topologicalBoneOrder(bones).sort()).toEqual(["A", "B", "C"]);
  });

  it("ne boucle pas sur un cycle dans les données", () => {
    // Un cycle ferait déborder la pile au chargement, sans message exploitable.
    const bones = { A: { parent: "B" }, B: { parent: "A" } };
    expect(() => topologicalBoneOrder(bones)).not.toThrow();
    expect(topologicalBoneOrder(bones)).toHaveLength(2);
  });

  it("tolère un parent inconnu", () => {
    expect(topologicalBoneOrder({ A: { parent: "Fantome" } })).toEqual(["A"]);
  });
});
