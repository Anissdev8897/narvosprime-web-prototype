import { describe, it, expect, beforeEach } from "vitest";
import * as THREE from "three";
import { statusEffects } from "./statusEffects";
import { npcRegistry, type NpcHandle } from "../npc/npcRegistry";

function fakeNpc(id: string): { handle: NpcHandle; damage: () => number; kill: () => void } {
  let taken = 0;
  let alive = true;
  const handle: NpcHandle = {
    id, role: "enemy",
    getPosition: () => new THREE.Vector3(),
    isAlive: () => alive,
    applyDamage: (a) => { taken += a; },
    getLoot: () => null,
    takeLoot: () => null,
  };
  return { handle, damage: () => taken, kill: () => { alive = false; } };
}

describe("statusEffects", () => {
  beforeEach(() => { statusEffects.reset(); npcRegistry.clear(); });

  it("brûlure : applique dps × temps via applyDamage, par paliers", () => {
    const n = fakeNpc("m1"); npcRegistry.register(n.handle);
    statusEffects.applyBurn("m1", 10, 1.0); // 10 dps pendant 1s → 10 dégâts
    expect(statusEffects.isBurning("m1")).toBe(true);
    statusEffects.tick(0.5); // palier → 5 dégâts
    statusEffects.tick(0.5); // palier → 5 dégâts, fin
    expect(n.damage()).toBeCloseTo(10);
    expect(statusEffects.isBurning("m1")).toBe(false);
  });

  it("brûlure : n'applique rien à un PNJ mort", () => {
    const n = fakeNpc("m2"); npcRegistry.register(n.handle); n.kill();
    statusEffects.applyBurn("m2", 50, 2);
    statusEffects.tick(0.6);
    expect(n.damage()).toBe(0); // déjà mort → pas de DoT
  });

  it("root : isRooted true puis expire", () => {
    statusEffects.applyRoot("m3", 0.3);
    expect(statusEffects.isRooted("m3")).toBe(true);
    statusEffects.tick(0.4);
    expect(statusEffects.isRooted("m3")).toBe(false);
  });

  it("stun (K.O.) : isStunned true puis expire", () => {
    const n = fakeNpc("e1"); npcRegistry.register(n.handle); // vivant → tick ne purge pas
    statusEffects.applyStun("e1", 1.0);
    expect(statusEffects.isStunned("e1")).toBe(true);
    statusEffects.tick(0.5);
    expect(statusEffects.isStunned("e1")).toBe(true);
    statusEffects.tick(0.6); // total 1.1 > 1.0
    expect(statusEffects.isStunned("e1")).toBe(false);
  });

  it("invisibilité : joueur non ciblable pendant la durée puis rétabli", () => {
    expect(npcRegistry.playerTargetable).toBe(true);
    statusEffects.applyInvisibility(1.0);
    expect(statusEffects.isPlayerInvisible()).toBe(true);
    expect(npcRegistry.playerTargetable).toBe(false);
    statusEffects.tick(1.1);
    expect(statusEffects.isPlayerInvisible()).toBe(false);
    expect(npcRegistry.playerTargetable).toBe(true);
  });

  it("reset rétablit tout", () => {
    statusEffects.applyInvisibility(5); statusEffects.applyRoot("x", 5);
    statusEffects.reset();
    expect(statusEffects.isPlayerInvisible()).toBe(false);
    expect(statusEffects.isRooted("x")).toBe(false);
    expect(npcRegistry.playerTargetable).toBe(true);
  });
});
