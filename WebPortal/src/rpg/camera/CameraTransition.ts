// ══════════════════════════════════════════════════════════════════════════════
// camera/CameraTransition.ts — Transition fluide TPS ↔ FPS
//
// POURQUOI CE FICHIER EXISTE :
// Basculer entre FPS et TPS instantanément (=snap) est désorientant. Ce module
// interpole progressivement entre les deux poses sur une durée configurable.
// Pendant la transition, le blend se fait sur position + rotation + FOV.
//
// Le flux :
//   1) `start()` avec from/to → la transition s'amorce
//   2) `update(dt)` chaque frame → retourne la pose blendée (ou null si finie)
//   3) `snap()` → termine immédiatement
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import type { CameraPose } from "./cameraPose";
import { lerpPose } from "./cameraPose";

/** Courbe de progression de la transition. */
export type TransitionEasing = "linear" | "easeOutCubic" | "easeInOutCubic" | "smoothstep";

function applyEasing(t: number, easing: TransitionEasing): number {
  switch (easing) {
    case "linear":        return t;
    case "easeOutCubic":  return 1 - Math.pow(1 - t, 3);
    case "easeInOutCubic": return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case "smoothstep":    return t * t * (3 - 2 * t);
  }
}

export interface CameraTransitionConfig {
  /** Durée de la transition en secondes (défaut: 0.3). */
  duration: number;
  /** Courbe d'easing (défaut: easeOutCubic). */
  easing: TransitionEasing;
}

const DEFAULT_CONFIG: CameraTransitionConfig = {
  duration: 0.3,
  easing: "easeOutCubic",
};

const TMP_POSE: CameraPose = {
  position: new THREE.Vector3(),
  rotation: new THREE.Euler(0, 0, 0, "YXZ"),
  fov: 80,
  near: 0.05,
  far: 30000,
};

export class CameraViewTransition {
  private config: CameraTransitionConfig;
  /** Vrai si une transition est en cours. */
  private _active = false;
  /** Progression normalisée [0, 1]. */
  private _progress = 0;
  /** Pose de départ. */
  private from: CameraPose | null = null;
  /** Pose d'arrivée. */
  private to: CameraPose | null = null;

  constructor(config?: Partial<CameraTransitionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Vrai si une transition est active. */
  get active(): boolean { return this._active; }
  /** Progression [0, 1]. 0 = départ, 1 = arrivée. */
  get progress(): number { return this._progress; }

  /**
   * Démarre une transition entre deux poses.
   * Si une transition était déjà en cours, elle redémarre depuis 0 avec les
   * nouvelles poses.
   */
  start(from: CameraPose, to: CameraPose): void {
    this.from = from;
    this.to = to;
    this._progress = 0;
    this._active = true;
  }

  /**
   * Snap : termine immédiatement la transition → renvoie la pose d'arrivée.
   */
  snap(): void {
    this._active = false;
    this._progress = 1;
  }

  /**
   * Avance la transition de `dt` secondes.
   * @returns La pose blendée si la transition est active, null sinon.
   */
  update(dt: number): CameraPose | null {
    if (!this._active || !this.from || !this.to) return null;

    this._progress = Math.min(1, this._progress + dt / this.config.duration);

    const t = applyEasing(this._progress, this.config.easing);
    lerpPose(this.from, this.to, t, TMP_POSE);

    if (this._progress >= 1) {
      this._active = false;
    }

    return TMP_POSE;
  }

  /** Remet à zéro (annule toute transition en cours). */
  reset(): void {
    this._active = false;
    this._progress = 0;
    this.from = null;
    this.to = null;
  }
}
