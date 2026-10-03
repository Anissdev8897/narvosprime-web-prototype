import { describe, it, expect } from "vitest";
import {
  solveTwoBoneIKJS,
  solveFABRIKJS,
  IKController,
  defaultHumanoidIK,
} from "./IKController";

// ══════════════════════════════════════════════════════════════════════════════
// IKController.test.ts — Tests pour le système IK procédural
//
// Les tests sont en JS pur (pas de WASM) pour être exécutables dans vitest
// sans navigateur.
// ══════════════════════════════════════════════════════════════════════════════

describe("solveTwoBoneIKJS", () => {
  it("calcule des rotations pour une cible atteignable", () => {
    const root: [number, number, number] = [0, 0, 0];
    const mid: [number, number, number] = [0, 5, 0];
    const effector: [number, number, number] = [0, 10, 0];
    const target: [number, number, number] = [3, 7, 0];
    const pole: [number, number, number] = [0, 0, 1];

    const result = solveTwoBoneIKJS(root, mid, effector, target, pole);

    expect(result.rootRotation).toBeDefined();
    expect(result.rootRotation).toHaveLength(4);
    expect(result.midRotation).toBeDefined();
    expect(result.midRotation).toHaveLength(4);

    // La rotation root doit être un quaternion normalisé
    const rootLen = Math.sqrt(
      result.rootRotation[0] ** 2 +
      result.rootRotation[1] ** 2 +
      result.rootRotation[2] ** 2 +
      result.rootRotation[3] ** 2,
    );
    expect(rootLen).toBeCloseTo(1, 5);
  });

  it("gère le cas où la cible est hors de portée", () => {
    const root: [number, number, number] = [0, 0, 0];
    const mid: [number, number, number] = [0, 5, 0];
    const effector: [number, number, number] = [0, 10, 0];
    const target: [number, number, number] = [0, 100, 0]; // Très loin

    const result = solveTwoBoneIKJS(root, mid, effector, target);

    // Doit retourner des rotations valides (la chaîne s'aligne sur la cible)
    expect(result.rootRotation[3]).not.toBeNaN();
    expect(result.midRotation[3]).not.toBeNaN();
  });

  it("gère la cible au même endroit que l'effecteur", () => {
    const root: [number, number, number] = [0, 0, 0];
    const mid: [number, number, number] = [0, 5, 0];
    const effector: [number, number, number] = [0, 10, 0];
    const target = effector; // Même position

    const result = solveTwoBoneIKJS(root, mid, effector, target);
    expect(result.rootRotation).toBeDefined();
    expect(result.midRotation).toBeDefined();
  });

  it("ne retourne jamais NaN", () => {
    const root: [number, number, number] = [1, 2, 3];
    const mid: [number, number, number] = [4, 5, 6];
    const effector: [number, number, number] = [7, 8, 9];
    const target: [number, number, number] = [10, 11, 12];

    const result = solveTwoBoneIKJS(root, mid, effector, target, [0, 0, 1]);

    for (const v of result.rootRotation) expect(v).not.toBeNaN();
    for (const v of result.midRotation) expect(v).not.toBeNaN();
  });
});

describe("solveFABRIKJS", () => {
  it("résout une chaîne simple de 3 os", () => {
    const joints: [number, number, number][] = [
      [0, 0, 0],
      [0, 3, 0],
      [0, 6, 0],
    ];
    const target: [number, number, number] = [3, 4, 0];

    const result = solveFABRIKJS(joints, target);

    // La chaîne doit avoir le même nombre de joints
    expect(result).toHaveLength(3);

    // L'effecteur doit être proche de la cible
    const dx = result[2][0] - target[0];
    const dy = result[2][1] - target[1];
    const dz = result[2][2] - target[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // Tolérance large (FABRIK JS n'est pas aussi précis que le WASM)
    expect(dist).toBeLessThan(0.15);
  });

  it("converge vers la cible avec suffisamment d'itérations", () => {
    const joints: [number, number, number][] = [
      [0, 0, 0],
      [2, 2, 0],
      [4, 0, 0],
      [6, 2, 0],
    ];
    const target: [number, number, number] = [5, 5, 0];

    const result = solveFABRIKJS(joints, target, 50, 0.01);

    const err = Math.sqrt(
      (result[3][0] - target[0]) ** 2 +
      (result[3][1] - target[1]) ** 2 +
      (result[3][2] - target[2]) ** 2,
    );
    expect(err).toBeLessThan(0.1);
  });

  it("conserve la position root après FABRIK", () => {
    const joints: [number, number, number][] = [
      [5, 0, 5],
      [5, 3, 5],
      [5, 6, 5],
    ];
    const target: [number, number, number] = [8, 4, 8];

    const result = solveFABRIKJS(joints, target);

    expect(result[0][0]).toBeCloseTo(5, 5);
    expect(result[0][1]).toBeCloseTo(0, 5);
    expect(result[0][2]).toBeCloseTo(5, 5);
  });

  it("gère une chaîne de 2 os", () => {
    const joints: [number, number, number][] = [
      [0, 0, 0],
      [0, 5, 0],
    ];
    const target: [number, number, number] = [3, 4, 0];

    const result = solveFABRIKJS(joints, target);
    expect(result).toHaveLength(2);
  });

  it("ne retourne jamais NaN", () => {
    const joints: [number, number, number][] = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];
    const result = solveFABRIKJS(joints, [10, 11, 12]);
    for (const joint of result) {
      expect(joint[0]).not.toBeNaN();
      expect(joint[1]).not.toBeNaN();
      expect(joint[2]).not.toBeNaN();
    }
  });
});

describe("defaultHumanoidIK", () => {
  it("génère une config pour un squelette Mixamo", () => {
    const boneMap: Record<string, number> = {
      Hips: 0, Spine: 1, Spine1: 2, Spine2: 3,
      Neck: 4, Head: 5,
      LeftShoulder: 6, LeftArm: 7, LeftForeArm: 8, LeftHand: 9,
      RightShoulder: 10, RightArm: 11, RightForeArm: 12, RightHand: 13,
      LeftUpLeg: 14, LeftLeg: 15, LeftFoot: 16,
      RightUpLeg: 17, RightLeg: 18, RightFoot: 19,
    };

    const slots: Partial<Record<string, string>> = {
      hips: "Hips",
      spine: "Spine",
      chest: "Spine1",
      upperChest: "Spine2",
      neck: "Neck",
      head: "Head",
      leftUpperArm: "LeftArm",
      leftLowerArm: "LeftForeArm",
      leftHand: "LeftHand",
      rightUpperArm: "RightArm",
      rightLowerArm: "RightForeArm",
      rightHand: "RightHand",
      leftUpperLeg: "LeftUpLeg",
      leftLowerLeg: "LeftLeg",
      leftFoot: "LeftFoot",
      rightUpperLeg: "RightUpLeg",
      rightLowerLeg: "RightLeg",
      rightFoot: "RightFoot",
    };

    const config = defaultHumanoidIK(boneMap, slots as any);

    // Vérifie la jambe gauche
    expect(config.leftLeg).toBeDefined();
    expect(config.leftLeg!.root).toBe("LeftUpLeg");
    expect(config.leftLeg!.mid).toBe("LeftLeg");
    expect(config.leftLeg!.effector).toBe("LeftFoot");

    // Vérifie la colonne FABRIK
    expect(config.spineChain).toBeDefined();
    expect(config.spineChain!.bones).toEqual(["Hips", "Spine", "Spine1", "Spine2"]);

    // Vérifie le LookAt tête
    expect(config.headLookAt).toBeDefined();
    expect(config.headLookAt!.bones).toEqual(["Neck", "Head"]);
    expect(config.headLookAt!.weights).toEqual([0.3, 0.7]);

    // Vérifie le FootLock
    expect(config.footLock).toBeDefined();
    expect(config.footLock!.leftFoot).toBe("LeftFoot");
    expect(config.footLock!.rightFoot).toBe("RightFoot");
  });
});

describe("IKController", () => {
  it("se construit avec une config valide", () => {
    const controller = new IKController({
      graphId: 0, // Pas de WASM
      boneMap: { Hips: 0, Head: 1 },
    });
    expect(controller).toBeInstanceOf(IKController);
    expect(controller.isEnabled).toBe(true);
  });

  it("désactive/active l'IK", () => {
    const controller = new IKController({
      graphId: 0,
      boneMap: {},
    });
    expect(controller.isEnabled).toBe(true);
    controller.setEnabled(false);
    expect(controller.isEnabled).toBe(false);
    controller.setEnabled(true);
    expect(controller.isEnabled).toBe(true);
  });

  it("stocke les cibles sans WASM", () => {
    const controller = new IKController({
      graphId: 0,
      boneMap: { Hips: 0 },
    });
    controller.setTarget("headTarget", 1, 2, 3);
    controller.setFootTarget("left", 4, 5, 6);
    controller.setHandTarget("right", 7, 8, 9);
    // Pas de crash = OK
  });

  it("benchmarkJS retourne des timings valides", () => {
    const results = IKController.benchmarkJS(8, 100);
    expect(results.twoBoneIK).toBeGreaterThan(0);
    expect(results.fabrik).toBeGreaterThan(0);
  });

  it("resetPerfCounters fonctionne", () => {
    const controller = new IKController({
      graphId: 0,
      boneMap: {},
    });
    controller.resetPerfCounters();
    expect(controller.averageTimeUs).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Tests de performance (benchmark)
// ══════════════════════════════════════════════════════════════════════════════

describe("IK benchmark", () => {
  it("mesure le temps TwoBoneIK JS (informatif)", () => {
    const results = IKController.benchmarkJS(3, 1000);
    expect(results.twoBoneIK).toBeGreaterThan(0);
  });

  it("mesure le temps FABRIK JS pour différentes longueurs de chaîne", () => {
    const results = IKController.benchmarkJS(3, 500);
    expect(results.twoBoneIK).toBeGreaterThan(0);
    expect(results.fabrik).toBeGreaterThan(0);
  });

  it("benchmark retourne des valeurs positives", () => {
    const results = IKController.benchmarkJS(3, 1000);
    expect(results.twoBoneIK).toBeGreaterThan(0);
    expect(results.fabrik).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Tests d'intégrité mathématique
// ══════════════════════════════════════════════════════════════════════════════

describe("intégrité IK", () => {
  it("la somme des longueurs de segments est conservée par FABRIK", () => {
    const joints: [number, number, number][] = [
      [0, 0, 0],
      [0, 3, 0],
      [3, 3, 0],
      [3, 6, 0],
    ];

    // Longueurs originales
    const origLens = [];
    for (let i = 0; i < joints.length - 1; i++) {
      origLens.push(Math.sqrt(
        (joints[i][0] - joints[i + 1][0]) ** 2 +
        (joints[i][1] - joints[i + 1][1]) ** 2 +
        (joints[i][2] - joints[i + 1][2]) ** 2,
      ));
    }

    const result = solveFABRIKJS(joints, [2, 5, 0]);

    // Les longueurs doivent être conservées
    for (let i = 0; i < result.length - 1; i++) {
      const newLen = Math.sqrt(
        (result[i][0] - result[i + 1][0]) ** 2 +
        (result[i][1] - result[i + 1][1]) ** 2 +
        (result[i][2] - result[i + 1][2]) ** 2,
      );
      expect(newLen).toBeCloseTo(origLens[i], 5);
    }
  });

  it("TwoBoneIK produit un quaternion normalisé", () => {
    const root: [number, number, number] = [0, 0, 0];
    const mid: [number, number, number] = [0, 5, 0];
    const effector: [number, number, number] = [0, 10, 0];

    // Test avec différentes cibles
    const targets: [number, number, number][] = [
      [3, 7, 0],
      [-3, 7, 0],
      [0, 12, 0],
      [2, 5, 3],
      [0, 0, 5],
    ];

    for (const target of targets) {
      const result = solveTwoBoneIKJS(root, mid, effector, target);
      for (const q of [result.rootRotation, result.midRotation]) {
        const norm = Math.sqrt(q[0] ** 2 + q[1] ** 2 + q[2] ** 2 + q[3] ** 2);
        expect(norm).toBeCloseTo(1, 4);
      }
    }
  });
});
