import { describe, it, expect, beforeEach } from "vitest";
import * as THREE from "three";
import {
  CameraModifierChain,
  ShakeModifier,
  FovModifier,
  LookAtModifier,
  type CameraModifier,
} from "./CameraModifier";
import type { CameraPose } from "./cameraPose";
import { cameraShakeController } from "./cameraShake";
import type { ShakePattern } from "./cameraShake";

function makePose(overrides?: Partial<CameraPose>): CameraPose {
  return {
    position: new THREE.Vector3(0, 1.65, 0),
    rotation: new THREE.Euler(0, 0, 0, "YXZ"),
    fov: 80,
    near: 0.05,
    far: 30000,
    ...overrides,
  };
}

function clonePose(p: CameraPose): CameraPose {
  return {
    position: p.position.clone(),
    rotation: p.rotation.clone(),
    fov: p.fov,
    near: p.near,
    far: p.far,
  };
}

/** Helper: crée un modifieur simple pour les tests. */
function makeMod(priority: number, modifyFn?: (pose: CameraPose, alpha: number, dt: number) => void): CameraModifier {
  return {
    priority,
    blendInTime: 0,
    blendOutTime: 0,
    tick() { return true; },
    modify(pose: CameraPose, alpha: number, dt: number) { modifyFn?.(pose, alpha, dt); },
  };
}

describe("CameraModifierChain", () => {
  let chain: CameraModifierChain;

  beforeEach(() => {
    chain = new CameraModifierChain();
  });

  it("chaîne vide → process ne modifie pas la pose", () => {
    const pose = makePose();
    const before = clonePose(pose);
    chain.process(pose, 0.016);
    expect(pose.position.x).toBe(before.position.x);
    expect(pose.fov).toBe(before.fov);
  });

  it("process tickAll puis process dans l'ordre de priorité", () => {
    const log: number[] = [];
    chain.add(makeMod(50, () => log.push(50)));
    chain.add(makeMod(10, () => log.push(10)));
    chain.add(makeMod(30, () => log.push(30)));

    chain.markAllActive();
    chain.tickAll(0.016);
    chain.process(makePose(), 0.016);

    expect(log).toEqual([10, 30, 50]); // trié par priorité croissante
  });

  it("ajout remplace un modifieur de même priorité", () => {
    chain.add(makeMod(10, (pose) => { pose.fov = 42; }));
    chain.add(makeMod(10, (pose) => { pose.fov = 99; })); // remplace

    chain.markAllActive();
    chain.tickAll(0.016);

    const pose = makePose();
    chain.process(pose, 0.016);
    expect(pose.fov).toBe(99);
  });

  it("remove supprime un modifieur par priorité", () => {
    let called = false;
    chain.add(makeMod(10, () => { called = true; }));
    chain.remove(10);
    chain.markAllActive();
    chain.tickAll(0.016);
    chain.process(makePose(), 0.016);
    expect(called).toBe(false);
  });

  it("clear vide la chaîne", () => {
    chain.add(makeMod(10));
    expect(chain.count).toBe(1);
    chain.clear();
    expect(chain.count).toBe(0);
  });

  it("tickAll gère blendInTime correctement", () => {
    let lastAlpha = 0;
    const mod: CameraModifier = {
      priority: 10,
      blendInTime: 0.2, // 200ms pour α=1
      blendOutTime: 0,
      tick() { return true; },
      modify(_pose, alpha) { lastAlpha = alpha; },
    };
    chain.add(mod);

    chain.markAllActive();
    chain.tickAll(0.1); // 50% du blendIn → alpha de la slot = 0.5
    chain.process(makePose(), 0.016); // déclenche modify
    expect(lastAlpha).toBeGreaterThan(0);
    expect(lastAlpha).toBeLessThan(1); // pas encore à 100%

    chain.markAllActive();
    chain.tickAll(0.15); // dépasse le temps requis
    chain.process(makePose(), 0.016);
    expect(lastAlpha).toBeCloseTo(1);
  });

  it("modifieur inactif → blendOut puis retiré", () => {
    let active = true;
    const mod: CameraModifier = {
      priority: 10,
      blendInTime: 0,
      blendOutTime: 0.05, // 50ms
      tick(_dt, a) { active = a; return true; },
      modify() {},
    };
    chain.add(mod);
    chain.markAllActive();
    chain.tickAll(0.01); // α=1 (blendIn=0)

    chain.markActive(10, false);
    chain.tickAll(0.04);
    expect(chain.count).toBe(1); // pas encore retiré

    chain.tickAll(0.02); // blendOut fini
    expect(chain.count).toBe(0);
  });
});

describe("ShakeModifier", () => {
  beforeEach(() => {
    cameraShakeController.clear();
  });

  it("aucune secousse → ne modifie pas la pose", () => {
    const mod = new ShakeModifier();
    const pose = makePose();
    const before = clonePose(pose);
    mod.modify(pose, 1, 0.016);
    expect(pose.position.x).toBeCloseTo(before.position.x);
    expect(pose.position.z).toBeCloseTo(before.position.z);
  });

  it("secousse active → modifie position et rotation", () => {
    const shakePattern: ShakePattern = {
      type: "wave",
      params: { freqX: 10, freqY: 0, freqZ: 0, ampX: 0.5, ampY: 0, ampZ: 0 },
    };
    cameraShakeController.add({
      pattern: shakePattern,
      intensity: 1,
      remaining: 1,
      elapsed: 0,
      attack: 0,
      decay: 0,
    });

    const mod = new ShakeModifier();
    const pose = makePose();
    mod.modify(pose, 1, 0.016);
    const moved = pose.position.x !== 0 || pose.position.y !== 1.65 || pose.position.z !== 0;
    expect(moved).toBe(true);
  });

  it("alpha=0 → pas d'effet même avec secousse active", () => {
    const shakePattern: ShakePattern = {
      type: "wave",
      params: { freqX: 10, freqY: 0, freqZ: 0, ampX: 0.5, ampY: 0, ampZ: 0 },
    };
    cameraShakeController.add({
      pattern: shakePattern,
      intensity: 1,
      remaining: 1,
      elapsed: 0,
      attack: 0,
      decay: 0,
    });

    const mod = new ShakeModifier();
    const pose = makePose();
    mod.modify(pose, 0, 0.016);
    expect(pose.position.x).toBeCloseTo(0);
  });
});

describe("FovModifier", () => {
  it("trigger + alpha=1 → FOV à targetFov", () => {
    const mod = new FovModifier(60);
    const pose = makePose({ fov: 80 });

    mod.trigger();
    mod.modify(pose, 1, 0.016);
    expect(pose.fov).toBeCloseTo(60);
  });

  it("alpha partiel → FOV blendé", () => {
    const mod = new FovModifier(60);
    const pose = makePose({ fov: 80 });

    mod.trigger();
    mod.modify(pose, 0.5, 0.016);
    expect(pose.fov).toBeCloseTo(70); // lerp(80, 60, 0.5) = 70
  });

  it("release → tick inactif → le blend out s'active", () => {
    const mod = new FovModifier(60);
    mod.trigger();
    const stillAlive = mod.tick(0.016, false);
    expect(stillAlive).toBe(true);
  });
});

describe("LookAtModifier", () => {
  it("sans cible → ne modifie pas la rotation", () => {
    const mod = new LookAtModifier();
    const pose = makePose({ rotation: new THREE.Euler(0.5, 1, 0, "YXZ") });
    const before = pose.rotation.clone();
    mod.modify(pose, 1, 0.016);
    expect(pose.rotation.x).toBe(before.x);
    expect(pose.rotation.y).toBe(before.y);
  });

  it("avec cible → oriente la rotation vers la cible", () => {
    const mod = new LookAtModifier();
    const pose = makePose({
      position: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Euler(0, 0, 0, "YXZ"),
    });

    mod.setTarget(0, 0, -10);
    mod.modify(pose, 1, 0.016);
    // Doit regarder vers -Z
    const q = new THREE.Quaternion().setFromEuler(pose.rotation);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    expect(dir.z).toBeLessThan(0);
  });

  it("clearTarget désactive l'effet", () => {
    const mod = new LookAtModifier();
    mod.setTarget(0, 0, -10);
    expect(mod.hasTarget).toBe(true);

    mod.clearTarget();
    const pose = makePose();
    const beforeRot = pose.rotation.clone();
    mod.modify(pose, 1, 0.016);
    expect(pose.rotation.x).toBe(beforeRot.x);
    expect(mod.hasTarget).toBe(false);
  });

  it("cible = position caméra → pas de rotation (pas de plantage)", () => {
    const mod = new LookAtModifier();
    const pose = makePose({ position: new THREE.Vector3(0, 0, 0) });

    mod.setTarget(0, 0, 0);
    mod.modify(pose, 1, 0.016);
    expect(pose.rotation.x).toBeCloseTo(0);
  });
});
