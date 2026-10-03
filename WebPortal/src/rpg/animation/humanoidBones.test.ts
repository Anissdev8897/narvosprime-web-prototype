import { describe, it, expect } from "vitest";
import { humanoidSlotOf, indexSkeletonBySlot, normalizeBoneName, detectConvention } from "./humanoidBones";

describe("humanoidBones — hub canonique", () => {
  it("normalise préfixe, casse et séparateurs", () => {
    expect(normalizeBoneName("mixamorig:LeftArm")).toBe("leftarm");
    expect(normalizeBoneName("spine_01")).toBe("spine01");
    expect(normalizeBoneName("Left-Hand")).toBe("lefthand");
  });

  it("reconnaît les trois conventions vers le MÊME emplacement", () => {
    // Le bassin, dit dans trois dialectes.
    expect(humanoidSlotOf("pelvis")).toBe("hips");           // UE4
    expect(humanoidSlotOf("mixamorig:Hips")).toBe("hips");   // Mixamo
    expect(humanoidSlotOf("hips")).toBe("hips");             // Meshy/VRM
    // Le bras gauche.
    expect(humanoidSlotOf("upperarm_l")).toBe("leftUpperArm");
    expect(humanoidSlotOf("LeftArm")).toBe("leftUpperArm");
  });

  it("la chaîne dorsale exige la convention — sinon aucune supposition", () => {
    // "Spine1" n'est PAS ambigu : seul Mixamo l'écrit ainsi.
    expect(humanoidSlotOf("Spine1")).toBe("chest");
    // "spine01" l'est : Meshy écrit "Spine01" (= chest), UE écrit "spine_01"
    // (= spine) — les deux se normalisent pareil. Sans convention on refuse de
    // trancher : mieux vaut aucun os que le mauvais.
    expect(humanoidSlotOf("Spine01")).toBeNull();
    expect(humanoidSlotOf("spine_01")).toBeNull();
    // Convention fournie → résolution correcte, différente selon le dialecte.
    expect(humanoidSlotOf("Spine1", "MIXAMO")).toBe("chest");
    expect(humanoidSlotOf("Spine2", "MIXAMO")).toBe("upperChest");
    expect(humanoidSlotOf("spine_01", "UE")).toBe("spine");
    expect(humanoidSlotOf("spine_02", "UE")).toBe("chest");
    expect(humanoidSlotOf("spine_03", "UE")).toBe("upperChest");
  });

  it("détecte la convention d'un squelette par ses marqueurs", () => {
    expect(detectConvention(["root", "pelvis", "spine_01", "thigh_l"])).toBe("UE");
    expect(detectConvention(["Hips", "Spine", "LeftUpLeg", "LeftArm"])).toBe("MIXAMO");
    expect(detectConvention(["Bone", "Bone_001"])).toBe("UNKNOWN");
  });

  it("indexSkeletonBySlot lève l'ambiguïté tout seul (chaîne dorsale complète)", () => {
    // Le cas qui cassait : spine_01/02/03 doivent viser TROIS emplacements
    // distincts, pas s'écraser sur un seul.
    const ue = indexSkeletonBySlot(["root", "pelvis", "spine_01", "spine_02", "spine_03", "thigh_l"]);
    expect(ue.get("spine")).toBe("spine_01");
    expect(ue.get("chest")).toBe("spine_02");
    expect(ue.get("upperChest")).toBe("spine_03");

    const meshy = indexSkeletonBySlot(["Hips", "Spine", "Spine01", "Spine02", "LeftUpLeg"]);
    expect(meshy.get("spine")).toBe("Spine");
    expect(meshy.get("chest")).toBe("Spine01");
    expect(meshy.get("upperChest")).toBe("Spine02");
  });

  it("renvoie null pour les os NON humanoïdes", () => {
    // Torsion et IK : présents sur le rig UE, sans équivalent humanoïde. Ils
    // doivent garder leur nom et ne recevoir aucune piste retargetée.
    expect(humanoidSlotOf("upperarm_twist_01_l")).toBeNull();
    expect(humanoidSlotOf("ik_foot_root")).toBeNull();
    // Os spécifiques à un personnage (sac de Wraith, muscles de Rampage).
    expect(humanoidSlotOf("backpack")).toBeNull();
    expect(humanoidSlotOf("lat_muscle_l")).toBeNull();
  });

  it("indexe un squelette UE4 par emplacement", () => {
    const m = indexSkeletonBySlot(["root", "pelvis", "spine_01", "upperarm_r", "ik_hand_l"]);
    expect(m.get("hips")).toBe("pelvis");
    expect(m.get("spine")).toBe("spine_01");
    expect(m.get("rightUpperArm")).toBe("upperarm_r");
    expect(m.has("leftHand")).toBe(false); // ik_hand_l n'est pas la main
  });

  it("le 1er os gagne en cas de doublon d'emplacement", () => {
    // Certains exports UE portent un os de mesh homonyme après le vrai os.
    const m = indexSkeletonBySlot(["pelvis", "Hips"]);
    expect(m.get("hips")).toBe("pelvis");
  });

  it("traduit Meshy → UE4 via l'emplacement (le cas Rampage)", () => {
    // Clip Meshy (soldat_humain) joué sur un rig Paragon UE4.
    const ueRig = indexSkeletonBySlot(["pelvis", "spine_01", "upperarm_l", "hand_l", "thigh_r"]);
    const translate = (meshyBone: string) => {
      const slot = humanoidSlotOf(meshyBone);
      return slot ? ueRig.get(slot) : undefined;
    };
    expect(translate("Hips")).toBe("pelvis");
    expect(translate("Spine")).toBe("spine_01");
    expect(translate("LeftArm")).toBe("upperarm_l");
    expect(translate("LeftHand")).toBe("hand_l");
    expect(translate("RightUpLeg")).toBe("thigh_r");
  });
});
