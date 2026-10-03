// weapons/weaponBob.ts — procedural FPS weapon bob (marche/course).
//
// Contrôleur pur (zéro dépendance React/R3F). Détecte la vitesse du joueur
// via le delta de position caméra, puis génère un offset sinusoïdal (x,y)
// pour simuler le balancement naturel de l'arme en mouvement.
//
// Double fréquence verticale : le corps "rebondit" 2× par foulée (pied G + D).
// OPTIMISÉ : fastSin via LUT pour les calculs sinusoïdaux.

import * as THREE from "three";
import { fastSin } from "../math/math-fast";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, t);
}

export class WeaponBob {
  private phase = 0;
  private amplitude = 0;
  private prevPos = new THREE.Vector3();
  private initialized = false;

  constructor(
    private freqWalk = 8,
    private freqRun = 12,
    private ampXWalk = 0.008,
    private ampYWalk = 0.006,
    private ampXRun = 0.014,
    private ampYRun = 0.012,
    private runThreshold = 6,
    private walkThreshold = 0.5,
    private smoothing = 8,
  ) {}

  update(camPos: THREE.Vector3, dt: number): void {
    if (!this.initialized || dt <= 0) {
      this.prevPos.copy(camPos);
      this.initialized = true;
      return;
    }

    const dx = camPos.x - this.prevPos.x;
    const dz = camPos.z - this.prevPos.z;
    this.prevPos.copy(camPos);

    const speed = Math.sqrt(dx * dx + dz * dz) / Math.max(dt, 0.001);
    const moving = speed > this.walkThreshold;
    const running = speed > this.runThreshold;

    const targetAmp = moving ? 1 : 0;
    this.amplitude = lerp(this.amplitude, targetAmp, this.smoothing * dt);

    const freq = running ? this.freqRun : this.freqWalk;
    if (this.amplitude > 0.01) {
      this.phase += freq * dt;
    } else {
      this.phase = 0;
    }

    this._ampX = running ? this.ampXRun : this.ampXWalk;
    this._ampY = running ? this.ampYRun : this.ampYWalk;
  }

  private _ampX = 0;
  private _ampY = 0;

  getOffset(): { x: number; y: number } {
    return {
      x: fastSin(this.phase) * this._ampX * this.amplitude,
      y: fastSin(this.phase * 2) * this._ampY * this.amplitude,
    };
  }

  reset(): void {
    this.phase = 0;
    this.amplitude = 0;
    this.initialized = false;
  }
}
