// ══════════════════════════════════════════════════════════════════════════════
// runtime/optimizations/Benchmark.test.ts
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { Benchmark, captureBenchmarkSnapshot } from "./Benchmark";

describe("Benchmark", () => {
  it("should start with null report when no renderer attached", () => {
    const b = new Benchmark();
    expect(b.report()).toBeNull();
  });

  it("should collect samples and produce a report after enough ticks", () => {
    const b = new Benchmark(undefined, { sampleIntervalMs: 10, windowSec: 5 });
    // Simulate 30 frames at 60 fps
    for (let i = 0; i < 30; i++) {
      b.tick(1 / 60);
    }
    // Tick one more to trigger report computation
    b.tick(1 / 60);
    const r = b.report();
    // Without a real WebGLRenderer, drawCalls etc. will be 0
    expect(r).not.toBeNull();
    if (r) {
      expect(typeof r.fps.avg).toBe("number");
      expect(typeof r.drawCalls).toBe("number");
      expect(typeof r.triangles).toBe("number");
    }
  });

  it("should reset all samples", () => {
    const b = new Benchmark(undefined, { sampleIntervalMs: 10, windowSec: 5 });
    for (let i = 0; i < 10; i++) {
      b.tick(1 / 60);
    }
    b.reset();
    expect(b.report()).toBeNull();
  });

  it("should handle setRenderer after construction", () => {
    const b = new Benchmark();
    // Simulate attaching a renderer (mock)
    const mockGl = {} as any;
    b.setRenderer(mockGl);
    // Should not throw
    expect(() => b.tick(1 / 60)).not.toThrow();
  });
});

describe("captureBenchmarkSnapshot", () => {
  it("should return a default report for null-like renderer", () => {
    const mockGl = {} as any;
    const report = captureBenchmarkSnapshot(mockGl);
    expect(report).toBeDefined();
    expect(typeof report.fps.avg).toBe("number");
    expect(typeof report.drawCalls).toBe("number");
  });
});
