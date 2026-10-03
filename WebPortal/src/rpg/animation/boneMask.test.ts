import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { boneOfTrack, maskClipToBones, describeMask } from "./boneMask";

/** Fabrique un clip avec une piste quaternion par nom d'os donné. */
function clipWithBones(names: string[]): THREE.AnimationClip {
  const tracks = names.map(
    (n) => new THREE.QuaternionKeyframeTrack(`${n}.quaternion`, [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
  );
  return new THREE.AnimationClip("test", 1, tracks);
}

describe("boneOfTrack", () => {
  it("extrait l'os d'un nom de piste simple", () => {
    expect(boneOfTrack("pelvis.quaternion")).toBe("pelvis");
  });

  it("retire le préfixe Mixamo", () => {
    expect(boneOfTrack("mixamorig:Hips.position")).toBe("hips");
  });

  it("tolère un nom sans propriété", () => {
    expect(boneOfTrack("thigh_l")).toBe("thigh_l");
  });
});

describe("maskClipToBones — legsOnly", () => {
  it("garde les jambes et supprime le bassin et la colonne", () => {
    // C'est le cœur du correctif : la rotation additive du bassin se multipliait
    // avec celle du cycle de marche, ce qui tordait les cuisses.
    const clip = clipWithBones(["root", "pelvis", "spine_01", "spine_02", "thigh_l", "calf_l", "foot_l"]);
    const masked = maskClipToBones(clip, "legsOnly");
    const bones = masked.tracks.map((t) => boneOfTrack(t.name));
    expect(bones).toEqual(["thigh_l", "calf_l", "foot_l"]);
    expect(bones).not.toContain("pelvis");
    expect(bones).not.toContain("root");
  });

  it("reconnaît aussi la convention Mixamo", () => {
    const clip = clipWithBones(["mixamorig:Hips", "mixamorig:LeftUpLeg", "mixamorig:LeftLeg", "mixamorig:Spine"]);
    const bones = maskClipToBones(clip, "legsOnly").tracks.map((t) => boneOfTrack(t.name));
    expect(bones).toEqual(["leftupleg", "leftleg"]);
  });

  it("ne modifie PAS le clip source — il peut être partagé", () => {
    const clip = clipWithBones(["pelvis", "thigh_l"]);
    const before = clip.tracks.length;
    maskClipToBones(clip, "legsOnly");
    expect(clip.tracks.length).toBe(before);
  });
});

describe("maskClipToBones — excludeTorso", () => {
  it("garde les bras, supprime le tronc", () => {
    const clip = clipWithBones(["pelvis", "spine_01", "upperarm_l", "hand_l", "thigh_r"]);
    const bones = maskClipToBones(clip, "excludeTorso").tracks.map((t) => boneOfTrack(t.name));
    expect(bones).toContain("upperarm_l");
    expect(bones).toContain("hand_l");
    expect(bones).toContain("thigh_r");
    expect(bones).not.toContain("pelvis");
    expect(bones).not.toContain("spine_01");
  });
});

describe("garde-fou", () => {
  it("renvoie le clip intact si le masque ne laisse rien", () => {
    // Un clip vide figerait la pose : mieux vaut le comportement par défaut.
    const clip = clipWithBones(["pelvis", "spine_01"]);
    const masked = maskClipToBones(clip, "legsOnly");
    expect(masked.tracks.length).toBe(clip.tracks.length);
    expect(masked).toBe(clip);
  });

  it("describeMask compte correctement", () => {
    const clip = clipWithBones(["pelvis", "thigh_l", "calf_l"]);
    expect(describeMask(clip, "legsOnly")).toEqual({ kept: 2, dropped: 1 });
  });
});
