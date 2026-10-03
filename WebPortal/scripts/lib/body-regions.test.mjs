// body-regions.test.mjs — classement des morceaux de personnage en régions.
//
// Les noms testés ici sont ceux MESURÉS dans les vrais GLB du projet le
// 02/08/2026, pas des exemples inventés. Si un pack change, ce fichier est le
// premier endroit où ça doit se voir.

import { describe, it, expect } from "vitest";
import { regionFromMaterial, regionFromBone, isPreSegmented, REGIONS } from "./body-regions.mjs";

describe("regionFromMaterial — noms réels des héros", () => {
  it("classe les matériaux de Murdock (déjà segmenté)", () => {
    expect(regionFromMaterial("M_Murdock_Head_Murdock")).toBe("head");
    expect(regionFromMaterial("M_Murdock_Arms_Murdock")).toBe("arms");
    expect(regionFromMaterial("M_Murdock_Legs_Murdock")).toBe("legs");
    expect(regionFromMaterial("M_Murdock_Body_Murdock")).toBe("torso");
  });

  it("classe les matériaux de Boris", () => {
    expect(regionFromMaterial("M_Boris_Torso1")).toBe("torso");
    expect(regionFromMaterial("M_Boris_Arms_Inst1")).toBe("arms");
    expect(regionFromMaterial("M_Boris_Legs_Inst1_Boris")).toBe("legs");
    expect(regionFromMaterial("M_Boris_Hair1")).toBe("hair");
  });

  it("distingue upperbody et lowerbody chez Wraith", () => {
    // Le piège : un motif générique `body` classerait les DEUX en torse.
    expect(regionFromMaterial("M_Wraith_Upperbody_Wraith")).toBe("torso");
    expect(regionFromMaterial("M_Wraith_Lowerbody_Wraith")).toBe("legs");
    expect(regionFromMaterial("M_Wraith_Backpack_Wraith")).toBe("accessory");
  });

  it("classe les matériaux de Steel", () => {
    expect(regionFromMaterial("M_UpperBody")).toBe("torso");
    expect(regionFromMaterial("M_LowerBody")).toBe("legs");
    expect(regionFromMaterial("M_SteelTeeth")).toBe("head");
  });

  it("rend null sur un placeholder — et c'est le point", () => {
    // Echo n'a que `WorldGridMaterial`. Le classer en torse par défaut ferait
    // croire à une segmentation là où il n'y en a aucune, et empêcherait de
    // basculer sur l'os dominant. `null` EST le résultat utile.
    expect(regionFromMaterial("WorldGridMaterial")).toBeNull();
    expect(regionFromMaterial("Material.001")).toBeNull();
    expect(regionFromMaterial("")).toBeNull();
  });

  it("ne rend que des régions déclarées", () => {
    const noms = ["M_X_Head", "M_X_Arms", "M_X_Legs", "M_X_Hair", "M_X_Backpack", "M_X_Boots", "M_X_Gloves"];
    for (const n of noms) {
      const r = regionFromMaterial(n);
      if (r) expect(REGIONS).toContain(r);
    }
  });
});

describe("regionFromBone — deux conventions de rig", () => {
  it("convention UE (tous les héros mesurés)", () => {
    expect(regionFromBone("head")).toBe("head");
    expect(regionFromBone("neck_01")).toBe("head");
    expect(regionFromBone("upperarm_l")).toBe("arms");
    expect(regionFromBone("lowerarm_r")).toBe("arms");
    expect(regionFromBone("hand_l")).toBe("hands");
    expect(regionFromBone("index_01_r")).toBe("hands");
    expect(regionFromBone("thigh_l")).toBe("legs");
    expect(regionFromBone("calf_r")).toBe("legs");
    expect(regionFromBone("foot_l")).toBe("feet");
    expect(regionFromBone("ball_r")).toBe("feet");
    expect(regionFromBone("spine_03")).toBe("torso");
    expect(regionFromBone("pelvis")).toBe("torso");
  });

  it("convention Mixamo/Meshy, préfixe compris", () => {
    expect(regionFromBone("mixamorig:Head")).toBe("head");
    expect(regionFromBone("LeftArm")).toBe("arms");
    expect(regionFromBone("RightUpLeg")).toBe("legs");
    expect(regionFromBone("LeftHand")).toBe("hands");
    expect(regionFromBone("RightToeBase")).toBe("feet");
    expect(regionFromBone("mixamorig:Spine1")).toBe("torso");
  });

  it("la main l'emporte sur le bras", () => {
    // `hand_l` est enfant de `lowerarm_l` : si la règle « arm » passait avant,
    // toute la main tomberait dans les bras et l'emplacement `hands` serait vide.
    expect(regionFromBone("hand_l")).toBe("hands");
    expect(regionFromBone("middle_02_l")).toBe("hands");
  });

  it("le pied l'emporte sur la jambe", () => {
    expect(regionFromBone("foot_r")).toBe("feet");
    expect(regionFromBone("ball_l")).toBe("feet");
  });

  it("rend null sur un os non anatomique", () => {
    expect(regionFromBone("ik_hand_gun")).toBeNull();
    expect(regionFromBone("weapon_socket")).toBeNull();
    expect(regionFromBone("")).toBeNull();
  });
});

describe("isPreSegmented — quel chemin de découpe", () => {
  it("Murdock et Boris : découpe d'auteur exploitable", () => {
    expect(isPreSegmented(["M_Murdock_Body_Murdock", "M_Murdock_Head_Murdock", "M_Murdock_Arms_Murdock"])).toBe(true);
    expect(isPreSegmented(["M_Boris_Torso1", "M_Boris_Arms_Inst1", "M_Boris_Hair1"])).toBe(true);
  });

  it("Echo : un seul matériau anonyme → segmentation par os obligatoire", () => {
    expect(isPreSegmented(["WorldGridMaterial"])).toBe(false);
  });

  it("un corps + un sac à dos n'est PAS segmenté anatomiquement", () => {
    // Cas Wraith réduit : `accessory` ne doit pas compter comme une région
    // anatomique, sinon on croirait la découpe faite alors qu'il manque la tête.
    expect(isPreSegmented(["M_X_Body", "M_X_Backpack"])).toBe(false);
  });

  it("Wraith : upperbody + lowerbody comptent (torse + jambes)", () => {
    // Deux régions anatomiques distinctes → la découpe par matériau donne déjà
    // quelque chose. La tête manquera : c'est un manque de CONTENU, pas de méthode.
    expect(isPreSegmented(["M_Wraith_Upperbody_Wraith", "M_Wraith_Lowerbody_Wraith", "M_Wraith_Backpack_Wraith"])).toBe(true);
  });

  it("liste vide ou absente", () => {
    expect(isPreSegmented([])).toBe(false);
    expect(isPreSegmented(undefined)).toBe(false);
  });
});
