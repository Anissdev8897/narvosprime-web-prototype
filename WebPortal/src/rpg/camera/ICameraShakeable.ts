// camera/ICameraShakeable.ts — contrat standardisé du système de recul caméra.
//
// N'importe quelle source (sort, mêlée, archery, boss) déclenche un recul via
// applyRecoil(profile). La caméra (FpsCamera) lit l'offset courant via tick(dt)
// et l'applique. Découple totalement "qui déclenche" de "comment ça secoue".
import type * as THREE from "three";
import type { CameraRecoilProfile } from "./recoilProfiles";

export interface RecoilOffset {
  /** Offset de position en repère caméra LOCAL (z+ = recul). */
  pos: THREE.Vector3;
  /** Offset de rotation (pitch/yaw/roll) à ajouter à la caméra. */
  rot: THREE.Euler;
  /** true si au moins une impulsion est active (sinon la caméra court-circuite). */
  active: boolean;
}

export interface ICameraShakeable {
  /** Déclenche un recul (typiquement appelé par un Animation Event). */
  applyRecoil(profile: CameraRecoilProfile): void;
  /** Avance les impulsions et renvoie l'offset caméra courant. */
  tick(dt: number): RecoilOffset;
  /** Remet à zéro (changement de map / mort). */
  reset(): void;
}
