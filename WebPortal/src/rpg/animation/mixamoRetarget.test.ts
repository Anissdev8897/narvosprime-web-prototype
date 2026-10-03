import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { stripMixamoPrefix, asAction, retargetClips, dropScaleTracks, remapClipsToRig, bakeArmatureRotation, MIXAMO_PREFIX } from "./mixamoRetarget";

describe("bakeArmatureRotation (packs FBX→GLB à armature pivotée +90° X)", () => {
  const rotX90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);

  it("tourne les positions du ROOT (Hips) : -Z (repère pack) → +Y (repère rig)", () => {
    const c = new THREE.AnimationClip("Idle", 1, [
      new THREE.VectorKeyframeTrack("mixamorig:Hips.position", [0], [0, 0, -10]),
      new THREE.VectorKeyframeTrack("mixamorig:Spine.position", [0], [0, 0, -10]),
    ]);
    const out = bakeArmatureRotation(c, rotX90);
    const hips = Array.from(out.tracks[0].values).map((v) => Math.round(v * 1000) / 1000 + 0); // +0 : normalise -0
    expect(hips).toEqual([0, 10, 0]);          // remis debout
    expect(out.tracks[1].values[2]).toBe(-10); // les ENFANTS (rotations locales) intacts
    expect(c.tracks[0].values[1]).toBe(0);     // l'original (cache partagé) non muté
  });

  it("pré-multiplie le quaternion du ROOT", () => {
    const c = new THREE.AnimationClip("Idle", 1, [
      new THREE.QuaternionKeyframeTrack("Hips.quaternion", [0], [0, 0, 0, 1]),
    ]);
    const out = bakeArmatureRotation(c, rotX90);
    const q = out.tracks[0].values;
    expect(Math.round(q[0] * 1000) / 1000).toBe(0.707); // identité × rotX90 = rotX90
  });

  it("armature identité → clip d'origine inchangé (pas de clone inutile)", () => {
    const c = new THREE.AnimationClip("Idle", 1, [
      new THREE.VectorKeyframeTrack("Hips.position", [0], [1, 2, 3]),
    ]);
    expect(bakeArmatureRotation(c, new THREE.Quaternion())).toBe(c);
  });
});

function clip(name: string, trackNames: string[]): THREE.AnimationClip {
  const tracks = trackNames.map(
    (n) => new THREE.VectorKeyframeTrack(n, [0, 1], [0, 0, 0, 1, 1, 1]),
  );
  return new THREE.AnimationClip(name, 1, tracks);
}

describe("mixamoRetarget", () => {
  it("retire le préfixe mixamorig: des pistes", () => {
    const c = clip("Run", [`${MIXAMO_PREFIX}Hips.position`, `${MIXAMO_PREFIX}LeftArm.position`]);
    const out = stripMixamoPrefix(c);
    expect(out.tracks.map((t) => t.name)).toEqual(["Hips.position", "LeftArm.position"]);
  });

  it("ne mute PAS le clip d'origine (sécurité cache useFBX)", () => {
    const c = clip("Run", [`${MIXAMO_PREFIX}Hips.position`]);
    stripMixamoPrefix(c);
    expect(c.tracks[0].name).toBe(`${MIXAMO_PREFIX}Hips.position`); // intact
  });

  it("laisse intactes les pistes déjà sans préfixe", () => {
    const c = clip("Idle", ["Hips.position", "Spine.position"]);
    const out = stripMixamoPrefix(c);
    expect(out).toBe(c); // aucune copie : même référence
  });

  it("asAction strip + renomme sans toucher l'original", () => {
    const c = clip("mixamo.com", [`${MIXAMO_PREFIX}Hips.position`]);
    const out = asAction(c, "run");
    expect(out.name).toBe("run");
    expect(out.tracks[0].name).toBe("Hips.position");
    expect(c.name).toBe("mixamo.com"); // original intact
  });

  it("asAction renomme même si le clip n'a pas de préfixe (clone du conteneur)", () => {
    const c = clip("Idle", ["Hips.position"]);
    const out = asAction(c, "idle");
    expect(out.name).toBe("idle");
    expect(c.name).toBe("Idle"); // original intact
  });

  it("dropScaleTracks retire les pistes .scale (artefact cm→m), garde le reste", () => {
    const c = clip("Idle", ["Hips.position", "Hips.quaternion", "Hips.scale", "Spine.scale"]);
    const out = dropScaleTracks(c);
    expect(out.tracks.map((t) => t.name)).toEqual(["Hips.position", "Hips.quaternion"]);
  });

  it("dropScaleTracks renvoie le clip d'origine si aucune piste scale", () => {
    const c = clip("Idle", ["Hips.position", "Hips.quaternion"]);
    expect(dropScaleTracks(c)).toBe(c);
  });

  it("asAction retire aussi les pistes scale", () => {
    const c = clip("mixamo.com", [`${MIXAMO_PREFIX}Hips.position`, `${MIXAMO_PREFIX}Hips.scale`]);
    const out = asAction(c, "run");
    expect(out.tracks.map((t) => t.name)).toEqual(["Hips.position"]);
  });

  it("remapClipsToRig adapte les pistes au rig Meshy (sans préfixe)", () => {
    // Rig cible : os "Hips"/"RightHand" (convention Meshy/Ninja).
    const root = new THREE.Object3D();
    for (const n of ["Hips", "RightHand", "LeftLeg"]) {
      const b = new THREE.Object3D(); b.name = n; root.add(b);
    }
    const c = clip("idle", [`${MIXAMO_PREFIX}Hips.quaternion`, `${MIXAMO_PREFIX}RightHand.quaternion`]);
    const [out] = remapClipsToRig(root, [c]);
    expect(out.tracks.map((t) => t.name)).toEqual(["Hips.quaternion", "RightHand.quaternion"]);
  });

  it("remapClipsToRig adapte les pistes au rig Sorcier (préfixe mixamorig:)", () => {
    const root = new THREE.Object3D();
    for (const n of ["mixamorig:Hips", "mixamorig:RightHand"]) {
      const b = new THREE.Object3D(); b.name = n; root.add(b);
    }
    // Clip déjà strippé ("Hips") → re-mappé vers le vrai os préfixé du rig.
    const c = clip("idle", ["Hips.quaternion", "RightHand.quaternion"]);
    const [out] = remapClipsToRig(root, [c]);
    expect(out.tracks.map((t) => t.name)).toEqual(["mixamorig:Hips.quaternion", "mixamorig:RightHand.quaternion"]);
  });

  it("retargetClips traite une liste", () => {
    const out = retargetClips([
      clip("a", [`${MIXAMO_PREFIX}Hips.position`]),
      clip("b", ["Spine.position"]),
    ]);
    expect(out[0].tracks[0].name).toBe("Hips.position");
    expect(out[1].tracks[0].name).toBe("Spine.position");
  });
});
