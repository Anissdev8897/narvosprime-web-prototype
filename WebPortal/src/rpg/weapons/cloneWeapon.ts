// weapons/cloneWeapon.ts — clone skin-aware (Object3D.clone casse les SkinnedMesh)
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

export function hasSkinnedMesh(root: THREE.Object3D): boolean {
  let skinned = false;
  root.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skinned = true; });
  return skinned;
}

export function cloneWeapon(scene: THREE.Object3D): THREE.Object3D {
  return hasSkinnedMesh(scene) ? SkeletonUtils.clone(scene) : scene.clone();
}
