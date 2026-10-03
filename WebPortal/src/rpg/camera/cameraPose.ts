// ══════════════════════════════════════════════════════════════════════════════
// camera/cameraPose.ts — Pose caméra riche (FOV, near, far, focal length)
//
// POURQUOI CE FICHIER EXISTE :
// Jusqu'ici la caméra ne stockait qu'une position/rotation. Une CameraPose
// enrichie permet aux modifieurs (CameraModifier) de toucher FOV, near/far,
// et focalLength, et de les blinder entre états (transitions TPS↔FPS).
//
// La focalLength est DÉRIVÉE du FOV (formule 35 mm) — c'est une info pour le
// post-processing (DOF, etc.), pas une source de vérité.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";

export interface CameraPose {
  /** Position dans le monde. */
  position: THREE.Vector3;
  /** Rotation (ordre YXZ — yaw puis pitch, pas de gimbal lock). */
  rotation: THREE.Euler;
  /** Champ de vision (degrés). */
  fov: number;
  /** Near clip plane (mètres). */
  near: number;
  /** Far clip plane (mètres). */
  far: number;
}

/**
 * Calcule la distance focale équivalente 35 mm à partir du FOV vertical.
 * Formule : f = (sensorHeight / 2) / tan(FOV/2)
 * Avec capteur 35 mm (hauteur 24 mm) : f_mm = 12 / tan(FOV_rad/2)
 */
export function focalLengthFromFov(fovDeg: number): number {
  const fovRad = THREE.MathUtils.degToRad(fovDeg);
  return 12 / Math.tan(fovRad / 2);
}

/**
 * Crée une CameraPose depuis une caméra Three.js existante.
 * Lit position, rotation, fov, near, far.
 */
export function poseFromCamera(cam: THREE.PerspectiveCamera): CameraPose {
  return {
    position: cam.position.clone(),
    rotation: cam.rotation.clone(),
    fov: cam.fov,
    near: cam.near,
    far: cam.far,
  };
}

/**
 * Applique une CameraPose à une caméra Three.js.
 */
export function applyPoseToCamera(pose: CameraPose, cam: THREE.PerspectiveCamera): void {
  cam.position.copy(pose.position);
  cam.rotation.copy(pose.rotation);
  if (cam.fov !== pose.fov) {
    cam.fov = pose.fov;
    cam.updateProjectionMatrix();
  }
  if (cam.near !== pose.near || cam.far !== pose.far) {
    cam.near = pose.near;
    cam.far = pose.far;
    cam.updateProjectionMatrix();
  }
}

/**
 * Interpolation linéaire entre deux poses.
 * `t` ∈ [0, 1] — 0 = a, 1 = b.
 * Le résultat est ÉCRIT dans `out` (zéro alloc).
 */
export function lerpPose(a: CameraPose, b: CameraPose, t: number, out: CameraPose): void {
  out.position.lerpVectors(a.position, b.position, t);

  // Interpolation d'angle Euler par quaternion (pas de gimbal lock).
  const q = new THREE.Quaternion();
  q.setFromEuler(a.rotation);
  const qb = new THREE.Quaternion();
  qb.setFromEuler(b.rotation);
  q.slerp(qb, t);
  out.rotation.setFromQuaternion(q);
  out.rotation.order = "YXZ";

  out.fov  = THREE.MathUtils.lerp(a.fov, b.fov, t);
  out.near = THREE.MathUtils.lerp(a.near, b.near, t);
  out.far  = THREE.MathUtils.lerp(a.far, b.far, t);
}

// ── Poses par défaut ──────────────────────────────────────────────────────────

/**
 * Pose FPS typique : position aux yeux, rotation yaw/pitch.
 * FOV large (80° = FPS moderne), near/far standards.
 */
export function defaultFpsPose(state: {
  yaw: number; pitch: number;
  eyeHeight: number;
  posX: number; posY: number; posZ: number;
}): CameraPose {
  return {
    position: new THREE.Vector3(state.posX, state.posY + state.eyeHeight, state.posZ),
    rotation: new THREE.Euler(state.pitch, state.yaw, 0, "YXZ"),
    fov: 80,
    near: 0.05,
    far: 30000,
  };
}

/**
 * Pose TPS typique : caméra derrière le personnage, regarde vers la tête.
 * FOV légèrement plus large (75°) pour la vision périphérique en combat.
 */
export function defaultTpsPose(state: {
  yaw: number; pitch: number;
  eyeHeight: number;
  posX: number; posY: number; posZ: number;
  tpsDistance: number;
}): CameraPose {
  const cp = Math.cos(state.pitch);
  return {
    position: new THREE.Vector3(
      state.posX + Math.sin(state.yaw) * cp * state.tpsDistance,
      state.posY + state.eyeHeight - Math.sin(state.pitch) * state.tpsDistance,
      state.posZ + Math.cos(state.yaw) * cp * state.tpsDistance,
    ),
    rotation: new THREE.Euler(0, 0, 0, "YXZ"), // will lookAt target
    fov: 75,
    near: 0.05,
    far: 30000,
  };
}
