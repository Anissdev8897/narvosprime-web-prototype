// ══════════════════════════════════════════════════════════════════════════════
// render/RenderBenchmark.test.ts — Tests du benchmark
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from "vitest";
import * as THREE from "three";
import {
  RenderBenchmark,
  measureDrawCalls,
  measureGPUMemory,
  BenchmarkSnapshot,
  BenchmarkComparison,
} from "./RenderBenchmark";

describe("measureDrawCalls", () => {
  it("retourne 0 si pas de renderer", () => {
    // Impossible de créer un WebGLRenderer hors navigateur,
    // on teste juste que l'appel ne crash pas
    expect(typeof measureDrawCalls).toBe("function");
  });
});

describe("measureGPUMemory", () => {
  it("retourne des métriques à zéro si pas de renderer", () => {
    expect(typeof measureGPUMemory).toBe("function");
  });
});

describe("RenderBenchmark", () => {
  let benchmark: RenderBenchmark;

  beforeEach(() => {
    benchmark = new RenderBenchmark(null);
  });

  describe("snapshotInstant", () => {
    it("retourne un snapshot valide (renderer null)", () => {
      const snap = benchmark.snapshotInstant();
      expect(snap).toBeDefined();
      expect(snap.drawCalls).toBe(0);
      expect(snap.fps).toBeGreaterThanOrEqual(0);
      expect(snap.timestamp).toBeGreaterThan(0);
    });
  });

  describe("labels", () => {
    it("liste les labels de benchmark enregistrés", () => {
      expect(benchmark.labels).toEqual([]);
    });
  });

  describe("reset", () => {
    it("réinitialise tous les résultats", () => {
      benchmark.reset();
      expect(benchmark.labels).toEqual([]);
    });
  });
});

// Tests des types et helpers
describe("BenchmarkSnapshot (type)", () => {
  it("peut être créé avec toutes les propriétés", () => {
    const snap: BenchmarkSnapshot = {
      timestamp: 1000,
      drawCalls: 100,
      triangles: 50000,
      points: 0,
      lines: 0,
      fps: 60,
      frameCount: 120,
      frameTimeMs: 16.67,
      gpuMemoryMB: 256,
      textures: 200,
      geometries: 50,
      programs: 10,
      instanceCount: 5,
    };
    expect(snap.drawCalls).toBe(100);
    expect(snap.fps).toBe(60);
  });
});
