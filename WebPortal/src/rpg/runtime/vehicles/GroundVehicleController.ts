// ══════════════════════════════════════════════════════════════════════════════
// vehicles/GroundVehicleController.ts — Physique d'un véhicule TERRESTRE (PURE)
//
// Système SÉPARÉ des vaisseaux volants : hérite de ShipController (pour réutiliser
// PV / stats / dégâts / réparation et l'interface attendue par PlayerRig &
// RpgGameWorld), mais réécrit ENTIÈREMENT update() avec une physique de voiture :
//
//   • W/S        = accélération avant / marche arrière (le long du nez, au sol)
//   • Souris + A/D = direction (volant) — autorité ↑ avec la vitesse
//   • Gravité PLEINE : aucun vol. La caisse suit le terrain détecté sous elle.
//   • Roues animées (clip Wheel_Spin) pilotées par la vitesse signée → voir
//     PilotableShip. `forwardSpeed` (+ avant / − arrière) et `steerInput`
//     exposés pour l'animation.
//
// Le suivi de terrain s'appuie sur `_groundBelow` (raycast injecté chaque frame
// par PilotableShip pour les véhicules terrestres) → le contrôleur reste pur.
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";
import { ShipController } from "./ShipController";
import type { VehicleDef } from "./vehicleCatalog";

const GROUND = {
  accel:         24,   // m/s² — accélération avant
  reverseAccel:  14,   // m/s² — marche arrière
  maxSpeed:      14,   // m/s  — vitesse max (avant), × speedMult
  boostMult:     1.7,  // Shift
  driveFriction: 0.6,  // /s   — frottement en accélérant (tenue de route)
  brakeFriction: 2.8,  // /s   — frottement en relâchant (freinage moteur)
  yawRate:       2.2,  // rad/s — direction à la souris (× sensitivity × autorité)
  steerRate:     1.8,  // rad/s — direction A/D
  gravity:       22,   // m/s²  — chute pleine (PAS de vol)
  // rideHeight = distance origine-modèle → bas des roues (mesurée sur la bbox
  // monde de vehicule_terrestre.glb : min.y = -0.413). Origine posée à
  // groundY + rideHeight → les roues touchent pile le sol (+ ~7 mm de marge).
  rideHeight:    0.42, // m
  maxStepUp:     0.8,  // m     — marche franchissable (snap vers le haut)
} as const;

export class GroundVehicleController extends ShipController {
  private _steerInput = 0;

  // ── Overrides ─────────────────────────────────────────────────────────────
  get isGround(): boolean { return true; }
  /** Jamais "dans l'espace" → ne déclenche pas la percée atmosphérique. */
  get inSpace(): boolean { return false; }
  /** Entrée volant -1..1 (pour l'anim Steering du modèle). */
  get steerInput(): number { return this._steerInput; }

  update(
    dt: number,
    lookDX: number, _lookDY: number,
    moveX: number, moveZ: number,
    boost: boolean, _liftUp: boolean, _liftDown: boolean,
    sensitivity = 0.0026,
  ): void {
    dt = Math.min(dt, 0.05);

    // ── 1. Direction (volant) : souris + A/D tournent le yaw ─────────────────
    // Autorité ↑ avec la vitesse (on tourne mieux en roulant) ; minimum à
    // l'arrêt pour manœuvrer. yaw qui DÉCROÎT = tourner à droite (cohérent ship).
    const spd = Math.abs(this.forwardSpeed);
    const authority = 0.45 + Math.min(1, spd / 8) * 0.55;
    this.yaw -= lookDX * sensitivity * GROUND.yawRate * authority;
    this.yaw -= moveX * GROUND.steerRate * dt * authority;
    this._steerInput = THREE.MathUtils.clamp(moveX, -1, 1);
    this.pitch = 0; // véhicule à plat
    this.roll  = 0;
    this._rebuild();

    // ── 2. Propulsion le long du nez, projeté à l'horizontale ────────────────
    const inThrust = -moveZ; // W (moveZ=-1) → +1 = avancer
    const bMult = (boost ? GROUND.boostMult : 1) * this._speedMult;
    let fx = this.forward.x, fz = this.forward.z;
    const flen = Math.sqrt(fx * fx + fz * fz) || 1;
    fx /= flen; fz /= flen;
    if (inThrust > 0) {
      this.vel.x += fx * GROUND.accel * bMult * inThrust * dt;
      this.vel.z += fz * GROUND.accel * bMult * inThrust * dt;
    } else if (inThrust < 0) {
      this.vel.x += fx * GROUND.reverseAccel * inThrust * dt;
      this.vel.z += fz * GROUND.reverseAccel * inThrust * dt;
    }

    // ── 3. Friction au sol (freinage moteur en roue libre) ───────────────────
    const fdamp = Math.max(0, 1 - (inThrust === 0 ? GROUND.brakeFriction : GROUND.driveFriction) * dt);
    this.vel.x *= fdamp;
    this.vel.z *= fdamp;

    // Cap vitesse horizontale.
    const hspeed = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);
    const maxH = GROUND.maxSpeed * this._speedMult * (boost ? GROUND.boostMult : 1);
    if (hspeed > maxH) { const s = maxH / hspeed; this.vel.x *= s; this.vel.z *= s; }

    // ── 4. Gravité PLEINE (aucun vol) ────────────────────────────────────────
    this.vel.y -= GROUND.gravity * dt;

    // ── 5. Intégration ───────────────────────────────────────────────────────
    this.position.addScaledVector(this.vel, dt);

    // ── 6. Suivi de terrain : pose la caisse sur le sol détecté ──────────────
    if (this._groundBelow !== null) {
      const targetY = this._groundBelow + GROUND.rideHeight;
      if (this.position.y <= targetY + GROUND.maxStepUp) {
        this.position.y = targetY;
        if (this.vel.y < 0) this.vel.y = 0; // posé → stoppe la chute
      }
    } else if (this.position.y < 1.0) {
      // Garde-fou si aucun sol détecté (ne tombe pas à l'infini).
      this.position.y = 1.0;
      if (this.vel.y < 0) this.vel.y = 0;
    }
  }
}

/**
 * Factory : crée le bon contrôleur selon le TYPE du véhicule et y applique ses
 * stats. "ground" → GroundVehicleController, sinon → ShipController (vol).
 */
export function createVehicleController(
  def: VehicleDef, pos: THREE.Vector3, yaw: number,
): ShipController {
  const ctrl = def.kind === "ground"
    ? new GroundVehicleController(pos, yaw)
    : new ShipController(pos, yaw);
  ctrl.applyVehicleDef(def);
  return ctrl;
}
