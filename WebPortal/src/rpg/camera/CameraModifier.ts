// ══════════════════════════════════════════════════════════════════════════════
// camera/CameraModifier.ts — Chaîne de modifieurs caméra (comme UCameraModifier)
//
// POURQUOI CE FICHIER EXISTE :
// Dans Unreal Engine, UCameraModifier est une chaîne de post-processing qui
// permet à chaque système (shake, recoil, FOV zoom, look-at, etc.) de modifier
// la pose de la caméra APRÈS le positionnement de base. Chaque modifieur a :
//   • Une priorité (ordre d'application)
//   • Un blend in/out (transition fluide)
//   • La possibilité de se désactiver (α=0)
//
// Ici, CameraModifierChain orchestre une liste de CameraModifier, triés par
// priorité, et les exécute en pipeline. Chaque modifieur reçoit la pose
// SORTIE du précédent.
//
// NB : Le recul directionnel (CameraRecoilController) reste dans applyShake
// (FpsCamera) pour backward compatibility. Les modifieurs ci-dessous sont
// des AJOUTS au système existant.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import type { CameraPose } from "./cameraPose";
import { cameraShakeController } from "./cameraShake";

// ══════════════════════════════════════════════════════════════════════════════
// 1. Modifier abstrait
// ══════════════════════════════════════════════════════════════════════════════

export interface CameraModifier {
  /** Priorité d'exécution. Plus petit = exécuté en premier. */
  readonly priority: number;
  /** Temps de montée (secondes) pour atteindre α=1. */
  readonly blendInTime: number;
  /** Temps de retombée (secondes) depuis α=1. */
  readonly blendOutTime: number;

  /**
   * Tick : met à jour l'état interne du modifieur.
   * @param active true si le propriétaire veut que ce modifieur soit actif.
   * @returns true si le modifieur est toujours valide (false = retiré de la chaîne).
   */
  tick(dt: number, active: boolean): boolean;

  /**
   * Modifie la pose en place.
   * `alpha` ∈ [0, 1] est le poids de blend calculé par la chaîne.
   */
  modify(pose: CameraPose, alpha: number, dt: number): void;
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. CameraModifierChain — pipeline trié par priorité
// ══════════════════════════════════════════════════════════════════════════════

interface ModSlot {
  modifier: CameraModifier;
  /** α interne du modifieur (0 = désactivé, 1 = pleine puissance). */
  alpha: number;
  /** true si le modifieur a été marqué comme actif ce tick. */
  active: boolean;
}

export class CameraModifierChain {
  private slots: ModSlot[] = [];

  /**
   * Ajoute un modifieur. Si un modifieur existe déjà avec la même priorité,
   * il est REMPLACÉ (pas de doublon).
   */
  add(modifier: CameraModifier): void {
    const existing = this.slots.findIndex((s) => s.modifier.priority === modifier.priority);
    if (existing >= 0) {
      this.slots[existing] = { modifier, alpha: this.slots[existing].alpha, active: true };
    } else {
      this.slots.push({ modifier, alpha: 0, active: true });
      this.slots.sort((a, b) => a.modifier.priority - b.modifier.priority);
    }
  }

  /** Retire un modifieur par priorité. */
  remove(priority: number): void {
    this.slots = this.slots.filter((s) => s.modifier.priority !== priority);
  }

  /** Retire tous les modifieurs. */
  clear(): void {
    this.slots.length = 0;
  }

  /**
   * Tick tous les modifieurs.
   * Chaque modifieur est tické avec `active=true` par défaut.
   * Si un modifieur retourne false, il est retiré.
   */
  tickAll(dt: number): void {
    this.slots = this.slots.filter((slot) => {
      const stillAlive = slot.modifier.tick(dt, slot.active);

      // Blend in/out
      if (slot.active) {
        slot.alpha = Math.min(1, slot.alpha + (slot.modifier.blendInTime > 0 ? dt / slot.modifier.blendInTime : 1));
      } else {
        slot.alpha = Math.max(0, slot.alpha - (slot.modifier.blendOutTime > 0 ? dt / slot.modifier.blendOutTime : 1));
      }

      // Retirer si complètement fondu ET inactif
      if (slot.alpha <= 0 && !slot.active) return false;
      return stillAlive;
    });
  }

  /**
   * Marque tous les modifieurs comme actifs. Ceux qui ne sont pas marqués
   * via cette méthode (appelée AVANT tickAll) vont fondre progressivement.
   */
  markAllActive(): void {
    for (const slot of this.slots) slot.active = true;
  }

  /**
   * Marque un modifieur spécifique comme actif (par priorité).
   */
  markActive(priority: number, active: boolean): void {
    for (const slot of this.slots) {
      if (slot.modifier.priority === priority) {
        slot.active = active;
        return;
      }
    }
  }

  /**
   * Exécute la chaîne de modifieurs sur une pose.
   * La pose est mutée en place par chaque modifieur dans l'ordre de priorité.
   */
  process(pose: CameraPose, dt: number): void {
    for (const slot of this.slots) {
      if (slot.alpha > 0) {
        slot.modifier.modify(pose, slot.alpha, dt);
      }
    }
  }

  /** Nombre de modifieurs dans la chaîne. */
  get count(): number {
    return this.slots.length;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. Modifieurs concrets
// ══════════════════════════════════════════════════════════════════════════════

// ── Vecteurs de travail (zéro alloc par frame) ────────────────────────────────
const SHAKE_POS_OFFSET = new THREE.Vector3();
const SHAKE_ROT_EULER = new THREE.Euler();
const TMP_QUAT = new THREE.Quaternion();
const TMP_QUAT_B = new THREE.Quaternion();

/**
 * ShakeModifier — pilote le CameraShakeController (Perlin noise) et applique
 * son offset à la pose. Priorité 100 : s'applique après le positionnement.
 *
 * Le système legacy (screenShake + CameraRecoilController) reste dans applyShake
 * de FpsCamera et n'est PAS doublé ici.
 */
export class ShakeModifier implements CameraModifier {
  readonly priority = 100;
  readonly blendInTime = 0.05;
  readonly blendOutTime = 0.1;

  tick(_dt: number, _active: boolean): boolean { return true; }

  modify(pose: CameraPose, alpha: number, dt: number): void {
    if (!cameraShakeController.tick(dt, SHAKE_POS_OFFSET)) return;

    // Position offset (monde)
    pose.position.x += SHAKE_POS_OFFSET.x * alpha;
    pose.position.y += SHAKE_POS_OFFSET.y * alpha;
    pose.position.z += SHAKE_POS_OFFSET.z * alpha;

    // Rotation offset (pitch, yaw, roll via quaternion)
    SHAKE_ROT_EULER.set(
      SHAKE_POS_OFFSET.x * 0.05,
      SHAKE_POS_OFFSET.y * 0.03,
      SHAKE_POS_OFFSET.z * 0.04,
    );
    TMP_QUAT.setFromEuler(pose.rotation);
    TMP_QUAT_B.setFromEuler(SHAKE_ROT_EULER);
    TMP_QUAT.multiply(TMP_QUAT_B);
    pose.rotation.setFromQuaternion(TMP_QUAT);
    pose.rotation.order = "YXZ";
  }
}

/**
 * FovModifier — change temporairement le FOV (zoom hit/sprint/ads).
 * Priorité 200 : s'applique après tout le reste.
 *
 * Utilisation :
 *   const fov = new FovModifier(60);
 *   chain.add(fov);
 *   fov.trigger(); // begin blend-in
 *   fov.release(); // begin blend-out
 */
export class FovModifier implements CameraModifier {
  readonly priority = 200;
  readonly blendInTime = 0.1;
  readonly blendOutTime = 0.15;
  readonly targetFov: number;
  private _active = true;

  constructor(targetFov: number) {
    this.targetFov = targetFov;
  }

  /** Active le zoom FOV (le FOV va blend-in vers targetFov). */
  trigger(): void { this._active = true; }
  /** Désactive le zoom FOV (le FOV va blend-out vers la valeur de base). */
  release(): void { this._active = false; }

  tick(_dt: number, active: boolean): boolean {
    if (!active) this._active = false;
    return true;
  }

  modify(pose: CameraPose, alpha: number, _dt: number): void {
    if (this._active) {
      pose.fov = THREE.MathUtils.lerp(pose.fov, this.targetFov, alpha);
    }
  }
}

/**
 * LookAtModifier — force la caméra à regarder une cible explicite.
 * Priorité 0 : s'exécute en premier.
 *
 * Contrairement au lookAt de TPS qui regarde la tête du joueur, celui-ci
 * permet de verrouiller le regard sur un point externe (target, PNJ, objet).
 */
export class LookAtModifier implements CameraModifier {
  readonly priority = 0;
  readonly blendInTime = 0;
  readonly blendOutTime = 0;

  private target = new THREE.Vector3();
  private _hasTarget = false;

  /** Définit la cible du regard. */
  setTarget(x: number, y: number, z: number): void {
    this.target.set(x, y, z);
    this._hasTarget = true;
  }

  /** Supprime la cible (le modifieur devient no-op). */
  clearTarget(): void {
    this._hasTarget = false;
  }

  get hasTarget(): boolean { return this._hasTarget; }

  tick(_dt: number, _active: boolean): boolean { return true; }

  modify(pose: CameraPose, _alpha: number, _dt: number): void {
    if (!this._hasTarget) return;
    const dir = new THREE.Vector3().copy(this.target).sub(pose.position);
    if (dir.lengthSq() < 0.0001) return;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir.normalize());
    pose.rotation.setFromQuaternion(q);
    pose.rotation.order = "YXZ";
  }
}
