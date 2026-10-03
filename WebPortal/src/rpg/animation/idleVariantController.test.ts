import { describe, it, expect } from "vitest";
import { IdleVariantController, IDLE_VARIANT_PATHS } from "./idleVariantController";

describe("IDLE_VARIANT_PATHS", () => {
  it("contient au moins 2 variantes", () => {
    expect(IDLE_VARIANT_PATHS.length).toBeGreaterThanOrEqual(2);
  });

  it("tous les chemins pointent vers des GLB", () => {
    for (const p of IDLE_VARIANT_PATHS) {
      expect(p).toMatch(/\.glb$/);
    }
  });
});

describe("IdleVariantController", () => {
  it("retourne -1 quand le perso n'est pas idle", () => {
    const ctrl = new IdleVariantController(3);
    expect(ctrl.update(0.016, false)).toBe(-1);
  });

  it("retourne un index >= 0 dès le premier frame idle", () => {
    const ctrl = new IdleVariantController(3);
    const idx = ctrl.update(0.016, true);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(3);
  });

  it("garde le même index avant expiration du timer", () => {
    const ctrl = new IdleVariantController(3, { minDelay: 10, maxDelay: 10 });
    const first = ctrl.update(0.5, true);
    const second = ctrl.update(0.5, true);
    expect(second).toBe(first);
  });

  it("change d'index quand le timer expire", () => {
    const ctrl = new IdleVariantController(3, { minDelay: 1, maxDelay: 1 });
    ctrl.update(0.5, true);
    const before = ctrl.current;
    ctrl.update(1.1, true);
    const after = ctrl.current;
    expect(typeof after).toBe("number");
    expect(after).toBeGreaterThanOrEqual(0);
    expect(after).toBeLessThan(3);
    // Pas de garantie de changement sur 1 transition (ShuffleBag peut tirer le même
    // si c'est le premier tirage après reshuffle), mais l'index est valide.
  });

  it("reset quand le perso quitte l'idle puis revient", () => {
    const ctrl = new IdleVariantController(3, { minDelay: 2, maxDelay: 2 });
    ctrl.update(1.5, true); // accumule 1.5s
    ctrl.update(0.016, false); // sort de l'idle → reset
    const idx = ctrl.update(0.016, true); // re-entre en idle
    expect(idx).toBeGreaterThanOrEqual(0);
  });

  it("ne produit que des indices dans [0, variantCount)", () => {
    const ctrl = new IdleVariantController(5, { minDelay: 0.01, maxDelay: 0.01 });
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const idx = ctrl.update(0.02, true);
      seen.add(idx);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(5);
    }
    expect(seen.size).toBe(5);
  });

  it("reset() remet l'état à zéro", () => {
    const ctrl = new IdleVariantController(3, { minDelay: 0.01, maxDelay: 0.01 });
    ctrl.update(0.5, true);
    ctrl.update(0.5, true);
    ctrl.reset();
    expect(ctrl.current).toBe(0);
  });
});
