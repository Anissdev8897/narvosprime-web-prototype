import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { WeaponBob } from "./weaponBob";

describe("WeaponBob", () => {
  it("returns zero offset when stationary", () => {
    const bob = new WeaponBob();
    const pos = new THREE.Vector3(0, 1, 0);
    bob.update(pos, 0.016);
    bob.update(pos, 0.016);
    bob.update(pos, 0.016);
    const off = bob.getOffset();
    expect(off.x).toBe(0);
    expect(off.y).toBe(0);
  });

  it("produces non-zero offset when moving", () => {
    const bob = new WeaponBob();
    const pos = new THREE.Vector3(0, 1, 0);
    bob.update(pos, 0.016);
    for (let i = 0; i < 30; i++) {
      pos.x += 0.1;
      bob.update(pos, 0.016);
    }
    const off = bob.getOffset();
    expect(Math.abs(off.x) + Math.abs(off.y)).toBeGreaterThan(0);
  });

  it("resets to zero", () => {
    const bob = new WeaponBob();
    const pos = new THREE.Vector3(0, 1, 0);
    bob.update(pos, 0.016);
    pos.x += 5;
    bob.update(pos, 0.016);
    bob.reset();
    const off = bob.getOffset();
    expect(off.x).toBe(0);
    expect(off.y).toBe(0);
  });

  it("amplitude decays when movement stops", () => {
    const bob = new WeaponBob();
    const pos = new THREE.Vector3(0, 1, 0);
    bob.update(pos, 0.016);
    for (let i = 0; i < 20; i++) {
      pos.x += 0.15;
      bob.update(pos, 0.016);
    }
    const peakMag = Math.abs(bob.getOffset().x) + Math.abs(bob.getOffset().y);
    for (let i = 0; i < 60; i++) {
      bob.update(pos, 0.016);
    }
    const decayedMag = Math.abs(bob.getOffset().x) + Math.abs(bob.getOffset().y);
    expect(decayedMag).toBeLessThan(peakMag);
  });
});
