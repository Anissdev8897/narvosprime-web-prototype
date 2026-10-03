// WebPortal/src/rpg/runtime/space/SpaceWarfareDirector.ts
import * as THREE from 'three';
import type { FactionId, WorldEntity } from '../core/worldTypes';
import { worldEntities } from '../core/worldEntities';
import { eventBus } from '../core/EventBus';
import { ShipCombatant, type ShipCombatantConfig } from '../vehicles/ShipCombatant';
import { ProjectilePool } from '../combat/projectiles';

export interface SpaceWarfareConfig {
  factions: FactionId[];
  shipsPerFaction: number;
  arenaRadius: number;
  respawnDelay: number;
}

interface Fleet {
  combatant: ShipCombatant;
  entity: WorldEntity;
  patrolTarget: THREE.Vector3;
  respawnIn: number;          // 0 = vivant ; > 0 = compte à rebours de réapparition
  destroyedEmitted: boolean;  // garde-fou : émettre ship:destroyed une seule fois
}

const combatantConfig = (faction: FactionId): ShipCombatantConfig => ({
  faction, maxHp: 60, speed: 14, turnRate: 1.8,
  detectRange: 90, attackRange: 35,
  laserCooldown: 0.4, laserDamage: 6, missileCooldown: 3, missileDamage: 18,
  evadeChance: 0.5,
});

export class SpaceWarfareDirector {
  private cfg: SpaceWarfareConfig;
  private ships: Fleet[] = [];
  readonly projectiles = new ProjectilePool(80);
  private idCounter = 0;

  constructor(cfg: SpaceWarfareConfig) {
    this.cfg = cfg;
    for (const f of cfg.factions) for (let i = 0; i < cfg.shipsPerFaction; i++) this.spawnOne(f);
  }

  private randomPos(): THREE.Vector3 {
    const a = Math.random() * Math.PI * 2;
    const r = this.cfg.arenaRadius * (0.4 + Math.random() * 0.5);
    return new THREE.Vector3(Math.cos(a) * r, 20 + Math.random() * 60, Math.sin(a) * r);
  }

  private makeEntity(id: string, faction: FactionId, c: ShipCombatant): WorldEntity {
    return {
      id, kind: 'ship', faction,
      getPosition: () => c.position,
      isAlive: () => c.alive,
      applyDamage: (n) => c.applyDamage(n),
    };
  }

  private spawnOne(faction: FactionId): void {
    const id = `swf_${faction}_${this.idCounter++}`;
    const pos = this.randomPos();
    const combatant = new ShipCombatant(combatantConfig(faction), pos);
    const entity = this.makeEntity(id, faction, combatant);
    worldEntities.register(entity);
    this.ships.push({ combatant, entity, patrolTarget: this.randomPos(), respawnIn: 0, destroyedEmitted: false });
    eventBus.emit('ship:spawned', { id, faction, pos: pos.clone() });
  }

  get fleetCount(): number { return this.ships.filter((s) => s.combatant.alive).length; }
  get fleets(): readonly Fleet[] { return this.ships; }

  update(dt: number): void {
    for (const s of this.ships) {
      const c = s.combatant;

      if (!c.alive) {
        if (!s.destroyedEmitted) {
          worldEntities.unregister(s.entity.id);
          eventBus.emit('ship:destroyed', { id: s.entity.id, faction: c.faction, pos: c.position.clone() });
          s.destroyedEmitted = true;
          s.respawnIn = this.cfg.respawnDelay;
        } else {
          s.respawnIn -= dt;
          if (s.respawnIn <= 0) this.respawn(s);
        }
        continue;
      }

      // Cible ennemie la plus proche
      const enemies = worldEntities.enemiesOf(c.faction, c.position, c.detectRange);
      let target: WorldEntity | null = null, best = Infinity;
      for (const e of enemies) {
        const d2 = e.getPosition().distanceToSquared(c.position);
        if (d2 < best) { best = d2; target = e; }
      }
      const dist = target ? Math.sqrt(best) : Infinity;

      if (c.position.distanceToSquared(s.patrolTarget) < 100) s.patrolTarget = this.randomPos();

      const intent = c.update(dt, target, dist, s.patrolTarget);
      if (target && intent.fireLaser)   this.fire('laser', s, target);
      if (target && intent.fireMissile) this.fire('missile', s, target);
    }
    this.projectiles.update(dt);
  }

  private fire(kind: 'laser' | 'missile', shooter: Fleet, target: WorldEntity): void {
    const c = shooter.combatant;
    const dir = target.getPosition().clone().sub(c.position);
    const dmg = kind === 'laser' ? c.laserDamage : c.missileDamage;
    this.projectiles.spawn(kind, c.position, dir, c.faction, shooter.entity.id, dmg, kind === 'missile' ? target.id : null);
    // la cible visée tente d'esquiver
    this.ships.find((s) => s.entity.id === target.id)?.combatant.tryEvade();
  }

  private respawn(s: Fleet): void {
    const faction = s.combatant.faction;
    const pos = this.randomPos();
    const fresh = new ShipCombatant(combatantConfig(faction), pos);
    const id = `swf_${faction}_${this.idCounter++}`;
    s.combatant = fresh;
    s.entity = this.makeEntity(id, faction, fresh);
    s.patrolTarget = this.randomPos();
    s.respawnIn = 0;
    s.destroyedEmitted = false;
    worldEntities.register(s.entity);
    eventBus.emit('ship:spawned', { id, faction, pos: pos.clone() });
  }

  dispose(): void {
    for (const s of this.ships) worldEntities.unregister(s.entity.id);
    this.ships = [];
    this.projectiles.clear();
  }
}
