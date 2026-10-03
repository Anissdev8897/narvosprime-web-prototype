// skeleton/skeleton.test.ts — Tests du système de squelette universel
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  detectConvention,
  getConventionMap,
  ALL_CANONICAL_BONES,
} from "./canonicalBones";
import type { CanonicalBone, RigConvention } from "./canonicalBones";
import { profileRig } from "./SkeletonMapper";
import {
  retargetClip,
  dropScaleTracks,
  stripMixamoPrefix,
  bakeArmatureRotation,
} from "./UniversalRetargeter";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeBoneHierarchy(names: string[]): THREE.Group {
  const root = new THREE.Group();
  root.name = "Armature";
  let parent: THREE.Object3D = root;
  for (const name of names) {
    const bone = new THREE.Bone();
    bone.name = name;
    parent.add(bone);
    parent = bone;
  }
  return root;
}

function makeClip(boneName: string, prop: string, values: number[]): THREE.AnimationClip {
  const times = new Float32Array(values.length / (prop === "quaternion" ? 4 : 3));
  for (let i = 0; i < times.length; i++) times[i] = i / 30;
  const track = prop === "quaternion"
    ? new THREE.QuaternionKeyframeTrack(`${boneName}.${prop}`, times, new Float32Array(values))
    : new THREE.VectorKeyframeTrack(`${boneName}.${prop}`, times, new Float32Array(values));
  return new THREE.AnimationClip("test", -1, [track]);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("canonicalBones", () => {
  it("détecte un rig Mixamo", () => {
    const names = new Set(["Hips", "Spine", "Spine1", "Spine2", "LeftArm", "RightForeArm", "LeftUpLeg"]);
    expect(detectConvention(names)).toBe("mixamo");
  });

  it("détecte un rig Quaternius", () => {
    const names = new Set(["pelvis", "spine_01", "spine_02", "upperarm_l", "calf_r", "lowerarm_l"]);
    expect(detectConvention(names)).toBe("quaternius");
  });

  it("détecte un rig Mixamo avec préfixe", () => {
    const names = new Set(["mixamorig:Hips", "mixamorig:LeftArm", "mixamorig:RightForeArm", "mixamorig:LeftUpLeg", "mixamorig:Spine2"]);
    expect(detectConvention(names)).toBe("mixamo");
  });

  it("retourne generic par défaut", () => {
    const names = new Set(["bone1", "bone2", "bone3"]);
    expect(detectConvention(names)).toBe("generic");
  });

  it("toutes les conventions couvrent tous les os canoniques", () => {
    const conventions: RigConvention[] = ["mixamo", "quaternius", "unreal", "generic"];
    for (const conv of conventions) {
      const map = getConventionMap(conv);
      for (const bone of ALL_CANONICAL_BONES) {
        expect(map[bone], `${conv} manque ${bone}`).toBeTruthy();
      }
    }
  });
});

describe("SkeletonMapper", () => {
  it("profile un rig Mixamo", () => {
    const root = makeBoneHierarchy(["Hips", "Spine", "Spine1", "Spine2", "LeftArm", "LeftForeArm", "LeftHand"]);
    const profile = profileRig(root);
    expect(profile.convention).toBe("mixamo");
    expect(profile.toActual.get("hand_l")).toBe("LeftHand");
    expect(profile.toCanonical.get("LeftHand")).toBe("hand_l");
  });

  it("profile un rig Quaternius", () => {
    const root = makeBoneHierarchy(["pelvis", "spine_01", "spine_02", "spine_03", "upperarm_l", "lowerarm_l", "hand_l"]);
    const profile = profileRig(root);
    expect(profile.convention).toBe("quaternius");
    expect(profile.toActual.get("hand_l")).toBe("hand_l");
    expect(profile.toCanonical.get("pelvis")).toBe("hips");
  });

  it("capture les rest quats", () => {
    const root = makeBoneHierarchy(["Hips", "Spine"]);
    const profile = profileRig(root);
    const q = profile.restQuats.get("hips");
    expect(q).toBeTruthy();
    expect(q!.w).toBeCloseTo(1, 5);
  });
});

describe("UniversalRetargeter", () => {
  it("strip le préfixe mixamorig:", () => {
    expect(stripMixamoPrefix("mixamorig:Hips")).toBe("Hips");
    expect(stripMixamoPrefix("mixamorigHips")).toBe("Hips");
    expect(stripMixamoPrefix("Hips")).toBe("Hips");
  });

  it("drop les pistes .scale", () => {
    const clip = new THREE.AnimationClip("test", 1, [
      new THREE.VectorKeyframeTrack("Bone.position", [0], [0, 0, 0]),
      new THREE.VectorKeyframeTrack("Bone.scale", [0], [1, 1, 1]),
      new THREE.QuaternionKeyframeTrack("Bone.quaternion", [0], [0, 0, 0, 1]),
    ]);
    const cleaned = dropScaleTracks(clip);
    expect(cleaned.tracks.length).toBe(2);
    expect(cleaned.tracks.every((t) => !t.name.endsWith(".scale"))).toBe(true);
  });

  it("retargète un clip Mixamo → Quaternius (remap noms)", () => {
    const clip = makeClip("Hips", "position", [0, 1, 0]);
    const targetRoot = makeBoneHierarchy(["pelvis", "spine_01"]);
    const targetProfile = profileRig(targetRoot);

    const result = retargetClip(clip, { target: targetProfile, excludeRoot: false });
    const trackNames = result.tracks.map((t) => t.name);
    expect(trackNames.some((n) => n.startsWith("pelvis."))).toBe(true);
    expect(trackNames.every((n) => !n.startsWith("Hips."))).toBe(true);
  });

  it("bake armature rotation ne modifie rien si identité", () => {
    const clip = makeClip("Hips", "quaternion", [0, 0, 0, 1]);
    const identity = new THREE.Quaternion();
    const baked = bakeArmatureRotation(clip, identity);
    expect(baked).toBe(clip);
  });

  it("bake armature rotation modifie le root bone", () => {
    const clip = makeClip("Hips", "quaternion", [0, 0, 0, 1]);
    const rot90x = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    const baked = bakeArmatureRotation(clip, rot90x);
    expect(baked).not.toBe(clip);
    const vals = baked.tracks[0].values;
    expect(Math.abs(vals[3])).toBeLessThan(1);
  });
});
