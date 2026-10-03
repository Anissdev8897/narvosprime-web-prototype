import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { hasSkinnedMesh, cloneWeapon } from "./cloneWeapon";

describe("cloneWeapon", () => {
  it("hasSkinnedMesh : true avec un SkinnedMesh, false sinon", () => {
    const stat = new THREE.Object3D(); stat.add(new THREE.Mesh());
    expect(hasSkinnedMesh(stat)).toBe(false);
    const skinned = new THREE.Object3D(); skinned.add(new THREE.SkinnedMesh());
    expect(hasSkinnedMesh(skinned)).toBe(true);
  });
  it("clone statique : instance distincte, nom préservé", () => {
    const src = new THREE.Object3D(); src.name = "staff"; src.add(new THREE.Mesh());
    const c = cloneWeapon(src);
    expect(c).not.toBe(src);
    expect(c.name).toBe("staff");
  });
});
