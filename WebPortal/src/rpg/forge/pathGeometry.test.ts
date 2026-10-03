import { describe, it, expect } from "vitest";
import { buildRoad } from "./pathGeometry";

const P = (a: number, b: number, c: number): [number, number, number] => [a, b, c];

describe("buildRoad", () => {
  it("< 2 points → vide", () => {
    expect(buildRoad([P(0, 0, 0)], 4).samples).toBe(0);
  });

  it("ruban : 2 sommets par échantillon, 6 indices par segment", () => {
    const r = buildRoad([P(0, 0, 0), P(10, 0, 0)], 4, 10);
    expect(r.positions.length).toBe(r.samples * 2 * 3);
    expect(r.uvs.length).toBe(r.samples * 2 * 2);
    expect(r.indices.length).toBe((r.samples - 1) * 6);
  });

  it("largeur respectée : bords gauche/droit espacés de `width` sur une ligne droite +X", () => {
    const r = buildRoad([P(0, 0, 0), P(20, 0, 0)], 6, 10);
    // 1er échantillon : gauche (z = -3) / droit (z = +3) → écart 6.
    const lz = r.positions[2], rz = r.positions[5];
    expect(Math.abs(rz - lz)).toBeCloseTo(6, 1);
  });

  it("UV : u ∈ {0,1} en travers, v croît le long", () => {
    const r = buildRoad([P(0, 0, 0), P(30, 0, 0)], 8);
    expect(r.uvs[0]).toBe(0);        // u bord gauche
    expect(r.uvs[2]).toBe(1);        // u bord droit
    const vStart = r.uvs[1], vEnd = r.uvs[r.uvs.length - 1];
    expect(vEnd).toBeGreaterThan(vStart);
  });

  it("suit la hauteur des points (y propagé + léger lift)", () => {
    const r = buildRoad([P(0, 2, 0), P(10, 2, 0)], 4);
    expect(r.positions[1]).toBeCloseTo(2.04, 2); // y + lift
  });
});
