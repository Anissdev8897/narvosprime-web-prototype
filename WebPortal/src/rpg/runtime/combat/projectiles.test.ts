// WebPortal/src/rpg/runtime/combat/projectiles.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { ProjectilePool } from './projectiles';
import { worldEntities } from '../core/worldEntities';
import { eventBus } from '../core/EventBus';
import type { WorldEntity } from '../core/worldTypes';

describe('ProjectilePool', () => {
  beforeEach(() => { worldEntities.clear(); eventBus.clear(); });

  it('un laser touche un ennemi → dégâts + combat:hit', () => {
    let hp = 100;
    const target: WorldEntity = {
      id: 't', kind: 'ship', faction: 'mezalayis',
      getPosition: () => new THREE.Vector3(2, 0, 0), isAlive: () => hp > 0,
      applyDamage: (n) => { hp -= n; },
    };
    worldEntities.register(target);
    const hit = vi.fn(); eventBus.on('combat:hit', hit);
    const pool = new ProjectilePool(8);
    pool.spawn('laser', new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), 'akarlys', 'shooter', 10, null);
    for (let i = 0; i < 40 && hp === 100; i++) pool.update(0.016);
    expect(hp).toBeLessThan(100);
    expect(hit).toHaveBeenCalled();
  });

  it('un projectile ignore les alliés (même faction)', () => {
    let hp = 100;
    const ally: WorldEntity = {
      id: 'ally', kind: 'ship', faction: 'akarlys',
      getPosition: () => new THREE.Vector3(2, 0, 0), isAlive: () => true,
      applyDamage: (n) => { hp -= n; },
    };
    worldEntities.register(ally);
    const pool = new ProjectilePool(8);
    pool.spawn('laser', new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0), 'akarlys', 'shooter', 10, null);
    for (let i = 0; i < 40; i++) pool.update(0.016);
    expect(hp).toBe(100); // allié jamais touché
  });

  it('free-list O(1) — forEachActive ne visite que les actifs', () => {
    const pool = new ProjectilePool(8);
    const origin = new THREE.Vector3(0, 0, 0);
    const dir = new THREE.Vector3(1, 0, 0);
    pool.spawn('laser', origin, dir, 'akarlys', 'p1', 10, null);
    pool.spawn('laser', origin, dir, 'akarlys', 'p2', 10, null);
    let count = 0;
    pool.forEachActive(() => { count++; });
    expect(count).toBe(2);
  });

  it('free-list O(1) — activeCount retourne le bon nombre', () => {
    const pool = new ProjectilePool(8);
    expect(pool.activeCount()).toBe(0);
    const origin = new THREE.Vector3(0, 0, 0);
    const dir = new THREE.Vector3(1, 0, 0);
    pool.spawn('laser', origin, dir, 'akarlys', 'p1', 10, null);
    pool.spawn('laser', origin, dir, 'akarlys', 'p2', 10, null);
    expect(pool.activeCount()).toBe(2);
    pool.update(3); // TTL > max → release
    expect(pool.activeCount()).toBe(0);
  });
});
