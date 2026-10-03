// WebPortal/src/rpg/runtime/core/worldEntities.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { worldEntities } from './worldEntities';
import type { WorldEntity, FactionId } from './worldTypes';

function mk(id: string, faction: FactionId, pos: THREE.Vector3, alive = true): WorldEntity {
  return { id, kind: 'ship', faction, getPosition: () => pos, isAlive: () => alive, applyDamage: () => {} };
}

describe('worldEntities', () => {
  beforeEach(() => worldEntities.clear());

  it('enemiesOf retourne uniquement les factions ennemies vivantes dans le rayon', () => {
    worldEntities.register(mk('a1', 'akarlys',   new THREE.Vector3(0, 0, 0)));
    worldEntities.register(mk('m1', 'mezalayis', new THREE.Vector3(5, 0, 0)));   // ennemi, proche
    worldEntities.register(mk('m2', 'mezalayis', new THREE.Vector3(500, 0, 0))); // ennemi, hors rayon
    worldEntities.register(mk('z1', 'zayan',     new THREE.Vector3(4, 0, 0)));   // ennemi, proche
    const enemies = worldEntities.enemiesOf('akarlys', new THREE.Vector3(0, 0, 0), 50);
    expect(enemies.map((e) => e.id).sort()).toEqual(['m1', 'z1']);
  });

  it('inRadius ignore les entités mortes', () => {
    worldEntities.register(mk('dead', 'zayan', new THREE.Vector3(1, 0, 0), false));
    expect(worldEntities.inRadius(new THREE.Vector3(0, 0, 0), 10)).toHaveLength(0);
  });
});
