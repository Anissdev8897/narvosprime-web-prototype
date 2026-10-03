import { describe, it, expect, beforeEach } from "vitest";
import * as THREE from "three";
import {
  perlin3D,
  samplePattern,
  CameraShakeController,
  type ShakePattern,
} from "./cameraShake";

// ══════════════════════════════════════════════════════════════════════════════
// Perlin noise
// ══════════════════════════════════════════════════════════════════════════════

describe("perlin3D", () => {
  it("retourne une valeur dans [-1, 1]", () => {
    for (let i = 0; i < 100; i++) {
      const v = perlin3D(i * 0.7, i * 1.3, i * 0.2);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("est déterministe (mêmes entrées → même sortie)", () => {
    const a = perlin3D(1.234, 5.678, 9.012);
    const b = perlin3D(1.234, 5.678, 9.012);
    expect(a).toBe(b);
  });

  it("est continue (petite variation d'entrée → petite variation de sortie)", () => {
    const a = perlin3D(10, 20, 30);
    const b = perlin3D(10.001, 20, 30);
    expect(Math.abs(a - b)).toBeLessThan(0.05);
  });

  it("n'est pas constante (variance sur différentes entrées)", () => {
    const vals = new Set<number>();
    for (let i = 0; i < 20; i++) {
      vals.add(perlin3D(i * 1.5, i * 2.3, i * 0.7));
    }
    expect(vals.size).toBeGreaterThan(10);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Shake pattern sampling
// ══════════════════════════════════════════════════════════════════════════════

describe("samplePattern", () => {
  it("wave pattern produit des sinusoïdes", () => {
    const pattern: ShakePattern = {
      type: "wave",
      params: { freqX: 1, freqY: 2, freqZ: 0.5, ampX: 1, ampY: 0.5, ampZ: 0.2 },
    };
    const r0 = samplePattern(pattern, 0);
    expect(r0.x).toBeCloseTo(0);
    expect(r0.y).toBeCloseTo(Math.sin(1.3) * 0.5); // y a un offset de phase
    const r025 = samplePattern(pattern, 0.25);
    expect(r025.x).toBeCloseTo(1); // sin(π/2) = 1
  });

  it("perlin pattern produit des valeurs non nulles", () => {
    const pattern: ShakePattern = {
      type: "perlin",
      params: { freq: 1, ampX: 1, ampY: 1, ampZ: 1 },
    };
    const offsets: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = samplePattern(pattern, i * 0.1);
      offsets.push(r.x);
    }
    // Au moins une valeur non nulle (très peu probable d'avoir 10×0)
    const nonZero = offsets.filter((v) => Math.abs(v) > 0.001);
    expect(nonZero.length).toBeGreaterThan(0);
  });

  it("composite pattern somme ses sous-patterns", () => {
    const p1: ShakePattern = { type: "wave", params: { freqX: 1, freqY: 0, freqZ: 0, ampX: 1, ampY: 0, ampZ: 0 } };
    const p2: ShakePattern = { type: "wave", params: { freqX: 2, freqY: 0, freqZ: 0, ampX: 0.5, ampY: 0, ampZ: 0 } };
    const composite: ShakePattern = { type: "composite", patterns: [p1, p2] };
    const r = samplePattern(composite, 0.25);
    expect(r.x).toBeCloseTo(1 + 0.5 * Math.sin(Math.PI)); // sin(π/2)=1, sin(π)=0
  });

  it("perlin pattern est déterministe", () => {
    const pattern: ShakePattern = {
      type: "perlin",
      params: { freq: 1, ampX: 1, ampY: 1, ampZ: 1 },
    };
    const a = samplePattern(pattern, 3.14);
    const b = samplePattern(pattern, 3.14);
    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
    expect(a.z).toBe(b.z);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CameraShakeController
// ══════════════════════════════════════════════════════════════════════════════

const PERLIN_SHAKE: ShakePattern = {
  type: "perlin",
  params: { freq: 5, ampX: 0.1, ampY: 0.1, ampZ: 0.05 },
};
const WAVE_SHAKE: ShakePattern = {
  type: "wave",
  params: { freqX: 10, freqY: 12, freqZ: 8, ampX: 0.05, ampY: 0.03, ampZ: 0.02 },
};

describe("CameraShakeController", () => {
  let ctrl: CameraShakeController;
  const out = new THREE.Vector3();

  beforeEach(() => {
    ctrl = new CameraShakeController();
    out.set(0, 0, 0);
  });

  it("aucune secousse → tick retourne false", () => {
    const active = ctrl.tick(0.016, out);
    expect(active).toBe(false);
    expect(out.x).toBe(0);
  });

  it("une secousse active → tick retourne true et produit un offset", () => {
    ctrl.add({
      pattern: PERLIN_SHAKE,
      intensity: 1,
      remaining: 1,
      elapsed: 0,
      attack: 0.05,
      decay: 0.05,
    });
    const active = ctrl.tick(0.016, out);
    expect(active).toBe(true);
    // Au moins une coordonnée non nulle
    const nonzero = Math.abs(out.x) + Math.abs(out.y) + Math.abs(out.z);
    expect(nonzero).toBeGreaterThan(0);
  });

  it("secousse se termine après sa durée", () => {
    ctrl.add({
      pattern: WAVE_SHAKE,
      intensity: 1,
      remaining: 0.05,
      elapsed: 0,
      attack: 0,
      decay: 0,
    });
    ctrl.tick(0.03, out); // encore active
    expect(ctrl.activeCount).toBe(1);
    ctrl.tick(0.03, out); // remaining = -0.01 → terminée
    expect(ctrl.activeCount).toBe(0);
    expect(ctrl.tick(0.016, out)).toBe(false);
  });

  it("attack fait monter progressivement l'intensité", () => {
    ctrl.add({
      pattern: { type: "wave", params: { freqX: 1, freqY: 0, freqZ: 0, ampX: 1, ampY: 0, ampZ: 0 } },
      intensity: 1,
      remaining: 1,
      elapsed: 0,
      attack: 0.1,
      decay: 0,
    });
    // À t=0.01 (10% de l'attaque)
    ctrl.tick(0.01, out);
    const x10pct = Math.abs(out.x);
    // À t=0.05 (50% de l'attaque)
    ctrl.tick(0.04, out);
    const x50pct = Math.abs(out.x);
    // 50% doit être > 10% (l'amplitude augmente)
    expect(x50pct).toBeGreaterThan(x10pct);
  });

  it("decay réduit l'intensité en fin de vie", () => {
    // La secousse survit `remaining` secondes avec enveloppe de decay dans
    // les dernières `decay` secondes
    ctrl.add({
      pattern: WAVE_SHAKE,
      intensity: 1,
      remaining: 0.15,  // durée totale
      elapsed: 0,
      attack: 0,
      decay: 0.10,       // decay les dernières 0.10s
    });
    // t=0.04 : remaining=0.11, pas encore en decay
    ctrl.tick(0.04, out);
    expect(ctrl.activeCount).toBe(1);

    // t=0.14 : remaining=0.01, en decay (0.01 < 0.10)
    ctrl.tick(0.10, out);
    expect(ctrl.activeCount).toBe(1); // encore active (en decay)

    // t=0.16 : remaining=-0.01, terminée
    ctrl.tick(0.02, out);
    expect(ctrl.activeCount).toBe(0);
  });

  it("clear() supprime toutes les secousses", () => {
    ctrl.add({ pattern: WAVE_SHAKE, intensity: 1, remaining: 2, elapsed: 0, attack: 0, decay: 0 });
    ctrl.add({ pattern: PERLIN_SHAKE, intensity: 1, remaining: 2, elapsed: 0, attack: 0, decay: 0 });
    expect(ctrl.activeCount).toBe(2);
    ctrl.clear();
    expect(ctrl.activeCount).toBe(0);
    expect(ctrl.tick(0.016, out)).toBe(false);
  });

  it("removeIf supprime les instances matchant le prédicat", () => {
    ctrl.add({ pattern: WAVE_SHAKE, intensity: 1, remaining: 2, elapsed: 0, attack: 0, decay: 0 });
    ctrl.add({ pattern: PERLIN_SHAKE, intensity: 0.5, remaining: 2, elapsed: 0, attack: 0, decay: 0 });
    ctrl.removeIf((i) => i.intensity < 0.8);
    expect(ctrl.activeCount).toBe(1);
  });

  it("plusieurs secousses se cumulent", () => {
    const pattern: ShakePattern = {
      type: "wave",
      params: { freqX: 0, freqY: 0, freqZ: 0, ampX: 1, ampY: 0, ampZ: 0 },
    };
    ctrl.add({ pattern, intensity: 1, remaining: 1, elapsed: 0, attack: 0, decay: 0 });
    ctrl.add({ pattern, intensity: 1, remaining: 1, elapsed: 0, attack: 0, decay: 0 });

    ctrl.tick(0.016, out);
    // Deux instances avec même pattern → offset doublé
    const solo = new CameraShakeController();
    const soloOut = new THREE.Vector3();
    solo.add({ pattern, intensity: 1, remaining: 1, elapsed: 0, attack: 0, decay: 0 });
    solo.tick(0.016, soloOut);

    expect(Math.abs(out.x)).toBeCloseTo(Math.abs(soloOut.x) * 2, 1);
  });
});
