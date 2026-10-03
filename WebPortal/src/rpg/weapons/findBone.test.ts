import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { findBone, boneWorldScale } from "./findBone";
import { RIG_PROFILES } from "./rigProfiles";

function node(name: string, children: THREE.Object3D[] = []): THREE.Object3D {
  const o = new THREE.Object3D();
  o.name = name;
  children.forEach((c) => o.add(c));
  return o;
}

describe("findBone", () => {
  it("trouve un os par regex (mixamorig:RightHand)", () => {
    const root = node("Hips", [node("Spine", [node("mixamorig:RightHand")])]);
    expect(findBone(root, RIG_PROFILES.mixamo.RightHand)?.name).toBe("mixamorig:RightHand");
  });
  it("retourne null si absent", () => {
    const root = node("Hips", [node("Spine")]);
    expect(findBone(root, RIG_PROFILES.mixamo.RightHand)).toBeNull();
  });
  it("retourne le PREMIER match", () => {
    const root = node("Root", [node("hand_r"), node("hand_r")]);
    expect(findBone(root, /hand_r$/i)).toBe(root.children[0]);
  });
});

describe("boneWorldScale", () => {
  it("reflète l'échelle monde du parent (0.01)", () => {
    const parent = new THREE.Object3D();
    parent.scale.setScalar(0.01);
    const b = node("RightHand");
    parent.add(b);
    expect(boneWorldScale(b)).toBeCloseTo(0.01, 5);
  });
  it("≈ 1 sans mise à l'échelle", () => {
    expect(boneWorldScale(node("RightHand"))).toBeCloseTo(1, 5);
  });
});
