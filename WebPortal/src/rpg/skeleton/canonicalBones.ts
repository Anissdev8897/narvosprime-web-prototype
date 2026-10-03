// skeleton/canonicalBones.ts — Squelette humanoïde canonique + auto-détection de rig
//
// Source de vérité pour le mapping universel de bones. Chaque convention
// (Mixamo, Quaternius, Unreal, générique) mappe vers un os CANONIQUE.
// L'auto-détection scanne les noms de bones d'un rig et identifie la famille.

import * as THREE from "three";

/** Os canonique identifié par un slug stable. */
export type CanonicalBone =
  | "hips" | "spine" | "spine1" | "spine2" | "chest"
  | "neck" | "head"
  | "shoulder_l" | "upperarm_l" | "forearm_l" | "hand_l"
  | "shoulder_r" | "upperarm_r" | "forearm_r" | "hand_r"
  | "thigh_l" | "shin_l" | "foot_l" | "toe_l"
  | "thigh_r" | "shin_r" | "foot_r" | "toe_r";

export const ALL_CANONICAL_BONES: readonly CanonicalBone[] = [
  "hips", "spine", "spine1", "spine2", "chest",
  "neck", "head",
  "shoulder_l", "upperarm_l", "forearm_l", "hand_l",
  "shoulder_r", "upperarm_r", "forearm_r", "hand_r",
  "thigh_l", "shin_l", "foot_l", "toe_l",
  "thigh_r", "shin_r", "foot_r", "toe_r",
] as const;

/** Famille de rig supportée (extensible). */
export type RigConvention = "mixamo" | "quaternius" | "unreal" | "generic";

/**
 * Table de correspondance convention → noms d'os réels.
 * Chaque entrée mappe un CanonicalBone vers le nom tel qu'il apparaît dans le GLB/FBX
 * APRÈS import (ex: "mixamorig:" déjà strippé par FBXLoader/strip).
 */
const CONVENTION_MAPS: Record<RigConvention, Record<CanonicalBone, string>> = {
  mixamo: {
    hips: "Hips", spine: "Spine", spine1: "Spine1", spine2: "Spine2", chest: "Spine2",
    neck: "Neck", head: "Head",
    shoulder_l: "LeftShoulder", upperarm_l: "LeftArm", forearm_l: "LeftForeArm", hand_l: "LeftHand",
    shoulder_r: "RightShoulder", upperarm_r: "RightArm", forearm_r: "RightForeArm", hand_r: "RightHand",
    thigh_l: "LeftUpLeg", shin_l: "LeftLeg", foot_l: "LeftFoot", toe_l: "LeftToeBase",
    thigh_r: "RightUpLeg", shin_r: "RightLeg", foot_r: "RightFoot", toe_r: "RightToeBase",
  },
  quaternius: {
    hips: "pelvis", spine: "spine_01", spine1: "spine_02", spine2: "spine_03", chest: "spine_03",
    neck: "neck_01", head: "Head",
    shoulder_l: "clavicle_l", upperarm_l: "upperarm_l", forearm_l: "lowerarm_l", hand_l: "hand_l",
    shoulder_r: "clavicle_r", upperarm_r: "upperarm_r", forearm_r: "lowerarm_r", hand_r: "hand_r",
    thigh_l: "thigh_l", shin_l: "calf_l", foot_l: "foot_l", toe_l: "ball_l",
    thigh_r: "thigh_r", shin_r: "calf_r", foot_r: "foot_r", toe_r: "ball_r",
  },
  unreal: {
    hips: "pelvis", spine: "spine_01", spine1: "spine_02", spine2: "spine_03", chest: "spine_03",
    neck: "neck_01", head: "head",
    shoulder_l: "clavicle_l", upperarm_l: "upperarm_l", forearm_l: "lowerarm_l", hand_l: "hand_l",
    shoulder_r: "clavicle_r", upperarm_r: "upperarm_r", forearm_r: "lowerarm_r", hand_r: "hand_r",
    thigh_l: "thigh_l", shin_l: "calf_l", foot_l: "foot_l", toe_l: "ball_l",
    thigh_r: "thigh_r", shin_r: "calf_r", foot_r: "foot_r", toe_r: "ball_r",
  },
  generic: {
    hips: "Hips", spine: "Spine", spine1: "Spine1", spine2: "Spine2", chest: "Chest",
    neck: "Neck", head: "Head",
    shoulder_l: "LeftShoulder", upperarm_l: "LeftUpperArm", forearm_l: "LeftForeArm", hand_l: "LeftHand",
    shoulder_r: "RightShoulder", upperarm_r: "RightUpperArm", forearm_r: "RightForeArm", hand_r: "RightHand",
    thigh_l: "LeftThigh", shin_l: "LeftShin", foot_l: "LeftFoot", toe_l: "LeftToe",
    thigh_r: "RightThigh", shin_r: "RightShin", foot_r: "RightFoot", toe_r: "RightToe",
  },
};

export function getConventionMap(conv: RigConvention): Record<CanonicalBone, string> {
  return CONVENTION_MAPS[conv];
}

// ── Fingerprints pour auto-détection ────────────────────────────────────────
// On cherche des noms DISTINCTIFS de chaque convention dans l'ensemble des bones.
// Score = nb de hits. La convention avec le meilleur score gagne.

const FINGERPRINTS: Record<RigConvention, RegExp[]> = {
  mixamo: [
    /^(mixamorig[:]?)?Hips$/i,
    /^(mixamorig[:]?)?LeftArm$/i,
    /^(mixamorig[:]?)?RightForeArm$/i,
    /^(mixamorig[:]?)?LeftUpLeg$/i,
    /^(mixamorig[:]?)?Spine2$/i,
  ],
  quaternius: [
    /^pelvis$/i,
    /^spine_01$/i,
    /^upperarm_[lr]$/i,
    /^calf_[lr]$/i,
    /^lowerarm_[lr]$/i,
  ],
  unreal: [
    /^pelvis$/i,
    /^spine_\d+$/i,
    /^upperarm_[lr]$/i,
    /^lowerarm_[lr]$/i,
    /^calf_[lr]$/i,
  ],
  generic: [
    /^Hips$/i,
    /^LeftUpperArm$/i,
    /^RightUpperArm$/i,
    /^LeftThigh$/i,
    /^Chest$/i,
  ],
};

/**
 * Détecte la convention de nommage d'un rig en scannant les noms d'os.
 * Renvoie la meilleure correspondance ou "generic" par défaut.
 */
export function detectConvention(boneNames: Set<string>): RigConvention {
  let best: RigConvention = "generic";
  let bestScore = 0;

  for (const [conv, patterns] of Object.entries(FINGERPRINTS) as [RigConvention, RegExp[]][]) {
    let score = 0;
    for (const re of patterns) {
      for (const name of boneNames) {
        if (re.test(name)) { score++; break; }
      }
    }
    if (score > bestScore) { bestScore = score; best = conv; }
  }
  return best;
}

/**
 * Détecte la convention en scannant directement un sous-arbre Three.js.
 */
export function detectConventionFromScene(root: THREE.Object3D): RigConvention {
  const names = new Set<string>();
  root.traverse((n) => { if ((n as THREE.Bone).isBone && n.name) names.add(n.name); });
  return detectConvention(names);
}

/**
 * Renvoie la table canonique→nom_réel pour un rig dont on vient de détecter la convention.
 * Version raccourcie : détection + lookup en un appel.
 */
export function canonicalMapForScene(root: THREE.Object3D): {
  convention: RigConvention;
  toActual: Record<CanonicalBone, string>;
} {
  const convention = detectConventionFromScene(root);
  return { convention, toActual: CONVENTION_MAPS[convention] };
}
