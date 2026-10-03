// WebPortal/src/rpg/runtime/vehicles/ShipCombatant.ts
import * as THREE from 'three';
import type { FactionId, WorldEntity } from '../core/worldTypes';

export type CombatState = 'patrol' | 'pursue' | 'attack' | 'dead';

export interface ShipCombatantConfig {
  faction: FactionId;
  maxHp: number;
  speed: number;       // m/s
  turnRate: number;    // réactivité d'orientation (lerp vitesse)
  detectRange: number;
  attackRange: number;
  laserCooldown: number; laserDamage: number;
  missileCooldown: number; missileDamage: number;
  evadeChance: number; // 0..1
}

export interface CombatIntent { state: CombatState; fireLaser: boolean; fireMissile: boolean; }

/** Décision d'état PURE (hystérésis anti-clignotement). distToEnemy = Infinity si aucun. */
export function decideCombatState(current: CombatState, distToEnemy: number, cfg: ShipCombatantConfig): CombatState {
  if (current === 'dead') return 'dead';
  if (distToEnemy <= cfg.attackRange) return 'attack';
  if (current === 'attack' && distToEnemy <= cfg.attackRange * 1.25) return 'attack';
  if (distToEnemy <= cfg.detectRange) return 'pursue';
  if ((current === 'pursue' || current === 'attack') && distToEnemy <= cfg.detectRange * 1.5) return 'pursue';
  return 'patrol';
}

export class ShipCombatant {
  hp: number;
  state: CombatState = 'patrol';
  readonly position: THREE.Vector3;
  readonly velocity = new THREE.Vector3();

  private cfg: ShipCombatantConfig;
  private laserTimer = 0;
  private missileTimer = 0;
  private evadeTimer = 0;
  private evadeOffset = new THREE.Vector3();
  private _desired = new THREE.Vector3();

  constructor(cfg: ShipCombatantConfig, startPos: THREE.Vector3) {
    this.cfg = cfg; this.hp = cfg.maxHp; this.position = startPos.clone();
  }

  get faction(): FactionId { return this.cfg.faction; }
  get alive(): boolean { return this.state !== 'dead'; }
  get hpFraction(): number { return Math.max(0, this.hp / this.cfg.maxHp); }
  get detectRange(): number { return this.cfg.detectRange; }
  get laserDamage(): number { return this.cfg.laserDamage; }
  get missileDamage(): number { return this.cfg.missileDamage; }

  applyDamage(amount: number): void {
    if (this.state === 'dead') return;
    this.hp -= Math.max(0, amount);
    if (this.hp <= 0) { this.hp = 0; this.state = 'dead'; }
  }

  /** Jet d'esquive (déclenché quand le vaisseau est visé). */
  tryEvade(rng: () => number = Math.random): void {
    if (this.evadeTimer > 0 || this.state === 'dead') return;
    if (rng() < this.cfg.evadeChance) {
      this.evadeTimer = 0.6;
      this.evadeOffset.set(rng() - 0.5, (rng() - 0.5) * 0.4, rng() - 0.5).normalize();
    }
  }

  /** Avance d'une frame. Mute position/velocity. @returns intentions de tir. */
  update(dt: number, enemy: WorldEntity | null, enemyDist: number, patrolTarget: THREE.Vector3): CombatIntent {
    if (this.state === 'dead') return { state: 'dead', fireLaser: false, fireMissile: false };

    this.laserTimer = Math.max(0, this.laserTimer - dt);
    this.missileTimer = Math.max(0, this.missileTimer - dt);
    this.evadeTimer = Math.max(0, this.evadeTimer - dt);
    this.state = decideCombatState(this.state, enemyDist, this.cfg);

    let fireLaser = false, fireMissile = false;
    const d = this._desired;
    if (this.state === 'patrol' || !enemy) {
      d.copy(patrolTarget).sub(this.position);
    } else {
      d.copy(enemy.getPosition()).sub(this.position);
      if (this.state === 'attack') {
        if (this.laserTimer === 0)   { fireLaser = true;   this.laserTimer = this.cfg.laserCooldown; }
        if (this.missileTimer === 0) { fireMissile = true; this.missileTimer = this.cfg.missileCooldown; }
      }
    }
    if (d.lengthSq() > 1e-6) d.normalize();
    if (this.evadeTimer > 0) d.add(this.evadeOffset).normalize();

    d.multiplyScalar(this.cfg.speed);
    this.velocity.lerp(d, Math.min(1, this.cfg.turnRate * dt));
    this.position.addScaledVector(this.velocity, dt);

    return { state: this.state, fireLaser, fireMissile };
  }
}
