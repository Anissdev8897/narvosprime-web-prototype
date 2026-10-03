// weapons/findBone.ts — recherche d'os (un seul traverse, JAMAIS par frame) + échelle monde
import * as THREE from "three";

export function findBone(root: THREE.Object3D, re: RegExp): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((o) => { if (!found && re.test(o.name)) found = o; });
  return found;
}

// Échelle monde UNIFORME d'un os (sert à annuler l'échelle du rig — cf. nœud-socket).
// Hypothèse assumée : échelle uniforme (vrai Mixamo/Quaternius).
export function boneWorldScale(bone: THREE.Object3D): number {
  bone.updateWorldMatrix(true, false);
  const s = new THREE.Vector3();
  bone.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), s);
  return s.x;
}
