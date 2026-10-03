// ══════════════════════════════════════════════════════════════════════════════
// animation/IKController.ts — Contrôleur IK procédural (bridge WASM)
//
// Configure et pilote les solveurs IK dans le WASM (AnimationGraph) depuis JS.
// Deux modes de fonctionnement :
//   1. WASM natif : les solveurs tournent en C++ (recommandé, perf)
//   2. Fallback JS : les solveurs tournent en TypeScript (tests, dev sans WASM)
//
// Intégration avec AnimationController.ts :
//   - IKController s'instancie avec un graphId WASM
//   - Les cibles IK sont positionnées depuis JS chaque frame
//   - L'évaluation IK se fait dans AnimationGraph::WriteBoneMatrices
// ══════════════════════════════════════════════════════════════════════════════

import { getEngine, type IKBenchmarkResult } from "../wasm/WasmBridge";

// ── Types ───────────────────────────────────────────────────────────────────

export interface IKTarget {
  name: string;
  position: [number, number, number];
}

export interface IKConfig {
  /** ID du graph WASM (0 = pas de bridge WASM, fallback JS). */
  graphId: number;
  /** Squelette : mapping boneName → index. */
  boneMap: Record<string, number>;
  /** Bone names par slot humanoïde (optionnel). */
  humanoidBones?: Partial<Record<HumanoidSlot, string>>;
}

/** Emplacement humanoïde canonique (copie partielle de humanoidBones.ts). */
type HumanoidSlot =
  | "hips" | "spine" | "chest" | "upperChest" | "neck" | "head"
  | "leftShoulder" | "leftUpperArm" | "leftLowerArm" | "leftHand"
  | "rightShoulder" | "rightUpperArm" | "rightLowerArm" | "rightHand"
  | "leftUpperLeg" | "leftLowerLeg" | "leftFoot" | "leftToes"
  | "rightUpperLeg" | "rightLowerLeg" | "rightFoot" | "rightToes";

// ── Configuration par défaut ────────────────────────────────────────────────

export interface IKFeatureSet {
  /** TwoBoneIK: jambe gauche. */
  leftLeg?: {
    root: string;   // leftUpperLeg
    mid: string;    // leftLowerLeg
    effector: string; // leftFoot
    targetName: string;
    enabled?: boolean;
  };
  /** TwoBoneIK: jambe droite. */
  rightLeg?: {
    root: string;
    mid: string;
    effector: string;
    targetName: string;
    enabled?: boolean;
  };
  /** TwoBoneIK: bras gauche. */
  leftArm?: {
    root: string;   // leftUpperArm
    mid: string;    // leftLowerArm
    effector: string; // leftHand
    targetName: string;
    enabled?: boolean;
  };
  /** TwoBoneIK: bras droit. */
  rightArm?: {
    root: string;
    mid: string;
    effector: string;
    targetName: string;
    enabled?: boolean;
  };
  /** FABRIK: colonne vertébrale. */
  spineChain?: {
    bones: string[];
    targetName: string;
    maxIterations?: number;
    enabled?: boolean;
  };
  /** ChainLookAt: cou + tête. */
  headLookAt?: {
    bones: string[];      // [neck, head] ou [spine, neck, head]
    weights?: number[];   // Distribution (ex: [0.3, 0.7])
    targetName: string;
    enabled?: boolean;
  };
  /** FootLock: pieds au sol. */
  footLock?: {
    leftFoot: string;
    leftAnkle: string;
    leftIkRoot: string;
    rightFoot: string;
    rightAnkle: string;
    rightIkRoot: string;
    enabled?: boolean;
  };
}

// ── JS Fallback Solvers (pour tests sans WASM) ──────────────────────────────

/** Solveur TwoBoneIK en JS (pur, testable). */
export function solveTwoBoneIKJS(
  root: [number, number, number],
  mid: [number, number, number],
  effector: [number, number, number],
  target: [number, number, number],
  pole: [number, number, number] = [0, 1, 0],
): { rootRotation: [number, number, number, number]; midRotation: [number, number, number, number] } {
  const sub = (a: [number, number, number], b: [number, number, number]): [number, number, number] =>
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a: [number, number, number], b: [number, number, number]): number =>
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = (a: [number, number, number]): number => Math.sqrt(dot(a, a));
  const normalize = (a: [number, number, number]): [number, number, number] => {
    const l = len(a);
    return l < 1e-8 ? [0, 1, 0] : [a[0] / l, a[1] / l, a[2] / l];
  };
  const cross = (a: [number, number, number], b: [number, number, number]): [number, number, number] =>
    [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  const upperLen = len(sub(mid, root));
  const lowerLen = len(sub(effector, mid));
  const targetDist = Math.max(0.01, Math.min(len(sub(root, target)), (upperLen + lowerLen) * 0.999));

  const cosMid = (upperLen * upperLen + targetDist * targetDist - lowerLen * lowerLen) / (2 * upperLen * targetDist);
  const midAngle = Math.acos(Math.max(-1, Math.min(1, cosMid)));

  const dirRootMid = normalize(sub(mid, root));
  const dirRootTarget = normalize(sub(target, root));
  const triNormal = normalize(cross(dirRootMid, normalize(sub(effector, mid))));

  const rotAxis = len(triNormal) < 0.01 ? normalize(pole) : triNormal;
  const half = midAngle / 2;
  const cosH = Math.cos(half);
  const sinH = Math.sin(half);
  const rootQ: [number, number, number, number] = [rotAxis[0] * sinH, rotAxis[1] * sinH, rotAxis[2] * sinH, cosH];

  // Rotation du milieu (coude)
  const cosElbow = (upperLen * upperLen + lowerLen * lowerLen - targetDist * targetDist) / (2 * upperLen * lowerLen);
  const elbowAngle = Math.acos(Math.max(-1, Math.min(1, cosElbow)));
  const elbowHalf = (elbowAngle - Math.PI) / 2;
  const cosEH = Math.cos(elbowHalf);
  const sinEH = Math.sin(elbowHalf);
  const midQ: [number, number, number, number] = [rotAxis[0] * sinEH, rotAxis[1] * sinEH, rotAxis[2] * sinEH, cosEH];

  return { rootRotation: rootQ, midRotation: midQ };
}

/** FABRIK en JS (testable). */
export function solveFABRIKJS(
  joints: [number, number, number][],
  target: [number, number, number],
  maxIterations = 20,
  tolerance = 0.01,
): [number, number, number][] {
  const n = joints.length;
  if (n < 2) return [...joints];

  const result = joints.map((j) => [...j] as [number, number, number]);
  const originalRoot = [...result[0]] as [number, number, number];
  // Pre-calculate the segment lengths from the original pose (these stay fixed)
  const segLens: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    segLens.push(Math.sqrt(
      (joints[i][0] - joints[i + 1][0]) ** 2 +
      (joints[i][1] - joints[i + 1][1]) ** 2 +
      (joints[i][2] - joints[i + 1][2]) ** 2,
    ));
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    // Backward pass — start from target, work toward root
    result[n - 1] = [...target];
    for (let i = n - 2; i >= 0; i--) {
      const dx = result[i][0] - result[i + 1][0];
      const dy = result[i][1] - result[i + 1][1];
      const dz = result[i][2] - result[i + 1][2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 1e-10) {
        // Degenerate: direction from next toward root is undefined
        // Keep current position minus target direction
        const backupDir = i < n - 2
          ? [result[i][0] - result[i + 2][0], result[i][1] - result[i + 2][1], result[i][2] - result[i + 2][2]]
          : [0, -1, 0];
        const bd = Math.sqrt(backupDir[0] ** 2 + backupDir[1] ** 2 + backupDir[2] ** 2);
        if (bd > 1e-10) {
          result[i] = [
            result[i + 1][0] + (backupDir[0] / bd) * segLens[i],
            result[i + 1][1] + (backupDir[1] / bd) * segLens[i],
            result[i + 1][2] + (backupDir[2] / bd) * segLens[i],
          ];
        } else {
          result[i] = [result[i + 1][0], result[i + 1][1] + segLens[i], result[i + 1][2]];
        }
      } else {
        result[i] = [
          result[i + 1][0] + (dx / d) * segLens[i],
          result[i + 1][1] + (dy / d) * segLens[i],
          result[i + 1][2] + (dz / d) * segLens[i],
        ];
      }
    }

    // Forward pass — start from fixed root, work toward end
    result[0] = [...originalRoot];
    for (let i = 1; i < n; i++) {
      const dx = result[i][0] - result[i - 1][0];
      const dy = result[i][1] - result[i - 1][1];
      const dz = result[i][2] - result[i - 1][2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 1e-10) {
        const dir = [0, 1, 0];
        result[i] = [
          result[i - 1][0] + dir[0] * segLens[i - 1],
          result[i - 1][1] + dir[1] * segLens[i - 1],
          result[i - 1][2] + dir[2] * segLens[i - 1],
        ];
      } else {
        result[i] = [
          result[i - 1][0] + (dx / d) * segLens[i - 1],
          result[i - 1][1] + (dy / d) * segLens[i - 1],
          result[i - 1][2] + (dz / d) * segLens[i - 1],
        ];
      }
    }

    const err = Math.sqrt(
      (result[n - 1][0] - target[0]) ** 2 +
      (result[n - 1][1] - target[1]) ** 2 +
      (result[n - 1][2] - target[2]) ** 2,
    );
    if (err < tolerance) break;
  }

  return result;
}

// ── IKController ────────────────────────────────────────────────────────────

export class IKController {
  private graphId: number;
  private boneMap: Record<string, number>;
  private enabled = true;

  /** Targets définies, mises à jour chaque frame. */
  private targets = new Map<string, [number, number, number]>();

  /** Compteurs de performance. */
  private frameCount = 0;
  private totalTimeUs = 0;

  constructor(config: IKConfig) {
    this.graphId = config.graphId;
    this.boneMap = config.boneMap;
  }

  /** Configure un feature set complet d'IK sur le graph WASM. */
  setupIK(features: IKFeatureSet): void {
    if (this.graphId <= 0) return; // fallback JS — pas de config WASM

    const engine = getEngine();
    if (!engine) return;

    // Les bindings IK ne sont PAS compilés dans le moteur actuel (absents de
    // `Bindings.cpp` et du binaire `public/wasm/narvos-engine.wasm`). Les appels
    // ci-dessous sont donc en `?.()` — sans quoi le premier feature configuré
    // lèverait `is not a function`. On le dit une fois, à voix haute : un IK
    // silencieusement inactif se diagnostique comme un bug d'animation, et coûte
    // des heures du mauvais côté du problème.
    if (!engine.animGraphAddIKTwoBone) {
      console.warn(
        "[IKController] bindings IK absents du moteur WASM — setupIK sans effet. " +
        "Implémenter animGraphAddIKTwoBone/FABRIK/ChainLookAt/FootLock côté C++ pour l'activer.",
      );
    }

    // ── TwoBoneIK: jambes ──
    if (features.leftLeg) {
      engine.animGraphAddIKTwoBone?.(
        this.graphId,
        features.leftLeg.targetName,
        features.leftLeg.effector,
        features.leftLeg.mid,
        features.leftLeg.root,
      );
    }
    if (features.rightLeg) {
      engine.animGraphAddIKTwoBone?.(
        this.graphId,
        features.rightLeg.targetName,
        features.rightLeg.effector,
        features.rightLeg.mid,
        features.rightLeg.root,
      );
    }

    // ── TwoBoneIK: bras ──
    if (features.leftArm) {
      engine.animGraphAddIKTwoBone?.(
        this.graphId,
        features.leftArm.targetName,
        features.leftArm.effector,
        features.leftArm.mid,
        features.leftArm.root,
      );
    }
    if (features.rightArm) {
      engine.animGraphAddIKTwoBone?.(
        this.graphId,
        features.rightArm.targetName,
        features.rightArm.effector,
        features.rightArm.mid,
        features.rightArm.root,
      );
    }

    // ── FABRIK: colonne ──
    if (features.spineChain) {
      engine.animGraphAddFABRIK?.(
        this.graphId,
        features.spineChain.targetName,
        features.spineChain.bones,
        features.spineChain.maxIterations ?? 20,
      );
    }

    // ── ChainLookAt: tête ──
    if (features.headLookAt) {
      engine.animGraphAddChainLookAt?.(
        this.graphId,
        features.headLookAt.targetName,
        features.headLookAt.bones,
        features.headLookAt.weights ?? [],
      );
    }

    // ── FootLock: pieds ──
    if (features.footLock) {
      engine.animGraphAddFootLock?.(
        this.graphId,
        "footlock",
        [features.footLock.leftFoot, features.footLock.rightFoot],
        [features.footLock.leftAnkle, features.footLock.rightAnkle],
        [features.footLock.leftIkRoot, features.footLock.rightIkRoot],
      );
    }
  }

  /** Met à jour une cible IK en world space. */
  setTarget(name: string, x: number, y: number, z: number): void {
    this.targets.set(name, [x, y, z]);

    if (this.graphId > 0) {
      const engine = getEngine();
      if (engine) {
        engine.animGraphSetTarget?.(this.graphId, name, x, y, z);
      }
    }
  }

  /** Met à jour plusieurs cibles en une frame. */
  setTargets(targets: IKTarget[]): void {
    for (const t of targets) {
      this.setTarget(t.name, t.position[0], t.position[1], t.position[2]);
    }
  }

  /** Positionne la cible de LookAt (tête qui suit). */
  setLookAtTarget(x: number, y: number, z: number, targetName = "headTarget"): void {
    this.setTarget(targetName, x, y, z);
  }

  /** Positionne une cible de pied pour IK. */
  setFootTarget(side: "left" | "right", x: number, y: number, z: number): void {
    this.setTarget(`${side}FootTarget`, x, y, z);
  }

  /** Positionne une cible de main pour IK. */
  setHandTarget(side: "left" | "right", x: number, y: number, z: number): void {
    this.setTarget(`${side}HandTarget`, x, y, z);
  }

  /** Active/désactive l'IK. */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Récupère le temps moyen de l'IK par frame (microsecondes). */
  get averageTimeUs(): number {
    return this.frameCount > 0 ? this.totalTimeUs / this.frameCount : 0;
  }

  /** Exécute le benchmark IK WASM. */
  static async benchmark(chainLength = 8, iterations = 1000): Promise<IKBenchmarkResult | null> {
    const engine = getEngine();
    if (!engine || typeof engine.animRunBenchmark !== "function") return null;
    return engine.animRunBenchmark(chainLength, iterations);
  }

  /** Exécute le benchmark IK en JS pur (sans WASM). */
  static benchmarkJS(chainLength = 8, iterations = 1000): Record<string, number> {
    const results: Record<string, number> = {};

    // Préparation des données
    const root: [number, number, number] = [0, 10, 0];
    const mid: [number, number, number] = [0, 5, 5];
    const effector: [number, number, number] = [0, 0, 10];
    const target: [number, number, number] = [3, 1, 12];
    const pole: [number, number, number] = [0, 10, 5];

    // TwoBoneIK
    {
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        solveTwoBoneIKJS(
          [root[0] + Math.sin(i * 0.1) * 0.5, root[1], root[2]],
          mid, effector,
          [target[0] + Math.cos(i * 0.1) * 0.5, target[1], target[2]],
          pole,
        );
      }
      results.twoBoneIK = ((performance.now() - start) * 1000) / iterations; // μs
    }

    // FABRIK
    {
      const joints: [number, number, number][] = [];
      for (let i = 0; i < chainLength; i++) {
        const t = i / (chainLength - 1);
        joints.push([0, 10 * (1 - t), 10 * t]);
      }
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        solveFABRIKJS(joints, target);
      }
      results.fabrik = ((performance.now() - start) * 1000) / iterations;
    }

    return results;
  }

  /** Reset les compteurs de perf. */
  resetPerfCounters(): void {
    this.frameCount = 0;
    this.totalTimeUs = 0;
  }
}

// ── Utilitaire : configuration IK par défaut pour un humanoïde ──────────────

/**
 * Génère une configuration IK complète pour un squelette humanoïde
 * à partir d'un mapping slot → nom d'os.
 */
export function defaultHumanoidIK(
  boneMap: Record<string, number>,
  slots: Partial<Record<HumanoidSlot, string>>,
): IKFeatureSet {
  const get = (slot: HumanoidSlot): string | undefined => slots[slot];

  return {
    // Jambes
    leftLeg: {
      root: get("leftUpperLeg") ?? "leftUpperLeg",
      mid: get("leftLowerLeg") ?? "leftLowerLeg",
      effector: get("leftFoot") ?? "leftFoot",
      targetName: "leftFootTarget",
    },
    rightLeg: {
      root: get("rightUpperLeg") ?? "rightUpperLeg",
      mid: get("rightLowerLeg") ?? "rightLowerLeg",
      effector: get("rightFoot") ?? "rightFoot",
      targetName: "rightFootTarget",
    },
    // Bras (optionnel — désactivé par défaut)
    leftArm: undefined,
    rightArm: undefined,
    // Colonne FABRIK
    spineChain: {
      bones: [
        get("hips") ?? "hips",
        get("spine") ?? "spine",
        get("chest") ?? "chest",
        get("upperChest") ?? "upperChest",
      ].filter(Boolean) as string[],
      targetName: "spineTarget",
      maxIterations: 10,
    },
    // Tête ChainLookAt
    headLookAt: {
      bones: [
        get("neck") ?? "neck",
        get("head") ?? "head",
      ].filter(Boolean) as string[],
      weights: [0.3, 0.7],
      targetName: "headTarget",
    },
    // FootLock
    footLock: {
      leftFoot: get("leftFoot") ?? "leftFoot",
      leftAnkle: get("leftLowerLeg") ?? "leftLowerLeg",
      leftIkRoot: get("leftUpperLeg") ?? "leftUpperLeg",
      rightFoot: get("rightFoot") ?? "rightFoot",
      rightAnkle: get("rightLowerLeg") ?? "rightLowerLeg",
      rightIkRoot: get("rightUpperLeg") ?? "rightUpperLeg",
    },
  };
}
