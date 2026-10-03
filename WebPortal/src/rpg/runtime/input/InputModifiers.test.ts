import { describe, it, expect } from "vitest";
import { applyModifiers } from "./InputModifiers";
import { EModifierType } from "./types";

describe("InputModifiers", () => {
  describe("DeadZone", () => {
    it("laisse passer les valeurs au-dessus du seuil (1D)", () => {
      const r = applyModifiers(0.5, [{ type: EModifierType.DeadZone, threshold: 0.1 }]);
      expect(r).toBeGreaterThan(0);
    });

    it("coupe les valeurs sous le seuil (1D)", () => {
      const r = applyModifiers(0.05, [{ type: EModifierType.DeadZone, threshold: 0.1 }]);
      expect(r).toBe(0);
    });

    it("remappe linéairement après le seuil (1D)", () => {
      // 0.55 avec threshold 0.1 → (0.55-0.1)/(1-0.1) = 0.45/0.9 = 0.5
      const r = applyModifiers(0.55, [{ type: EModifierType.DeadZone, threshold: 0.1 }]);
      expect(r).toBeCloseTo(0.5, 5);
    });

    it("applique la zone morte sur un vecteur 2D", () => {
      const r = applyModifiers([0.5, 0.5] as [number, number], [
        { type: EModifierType.DeadZone, threshold: 0.3 },
      ]);
      expect(Array.isArray(r)).toBe(true);
      const arr = r as [number, number];
      expect(arr[0]).toBeGreaterThan(0);
      expect(arr[1]).toBeGreaterThan(0);
    });

    it("coupe un vecteur 2D sous le seuil radial", () => {
      const r = applyModifiers([0.05, 0.05] as [number, number], [
        { type: EModifierType.DeadZone, threshold: 0.1 },
      ]);
      expect(r).toEqual([0, 0]);
    });

    it("sature au lieu d'amplifier hors de [-1,1], même avec un seuil de 1", () => {
      // Cas limite double : seuil = 1 (dénominateur nul) ET magnitude = 10 (axe
      // non normalisé). La formule brute rendait `Infinity` sur x. La sortie doit
      // rester un vecteur unitaire dans la direction d'origine.
      const r = applyModifiers([10, 0, 0] as [number, number, number], [
        { type: EModifierType.DeadZone, threshold: 1 },
      ]);
      const arr = r as [number, number, number];
      expect(arr[0]).toBe(1);
      expect(arr[1]).toBe(0);
      expect(arr[2]).toBe(0);
    });

    it("ne produit jamais de valeur non finie, quel que soit le seuil", () => {
      for (const threshold of [0, 0.5, 1, 1.5, -1]) {
        const r = applyModifiers([3, -4] as [number, number], [
          { type: EModifierType.DeadZone, threshold },
        ]) as [number, number];
        expect(Number.isFinite(r[0])).toBe(true);
        expect(Number.isFinite(r[1])).toBe(true);
        expect(Math.hypot(r[0], r[1])).toBeLessThanOrEqual(1 + 1e-9);
      }
    });
  });

  describe("Scalar", () => {
    it("multiplie une valeur numérique", () => {
      const r = applyModifiers(0.5, [{ type: EModifierType.Scalar, factor: 2 }]);
      expect(r).toBe(1);
    });

    it("multiplie un vecteur 2D", () => {
      const r = applyModifiers([1, -1] as [number, number], [
        { type: EModifierType.Scalar, factor: 0.5 },
      ]);
      expect(r).toEqual([0.5, -0.5]);
    });

    it("multiplie un vecteur 3D", () => {
      const r = applyModifiers([2, 4, 6] as [number, number, number], [
        { type: EModifierType.Scalar, factor: 0.5 },
      ]);
      expect(r).toEqual([1, 2, 3]);
    });

    it("inverse un booléen si facteur négatif", () => {
      const r = applyModifiers(true, [{ type: EModifierType.Scalar, factor: -1 }]);
      expect(r).toBe(false);
    });

    it("laisse un booléen inchangé si facteur positif", () => {
      const r = applyModifiers(true, [{ type: EModifierType.Scalar, factor: 1 }]);
      expect(r).toBe(true);
    });
  });

  describe("Negate", () => {
    it("inverse une valeur numérique", () => {
      const r = applyModifiers(0.5, [{ type: EModifierType.Negate }]);
      expect(r).toBe(-0.5);
    });

    it("inverse un vecteur 2D", () => {
      const r = applyModifiers([1, -2] as [number, number], [
        { type: EModifierType.Negate },
      ]);
      expect(r).toEqual([-1, 2]);
    });

    it("inverse un booléen", () => {
      expect(applyModifiers(true, [{ type: EModifierType.Negate }])).toBe(false);
      expect(applyModifiers(false, [{ type: EModifierType.Negate }])).toBe(true);
    });
  });

  describe("Swizzle", () => {
    it("réorganise les axes d'un vecteur 2D", () => {
      const r = applyModifiers([1, 2] as [number, number], [
        { type: EModifierType.Swizzle, swizzleOrder: [1, 0] },
      ]);
      expect(r).toEqual([2, 1]);
    });

    it("réorganise les axes d'un vecteur 3D", () => {
      const r = applyModifiers([1, 2, 3] as [number, number, number], [
        { type: EModifierType.Swizzle, swizzleOrder: [2, 0, 1] },
      ]);
      expect(r).toEqual([3, 1, 2]);
    });
  });

  describe("Chaîne de modificateurs", () => {
    it("applique les modificateurs dans l'ordre", () => {
      // Negate puis Scalar 3 : -0.5 → 0.5 → 1.5
      const r = applyModifiers(-0.5, [
        { type: EModifierType.Negate },
        { type: EModifierType.Scalar, factor: 3 },
      ]);
      expect(r).toBe(1.5);
    });

    it("DeadZone puis Scalar", () => {
      // 0.05 coupé par DeadZone(0.1) → 0, *2 = 0
      const r = applyModifiers(0.05, [
        { type: EModifierType.DeadZone, threshold: 0.1 },
        { type: EModifierType.Scalar, factor: 2 },
      ]);
      expect(r).toBe(0);
    });

    it("Scalar puis Negate", () => {
      const r = applyModifiers(2, [
        { type: EModifierType.Scalar, factor: 3 },
        { type: EModifierType.Negate },
      ]);
      expect(r).toBe(-6);
    });
  });
});
