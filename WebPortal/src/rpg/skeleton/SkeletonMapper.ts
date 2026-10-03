// skeleton/SkeletonMapper.ts — Mappe les bones d'un rig quelconque vers les noms canoniques
//
// Scanne un Object3D, détecte la convention, construit les tables de correspondance
// bidirectionnelles (canonical ↔ actual), et capture les bind-pose quaternions.
// Cache interne par WeakMap — un rig déjà mappé ne repasse pas.

import * as THREE from "three";
import type { CanonicalBone, RigConvention } from "./canonicalBones";
import {
  ALL_CANONICAL_BONES,
  detectConvention,
  getConventionMap,
} from "./canonicalBones";

export interface SkeletonProfile {
  convention: RigConvention;
  /** canonical → nom d'os EXACT trouvé dans le rig. */
  toActual: Map<CanonicalBone, string>;
  /** nom d'os EXACT → canonical. */
  toCanonical: Map<string, CanonicalBone>;
  /** canonical → quaternion local bind-pose. */
  restQuats: Map<CanonicalBone, THREE.Quaternion>;
  /** Tous les noms de bones du rig (y compris non-mappés). */
  allBones: Set<string>;
}

const profileCache = new WeakMap<THREE.Object3D, SkeletonProfile>();

/**
 * Analyse un rig : détecte la convention, construit le mapping bidirectionnel,
 * capture les bind-pose quaternions. Le résultat est caché par WeakMap.
 */
export function profileRig(root: THREE.Object3D): SkeletonProfile {
  const cached = profileCache.get(root);
  if (cached) return cached;

  const allBones = new Set<string>();
  const boneNodes = new Map<string, THREE.Bone>();

  root.traverse((n) => {
    if ((n as THREE.Bone).isBone && n.name) {
      allBones.add(n.name);
      boneNodes.set(n.name, n as THREE.Bone);
    }
  });

  const convention = detectConvention(allBones);
  const convMap = getConventionMap(convention);

  const toActual = new Map<CanonicalBone, string>();
  const toCanonical = new Map<string, CanonicalBone>();
  const restQuats = new Map<CanonicalBone, THREE.Quaternion>();

  for (const canonical of ALL_CANONICAL_BONES) {
    const expected = convMap[canonical];
    if (!expected) continue;
    // Cherche d'abord par nom exact, puis insensible à la casse
    let actual: string | undefined;
    if (allBones.has(expected)) {
      actual = expected;
    } else {
      const lower = expected.toLowerCase();
      for (const name of allBones) {
        if (name.toLowerCase() === lower) { actual = name; break; }
      }
    }
    if (!actual) continue;

    toActual.set(canonical, actual);
    toCanonical.set(actual, canonical);

    const bone = boneNodes.get(actual);
    if (bone) restQuats.set(canonical, bone.quaternion.clone());
  }

  const profile: SkeletonProfile = { convention, toActual, toCanonical, restQuats, allBones };
  profileCache.set(root, profile);
  return profile;
}

/**
 * Construit la table nom_réel→bone Object3D pour un rig (pour le rebinding de SkinnedMesh).
 */
export function buildBoneMap(root: THREE.Object3D): Map<string, THREE.Bone> {
  const map = new Map<string, THREE.Bone>();
  root.traverse((n) => {
    if ((n as THREE.Bone).isBone && n.name) map.set(n.name, n as THREE.Bone);
  });
  return map;
}

/**
 * Relie les SkinnedMesh d'une partie séparée au squelette maître.
 * Suppose que les deux partagent les mêmes noms de bones et la même rest pose.
 */
export function bindPartToMaster(
  partClone: THREE.Object3D,
  masterBoneMap: Map<string, THREE.Bone>,
): void {
  partClone.traverse((node) => {
    const sm = node as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh) return;
    const remappedBones = sm.skeleton.bones.map((b) => masterBoneMap.get(b.name) ?? b);
    const newSkeleton = new THREE.Skeleton(remappedBones, sm.skeleton.boneInverses);
    sm.bind(newSkeleton, sm.bindMatrix);
  });
}

/**
 * Invalide le cache pour un rig (utile si l'objet est recyclé avec un nouveau squelette).
 */
export function clearProfileCache(root: THREE.Object3D): void {
  profileCache.delete(root);
}
