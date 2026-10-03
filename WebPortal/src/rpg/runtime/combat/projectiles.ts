// WebPortal/src/rpg/runtime/combat/projectiles.ts
// Pool d'objets projectiles : free-list O(1) spawn/release, zéro allocation par frame.
// Collision par proximité avec broadphase spatiale (forEachEnemyInRadius).
import * as THREE from 'three';
import type { FactionId, WeaponKind } from '../core/worldTypes';
import { worldEntities } from '../core/worldEntities';
import { areEnemies } from '../../factions/factions';
import { eventBus } from '../core/EventBus';

export interface Projectile {
  active: boolean;
  idx: number;           // position stable dans le pool (free-list)
  kind: WeaponKind;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  ttl: number;
  damage: number;
  faction: FactionId;
  ownerId: string;
  targetId: string | null;
}

const LASER_SPEED = 120, MISSILE_SPEED = 45, MISSILE_TURN = 2.5, HIT_RADIUS = 2.0;
const _desired = new THREE.Vector3();
const _hitPos = new THREE.Vector3(); // scratch pour l'event combat:hit

/** Pool de projectiles : zéro allocation par frame, collision par proximité. */
export class ProjectilePool {
  private pool: Projectile[] = [];
  private free: number[] = [];      // pile d'indices libres → spawn/release O(1)

  constructor(size = 64) { for (let i = 0; i < size; i++) this._make(i); }

  private _make(idx: number): void {
    this.pool.push({
      active: false, idx,
      kind: 'laser', pos: new THREE.Vector3(), vel: new THREE.Vector3(),
      ttl: 0, damage: 0, faction: 'akarlys', ownerId: '', targetId: null,
    });
  }

  /** Tire un projectile. O(1) — free-list. */
  spawn(kind: WeaponKind, from: THREE.Vector3, dir: THREE.Vector3, faction: FactionId,
        ownerId: string, damage: number, targetId: string | null = null): void {
    const i = this.free.pop();
    const p = i !== undefined ? this.pool[i] : (this._make(this.pool.length), this.pool[this.pool.length - 1]);
    p.active = true; p.kind = kind; p.pos.copy(from);
    const speed = kind === 'laser' ? LASER_SPEED : MISSILE_SPEED;
    p.vel.copy(dir).normalize().multiplyScalar(speed);
    p.ttl = kind === 'laser' ? 2 : 5;
    p.damage = damage; p.faction = faction; p.ownerId = ownerId; p.targetId = targetId;
  }

  private release(p: Projectile): void {
    if (!p.active) return;
    p.active = false;
    this.free.push(p.idx);
  }

  /** Visite chaque projectile actif (zéro alloc). */
  forEachActive(cb: (p: Projectile) => void): void {
    for (const p of this.pool) { if (p.active) cb(p); }
  }

  /** Nombre de projectiles actifs (zéro alloc — comptage en place). */
  activeCount(): number {
    let n = 0;
    for (const p of this.pool) if (p.active) n++;
    return n;
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.ttl -= dt;
      if (p.ttl <= 0) { this.release(p); continue; }

      // Guidage missile vers sa cible vivante
      if (p.kind === 'missile' && p.targetId) {
        const target = worldEntities.all().find((e) => e.id === p.targetId && e.isAlive());
        if (target) {
          _desired.copy(target.getPosition()).sub(p.pos).normalize().multiplyScalar(MISSILE_SPEED);
          p.vel.lerp(_desired, Math.min(1, MISSILE_TURN * dt));
        }
      }
      p.pos.addScaledVector(p.vel, dt);

      // Collision par proximité contre les entités ennemies
      const r2 = HIT_RADIUS * HIT_RADIUS;
      for (const e of worldEntities.all()) {
        if (!e.isAlive() || e.id === p.ownerId) continue;
        if (e.faction && !areEnemies(p.faction, e.faction)) continue;
        if (e.getPosition().distanceToSquared(p.pos) <= r2) {
          e.applyDamage(p.damage, p.ownerId);
          _hitPos.copy(p.pos);
          eventBus.emit('combat:hit', { targetId: e.id, amount: p.damage, weapon: p.kind, pos: _hitPos, attackerFaction: p.faction });
          this.release(p);
          break;
        }
      }
    }
  }

  /** Accès au tableau interne pour rendu InstancedMesh (indexé par idx). */
  get active(): readonly Projectile[] { return this.pool; }

  clear(): void { for (const p of this.pool) { if (p.active) { p.active = false; this.free.push(p.idx); } } }
}
