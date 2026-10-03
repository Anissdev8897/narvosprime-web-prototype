// WebPortal/src/rpg/runtime/vehicles/ShipCombatant.test.ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ShipCombatant, decideCombatState, type ShipCombatantConfig } from './ShipCombatant';
import type { WorldEntity } from '../core/worldTypes';

const cfg = (over: Partial<ShipCombatantConfig> = {}): ShipCombatantConfig => ({
  faction: 'akarlys', maxHp: 60, speed: 14, turnRate: 1.8,
  detectRange: 90, attackRange: 35,
  laserCooldown: 0.4, laserDamage: 6, missileCooldown: 3, missileDamage: 18,
  evadeChance: 0.5, ...over,
});
const enemy = (pos: THREE.Vector3): WorldEntity => ({
  id: 'e', kind: 'ship', faction: 'mezalayis',
  getPosition: () => pos, isAlive: () => true, applyDamage: () => {},
});

describe('ShipCombatant', () => {
  it('decideCombatState : attack / pursue / patrol selon la distance', () => {
    const c = cfg();
    expect(decideCombatState('patrol', 10, c)).toBe('attack');   // <= attackRange(35)
    expect(decideCombatState('patrol', 70, c)).toBe('pursue');   // <= detectRange(90)
    expect(decideCombatState('patrol', Infinity, c)).toBe('patrol');
  });

  it('applyDamage tue à 0 PV', () => {
    const s = new ShipCombatant(cfg({ maxHp: 30 }), new THREE.Vector3());
    s.applyDamage(30);
    expect(s.alive).toBe(false);
    expect(s.state).toBe('dead');
  });

  it('tire laser+missile en attaque puis respecte le cooldown', () => {
    const s = new ShipCombatant(cfg(), new THREE.Vector3());
    const i1 = s.update(0.016, enemy(new THREE.Vector3(10, 0, 0)), 10, new THREE.Vector3());
    expect(i1.state).toBe('attack');
    expect(i1.fireLaser).toBe(true);
    const i2 = s.update(0.016, enemy(new THREE.Vector3(10, 0, 0)), 10, new THREE.Vector3());
    expect(i2.fireLaser).toBe(false); // cooldown laser non écoulé
  });

  it('se déplace vers la cible (position mutée)', () => {
    const s = new ShipCombatant(cfg(), new THREE.Vector3(0, 0, 0));
    const before = s.position.x;
    // NOTE : dist=30 ≤ attackRange(35) → état 'attack', le vaisseau fonce vers l'ennemi.
    // Le plan spécifiait dist=100 > detectRange(90) → patrol sans mouvement (incohérence corrigée).
    s.update(0.1, enemy(new THREE.Vector3(100, 0, 0)), 30, new THREE.Vector3());
    expect(s.position.x).toBeGreaterThan(before);
  });
});
