// ══════════════════════════════════════════════════════════════════════════════
// camera/CameraRecoilController.ts — Recul caméra piloté par profils (singleton).
//
// Modèle "impulsion" : chaque applyRecoil empile une impulse {profil, elapsed}.
// Chaque frame, l'enveloppe (montée `attack` linéaire → retour `duration × ease`)
// pondère les offsets rot/pos du profil. Plusieurs impulses se SOMMENT (combo).
//
// La part "tremblement" (shakeTrauma) est déléguée au screenShake EXISTANT — les
// deux systèmes coexistent (décision : recoil directionnel ici, trauma là-bas).
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import { ease } from "./ease";
import type { CameraRecoilProfile } from "./recoilProfiles";
import type { ICameraShakeable, RecoilOffset } from "./ICameraShakeable";
import { screenShake } from "../runtime/screenShake";

interface Impulse { profile: CameraRecoilProfile; elapsed: number; }

/** Poids 0→1→0 d'une impulsion à l'instant t (montée puis retour selon la courbe). */
export function envelope(t: number, attack: number, duration: number, ease01: (x: number) => number): number {
  if (t <= 0) return 0;
  if (t < attack) return attack > 0 ? t / attack : 1; // montée linéaire (kick sec)
  const k = duration > 0 ? (t - attack) / duration : 1; // 0..1 sur la phase de retour
  return 1 - ease01(Math.min(1, k));                    // 1 → 0
}

class CameraRecoilController implements ICameraShakeable {
  private impulses: Impulse[] = [];
  private outPos = new THREE.Vector3();
  private outRot = new THREE.Euler();

  applyRecoil(profile: CameraRecoilProfile): void {
    this.impulses.push({ profile, elapsed: 0 });
    // Part tremblement → screenShake existant (les deux systèmes cohabitent).
    if (profile.shakeTrauma > 0) screenShake.add(profile.shakeTrauma);
  }

  tick(dt: number): RecoilOffset {
    this.outPos.set(0, 0, 0);
    let rx = 0, ry = 0, rz = 0;
    if (this.impulses.length > 0) {
      this.impulses = this.impulses.filter((im) => {
        im.elapsed += dt;
        const p = im.profile;
        const total = p.attack + p.duration;
        if (im.elapsed >= total) return false; // impulse terminée → retirée
        const w = envelope(im.elapsed, p.attack, p.duration, (x) => ease(p.returnEase, x));
        this.outPos.x += p.pos.x * w;
        this.outPos.y += p.pos.y * w;
        this.outPos.z += p.pos.z * w;
        rx += p.rot.pitch * w;
        ry += p.rot.yaw * w;
        rz += p.rot.roll * w;
        return true;
      });
    }
    this.outRot.set(rx, ry, rz);
    return { pos: this.outPos, rot: this.outRot, active: this.impulses.length > 0 };
  }

  reset(): void { this.impulses.length = 0; }
}

export const cameraRecoil = new CameraRecoilController();
