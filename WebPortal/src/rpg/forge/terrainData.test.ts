import { describe, it, expect } from "vitest";
import { createTerrain, applyBrush, gridIndex, vertexWorld } from "./terrainData";

describe("terrainData", () => {
  it("createTerrain : grille plate (seg+1)²", () => {
    const t = createTerrain(100, 10);
    expect(t.heights.length).toBe(121);
    expect(t.heights.every((h) => h === 0)).toBe(true);
  });

  it("vertexWorld : plan centré (coin = -size/2, centre = 0)", () => {
    const t = createTerrain(100, 10);
    expect(vertexWorld(t, 0, 0)).toEqual({ x: -50, z: -50 });
    expect(vertexWorld(t, 5, 5)).toEqual({ x: 0, z: 0 });
  });

  it("raise : hausse le sommet central, atténue avec la distance, immutable", () => {
    const t = createTerrain(100, 10);
    const h = applyBrush(t, 0, 0, "raise", 20, 5);
    const center = h[gridIndex(10, 5, 5)];
    const edge = h[gridIndex(10, 7, 5)]; // plus loin
    expect(center).toBeGreaterThan(0);
    expect(center).toBeGreaterThan(edge);
    expect(t.heights[gridIndex(10, 5, 5)]).toBe(0); // original non muté
  });

  it("lower : abaisse (négatif)", () => {
    const t = createTerrain(100, 10);
    const h = applyBrush(t, 0, 0, "lower", 20, 5);
    expect(h[gridIndex(10, 5, 5)]).toBeLessThan(0);
  });

  it("smooth : rapproche un pic isolé de la moyenne (le réduit)", () => {
    const t = createTerrain(100, 10);
    t.heights[gridIndex(10, 5, 5)] = 10; // pic
    const h = applyBrush(t, 0, 0, "smooth", 20, 1);
    expect(h[gridIndex(10, 5, 5)]).toBeLessThan(10);
  });

  it("hors rayon : sommet inchangé", () => {
    const t = createTerrain(100, 10);
    const h = applyBrush(t, 0, 0, "raise", 5, 5);
    expect(h[gridIndex(10, 0, 0)]).toBe(0); // coin loin du centre
  });
});
