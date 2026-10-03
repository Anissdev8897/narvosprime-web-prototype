// ancestorFallback.test.ts — repli d'ancêtre sur un squelette d'accueil plus pauvre.
//
// Les noms d'os utilisés ici sont ceux MESURÉS le 03/08/2026 : mannequin UE5
// Biker (161 os, `spine_01..05`, `neck_01/02`) contre corps Quaternius (65 os,
// `spine_01..03`, `neck_01`, `Head` avec majuscule).
//
// Idée reprise du plugin UniGLB (dérivé de VRM4U, MIT) : quand l'emplacement
// demandé manque, substituer l'ancêtre le plus proche plutôt qu'abandonner.

import { describe, it, expect } from "vitest";
import { buildBoneRemap, weightedCoverage, zeroUnmatchedWeights } from "./boneRemap";
import { nearestAvailableAncestor, HUMANOID_PARENT } from "../../animation/humanoidBones";

/** Squelette Quaternius réel, réduit aux os porteurs. */
const QUATERNIUS = [
  "root", "pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "Head",
  "clavicle_l", "upperarm_l", "lowerarm_l", "hand_l",
  "thigh_l", "calf_l", "foot_l", "ball_l",
];

/** Mannequin UE5 réel, réduit — noter `spine_04/05` et `neck_02` en plus. */
const MANNEQUIN = [
  "root", "pelvis", "spine_01", "spine_02", "spine_03", "spine_04", "spine_05",
  "neck_01", "neck_02", "head",
  "clavicle_l", "upperarm_l", "lowerarm_l", "hand_l",
  "thigh_l", "calf_l", "foot_l", "ball_l",
];

describe("HUMANOID_PARENT", () => {
  it("remonte la colonne jusqu'aux hanches", () => {
    expect(HUMANOID_PARENT.head).toBe("neck");
    expect(HUMANOID_PARENT.neck).toBe("upperChest");
    expect(HUMANOID_PARENT.upperChest).toBe("chest");
    expect(HUMANOID_PARENT.chest).toBe("spine");
    expect(HUMANOID_PARENT.spine).toBe("hips");
  });

  it("les hanches sont la racine — pas de parent", () => {
    expect(HUMANOID_PARENT.hips).toBeUndefined();
  });

  it("ne contient aucun cycle", () => {
    // Une table mal éditée (`chest → chest`) bloquerait le chargement sans
    // message. Le garde existe dans le code, mais la table doit être saine.
    for (const départ of Object.keys(HUMANOID_PARENT) as (keyof typeof HUMANOID_PARENT)[]) {
      const vus = new Set<string>([départ]);
      let cur = HUMANOID_PARENT[départ];
      while (cur) {
        expect(vus.has(cur), `cycle sur ${départ} → ${cur}`).toBe(false);
        vus.add(cur);
        cur = HUMANOID_PARENT[cur];
      }
    }
  });
});

describe("nearestAvailableAncestor", () => {
  it("trouve l'ancêtre présent en sautant les absents", () => {
    const dispo = new Set(["spine", "hips"] as const);
    // upperChest absent, chest absent → spine
    expect(nearestAvailableAncestor("upperChest", dispo as never)).toBe("spine");
  });

  it("rend null quand aucun ancêtre n'existe", () => {
    expect(nearestAvailableAncestor("head", new Set() as never)).toBeNull();
  });

  it("les hanches n'ont nulle part où remonter", () => {
    expect(nearestAvailableAncestor("hips", new Set(["hips"]) as never)).toBeNull();
  });
});

describe("buildBoneRemap — repli sur un rig plus pauvre", () => {
  it("mannequin → Quaternius : plus aucun os perdu", () => {
    // `spine_04`, `spine_05` et `neck_02` n'existent pas chez Quaternius — ils
    // se résolvent par EMPLACEMENT (upperChest → spine_03, neck → neck_01),
    // sans même avoir besoin de remonter la chaîne. Le repli n'intervient que
    // sur un rig encore plus pauvre (cas suivant).
    const { remap, unmatched } = buildBoneRemap(MANNEQUIN, QUATERNIUS);
    expect(unmatched).toHaveLength(0);
    expect(remap.every((v) => v >= 0)).toBe(true);
  });

  it("sur un rig à deux vertèbres, le repli prend le relais", () => {
    // Cible sans `upperChest` ni `chest` : le haut du dos doit retomber sur
    // `spine`, et non être abandonné.
    const PAUVRE = ["root", "pelvis", "spine_01", "neck_01", "head", "hand_l"];
    const { remap, fallbacks, unmatched } = buildBoneRemap(MANNEQUIN, PAUVRE);

    expect(fallbacks.length, "aucun repli déclenché").toBeGreaterThan(0);
    expect(fallbacks).toContain("spine_03");
    expect(unmatched).not.toContain("spine_03");
    expect(PAUVRE[remap[MANNEQUIN.indexOf("spine_03")]]).toBe("spine_01");
  });

  it("spine_04 atterrit sur une vertèbre, pas dans le vide", () => {
    const { remap } = buildBoneRemap(MANNEQUIN, QUATERNIUS);
    const i = MANNEQUIN.indexOf("spine_04");
    const cible = QUATERNIUS[remap[i]];
    expect(cible, "spine_04 non résolu").toBeDefined();
    expect(cible.startsWith("spine")).toBe(true);
  });

  it("head trouve Head malgré la majuscule", () => {
    // Différence de casse pure : c'est la seule chose qui séparait nos têtes du
    // corps Quaternius, et elle coûtait 100 % du poids de la tête.
    const { remap } = buildBoneRemap(MANNEQUIN, QUATERNIUS);
    expect(QUATERNIUS[remap[MANNEQUIN.indexOf("head")]]).toBe("Head");
  });

  it("ne se replie PAS quand la correspondance directe existe", () => {
    // Sinon on dégraderait des assemblages qui marchaient déjà.
    const { fallbacks } = buildBoneRemap(QUATERNIUS, MANNEQUIN);
    expect(fallbacks).not.toContain("spine_01");
    expect(fallbacks).not.toContain("hand_l");
  });

  it("laisse non apparié un os hors anatomie", () => {
    const { unmatched } = buildBoneRemap(["weapon_socket", "ik_hand_gun"], MANNEQUIN);
    expect(unmatched).toEqual(["weapon_socket", "ik_hand_gun"]);
  });
});

describe("effet mesurable sur le poids conservé", () => {
  /** Pièce fictive : la moitié du poids repose sur `spine_04`, absent chez Quaternius. */
  const idx = [
    MANNEQUIN.indexOf("spine_03"), MANNEQUIN.indexOf("spine_04"), 0, 0,
  ];
  const poids = [0.5, 0.5, 0, 0];

  it("sans ancêtre disponible, la moitié du poids est perdue", () => {
    // Squelette d'accueil sans aucune colonne : rien à quoi se raccrocher.
    const { remap } = buildBoneRemap(MANNEQUIN, ["root", "hand_l"]);
    expect(weightedCoverage(idx, poids, remap)).toBeLessThan(0.5);
  });

  it("avec repli, la totalité du poids est conservée", () => {
    const { remap } = buildBoneRemap(MANNEQUIN, QUATERNIUS);
    expect(weightedCoverage(idx, poids, remap)).toBe(1);
  });

  it("aucun poids n'est annulé après le repli", () => {
    // `zeroUnmatchedWeights` neutralise les influences non résolues. Le repli
    // doit les avoir résolues AVANT, sinon le sommet rétrécirait quand même.
    const { remap } = buildBoneRemap(MANNEQUIN, QUATERNIUS);
    const w = new Float32Array(poids);
    zeroUnmatchedWeights(idx, w, remap);
    expect(w[0] + w[1]).toBeCloseTo(1, 6);
  });
});
