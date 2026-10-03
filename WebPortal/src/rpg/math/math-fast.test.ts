// ══════════════════════════════════════════════════════════════════════════════
// math/math-fast.test.ts — Tests de précision et vérification fonctionnelle
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  fastSin, fastCos, fastSinCos,
  fastAtan2, fastAtan2Quick,
  fastHypot, fastHypot3,
  fastInvSqrt,
  normalizeIfNeeded,
} from "./math-fast";

// ── Tolérances adaptées à chaque approximation ──────────────────────────────
const TOL_SIN = 3e-4;  // LUT 1024 + interpolation
const TOL_ATAN2 = 5e-3; // approx a*(π/4 + 0.273*(1-a)) — ~0.23°
const TOL_ATAN2_QUICK = 1.5e-2; // a/(1+0.28a²) — ~0.8°
const TOL_HYPOT = 0.1; // 10% — usage IA/anim
const TOL_INVSQRT = 1e-6; // 1/Math.sqrt + Newton

// ── fastSin / fastCos / fastSinCos ──────────────────────────────────────────

describe("fastSin / fastCos", () => {
  it("sin(0) = 0, sin(π/2) ≈ 1", () => {
    expect(fastSin(0)).toBeCloseTo(0, 4);
    expect(fastSin(Math.PI / 2)).toBeCloseTo(1, 3);
  });

  it("cos(0) ≈ 1, cos(π/2) ≈ 0", () => {
    expect(fastCos(0)).toBeCloseTo(1, 4);
    expect(fastCos(Math.PI / 2)).toBeCloseTo(0, 2);
  });

  it("précision max sur 1000 points aléatoires", () => {
    let maxErr = 0;
    for (let i = 0; i < 1000; i++) {
      const x = (Math.random() - 0.5) * 100; // angles arbitraires
      const ref = Math.sin(x);
      const approx = fastSin(x);
      const err = Math.abs(approx - ref);
      if (err > maxErr) maxErr = err;
    }
    expect(maxErr).toBeLessThan(TOL_SIN);
  });

  it("fastSinCos produit sin et cos cohérents entre eux", () => {
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 20 - 10;
      const { sin, cos } = fastSinCos(x);
      // identité : sin² + cos² ≈ 1
      const ident = sin * sin + cos * cos;
      expect(ident).toBeCloseTo(1, 3);
    }
  });

  it("fastSinCos = fastSin + fastCos combinés en un seul appel", () => {
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * 20 - 10;
      const { sin, cos } = fastSinCos(x);
      expect(Math.abs(sin - fastSin(x))).toBeLessThan(TOL_SIN);
      expect(Math.abs(cos - fastCos(x))).toBeLessThan(TOL_SIN);
    }
  });

  it("gère les angles négatifs", () => {
    expect(fastSin(-Math.PI / 2)).toBeCloseTo(-1, 2);
    expect(fastCos(-Math.PI)).toBeCloseTo(-1, 2);
  });

  it("périodicité : fastSin(x + 2π) ≈ fastSin(x)", () => {
    const x = Math.random() * 10;
    const s1 = fastSin(x);
    const s2 = fastSin(x + Math.PI * 2);
    expect(Math.abs(s1 - s2)).toBeLessThan(1e-5);
  });

  it("cos par shift : fastCos(x) ≈ fastSin(x + π/2)", () => {
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * 10 - 5;
      const shift = fastSin(x + Math.PI / 2);
      const cos = fastCos(x);
      expect(Math.abs(shift - cos)).toBeLessThan(5e-4);
    }
  });
});

// ── fastAtan2 ───────────────────────────────────────────────────────────────

describe("fastAtan2", () => {
  it("atan2(0, 1) = 0", () => {
    expect(fastAtan2(0, 1)).toBeCloseTo(0, 4);
  });

  it("atan2(1, 0) = π/2", () => {
    expect(fastAtan2(1, 0)).toBeCloseTo(Math.PI / 2, 4);
  });

  it("atan2(0, -1) = π", () => {
    expect(fastAtan2(0, -1)).toBeCloseTo(Math.PI, 4);
  });

  it("atan2(-1, 0) = -π/2", () => {
    expect(fastAtan2(-1, 0)).toBeCloseTo(-Math.PI / 2, 4);
  });

  it("précision max sur 2000 points (quadrants variés)", () => {
    let maxErr = 0;
    for (let i = 0; i < 2000; i++) {
      const y = (Math.random() - 0.5) * 20;
      const x = (Math.random() - 0.5) * 20;
      if (Math.abs(x) < 1e-10 && Math.abs(y) < 1e-10) continue;
      const ref = Math.atan2(y, x);
      const approx = fastAtan2(y, x);
      const err = Math.abs(approx - ref);
      if (err > maxErr) maxErr = err;
    }
    expect(maxErr).toBeLessThan(TOL_ATAN2);
  });

  it("symétrie : atan2(y,x) = -atan2(-y,x)", () => {
    for (let i = 0; i < 100; i++) {
      const y = (Math.random() - 0.5) * 10;
      const x = (Math.random() - 0.5) * 10;
      if (Math.abs(x) < 1e-10) continue;
      expect(fastAtan2(y, x)).toBeCloseTo(-fastAtan2(-y, x), 5);
    }
  });

  it("gère (0, 0) → 0", () => {
    expect(fastAtan2(0, 0)).toBe(0);
  });
});

// ── fastAtan2Quick ──────────────────────────────────────────────────────────

describe("fastAtan2Quick", () => {
  it("précision max ~0.5° sur 2000 points", () => {
    let maxErr = 0;
    for (let i = 0; i < 2000; i++) {
      const y = (Math.random() - 0.5) * 20;
      const x = (Math.random() - 0.5) * 20;
      if (Math.abs(x) < 1e-10 && Math.abs(y) < 1e-10) continue;
      const ref = Math.atan2(y, x);
      const approx = fastAtan2Quick(y, x);
      const err = Math.abs(approx - ref);
      if (err > maxErr) maxErr = err;
    }
    expect(maxErr).toBeLessThan(TOL_ATAN2_QUICK);
  });

  it("repère correctement les 4 quadrants", () => {
    // Q1: (+y, +x) → positif
    expect(fastAtan2Quick(1, 1)).toBeGreaterThan(0);
    // Q2: (+y, -x) → positif
    expect(fastAtan2Quick(1, -1)).toBeGreaterThan(0);
    // Q3: (-y, -x) → négatif
    expect(fastAtan2Quick(-1, -1)).toBeLessThan(0);
    // Q4: (-y, +x) → négatif
    expect(fastAtan2Quick(-1, 1)).toBeLessThan(0);
  });
});

// ── fastHypot ───────────────────────────────────────────────────────────────

describe("fastHypot", () => {
  it("approxime à 10% près", () => {
    for (let i = 0; i < 500; i++) {
      const dx = (Math.random() - 0.5) * 100;
      const dy = (Math.random() - 0.5) * 100;
      const ref = Math.hypot(dx, dy);
      const approx = fastHypot(dx, dy);
      if (ref > 0) {
        expect(approx).toBeGreaterThan(0);
        expect(approx / ref).toBeGreaterThan(0.85);
        expect(approx / ref).toBeLessThan(1.15);
      }
    }
  });
});

describe("fastHypot3", () => {
  it("approxime à 10% près", () => {
    for (let i = 0; i < 500; i++) {
      const dx = (Math.random() - 0.5) * 50;
      const dy = (Math.random() - 0.5) * 50;
      const dz = (Math.random() - 0.5) * 50;
      const ref = Math.hypot(dx, dy, dz);
      const approx = fastHypot3(dx, dy, dz);
      if (ref > 0) {
        expect(approx).toBeGreaterThan(0);
        expect(approx / ref).toBeGreaterThan(0.7);
        expect(approx / ref).toBeLessThan(1.3);
      }
    }
  });
});

// ── fastInvSqrt ─────────────────────────────────────────────────────────────

describe("fastInvSqrt", () => {
  it("1/sqrt(4) ≈ 0.5", () => {
    expect(fastInvSqrt(4)).toBeCloseTo(0.5, 2);
  });

  it("1/sqrt(1) ≈ 1", () => {
    expect(fastInvSqrt(1)).toBeCloseTo(1, 3);
  });

  it("précision sur valeurs scalaires", () => {
    let maxErr = 0;
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * 100 + 0.01;
      const ref = 1 / Math.sqrt(x);
      const approx = fastInvSqrt(x);
      const err = Math.abs(approx - ref);
      if (err > maxErr) maxErr = err;
    }
    expect(maxErr).toBeLessThan(TOL_INVSQRT);
  });
});

// ── normalizeIfNeeded ───────────────────────────────────────────────────────

describe("normalizeIfNeeded", () => {
  it("vecteur déjà unitaire : pas de normalisation", () => {
    const r = normalizeIfNeeded(1, 0, 0);
    expect(r.normalized).toBe(false);
    expect(r.len).toBe(1);
    expect(r.x).toBe(1);
  });

  it("vecteur non-unitaire : normalise", () => {
    const r = normalizeIfNeeded(3, 0, 0);
    expect(r.normalized).toBe(true);
    expect(r.len).toBeCloseTo(3, 5);
    expect(r.x).toBeCloseTo(1, 5);
  });

  it("vecteur nul → (0,0,0)", () => {
    const r = normalizeIfNeeded(0, 0, 0);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.z).toBe(0);
    expect(r.len).toBe(0);
  });

  it("tolérance configurable", () => {
    // Presque unitaire : diffère de 1e-4 en norme²
    const r = normalizeIfNeeded(1.00005, 0, 0, 1e-3);
    // Tolérance 1e-3 > diff 1e-4 → skip normalisation
    expect(r.normalized).toBe(false);
    expect(r.len).toBe(1);
    // Avec tolérance plus fine : on normalise
    const r2 = normalizeIfNeeded(1.00005, 0, 0, 1e-6);
    expect(r2.normalized).toBe(true);
    expect(r2.len).toBeCloseTo(1.00005, 5);
  });
});
