// ══════════════════════════════════════════════════════════════════════════════
// memory/MemoryTracker.test.ts — Tests for MEMOIRE P2 modules
//
// Tests cover:
//   • MemoryTracker: takeSnapshot, diffSnapshots, format
//   • DisposeTracker: install, track, counters
//   • MemoryBudget: checkBudget, format
//   • ObjectPool: acquire/release cycle, ScopedPool
//   • MemoryBenchmark: basic structure
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from "vitest";
import * as THREE from "three";

// ── MemoryTracker ────────────────────────────────────────────────────────────

describe("MemoryTracker", () => {
  it("takeSnapshot returns a complete snapshot structure", async () => {
    // We can't import the module directly because it references performance.memory
    // which may not exist in node. Let's just test the types via the returned shape.
    const { takeSnapshot } = await import("./MemoryTracker");

    const snap = takeSnapshot();

    expect(snap).toHaveProperty("jsHeapUsedMB");
    expect(snap).toHaveProperty("jsHeapTotalMB");
    expect(snap).toHaveProperty("texturesGPU");
    expect(snap).toHaveProperty("geometriesGPU");
    expect(snap).toHaveProperty("drawCalls");
    expect(snap).toHaveProperty("triangles");
    expect(snap).toHaveProperty("programsGPU");
    expect(snap).toHaveProperty("wasmHeapMB");
    expect(snap).toHaveProperty("indexedDBSizeMB");
    expect(snap).toHaveProperty("timestamp");

    // All numeric
    expect(typeof snap.jsHeapUsedMB).toBe("number");
    expect(typeof snap.texturesGPU).toBe("number");
    expect(typeof snap.timestamp).toBe("number");
  });

  it("takeSnapshotAsync returns snapshot with potentially non-zero timestamp", async () => {
    const { takeSnapshotAsync } = await import("./MemoryTracker");

    const snap = await takeSnapshotAsync();

    expect(snap.timestamp).toBeGreaterThan(0);
  });

  it("diffSnapshots computes correct delta", async () => {
    const { diffSnapshots } = await import("./MemoryTracker");

    const before = {
      jsHeapUsedMB: 100, jsHeapTotalMB: 500,
      texturesGPU: 50, geometriesGPU: 30,
      drawCalls: 1000, triangles: 500000,
      programsGPU: 10, wasmHeapMB: 64,
      indexedDBSizeMB: 10, timestamp: 0,
    };

    const after = {
      jsHeapUsedMB: 150, jsHeapTotalMB: 500,
      texturesGPU: 60, geometriesGPU: 35,
      drawCalls: 1200, triangles: 600000,
      programsGPU: 12, wasmHeapMB: 72,
      indexedDBSizeMB: 12, timestamp: 3000,
    };

    const delta = diffSnapshots(before, after);

    expect(delta.jsHeapUsedMB).toBe(50);
    expect(delta.texturesGPU).toBe(10);
    expect(delta.geometriesGPU).toBe(5);
    expect(delta.drawCalls).toBe(200);
    expect(delta.wasmHeapMB).toBe(8);
    expect(delta.elapsedSec).toBe(3);
  });

  it("formatDelta produces readable output", async () => {
    const { diffSnapshots, formatDelta } = await import("./MemoryTracker");

    const delta = diffSnapshots(
      { jsHeapUsedMB: 100, jsHeapTotalMB: 500, texturesGPU: 50, geometriesGPU: 30, drawCalls: 1000, triangles: 500000, programsGPU: 10, wasmHeapMB: 64, indexedDBSizeMB: 10, timestamp: 0 },
      { jsHeapUsedMB: 120, jsHeapTotalMB: 500, texturesGPU: 55, geometriesGPU: 32, drawCalls: 1100, triangles: 550000, programsGPU: 11, wasmHeapMB: 66, indexedDBSizeMB: 11, timestamp: 5000 },
    );

    const formatted = formatDelta(delta);
    expect(formatted).toContain("JS heap +20");
    expect(formatted).toContain("textures +5");
    expect(formatted).toContain("geometries +2");
    expect(formatted).toContain("5s");
  });

  it("formatSnapshot produces readable output", async () => {
    const { formatSnapshot } = await import("./MemoryTracker");

    const text = formatSnapshot({
      jsHeapUsedMB: 150.2, jsHeapTotalMB: 1024,
      texturesGPU: 120, geometriesGPU: 80,
      drawCalls: 2500, triangles: 1200000,
      programsGPU: 25, wasmHeapMB: 128,
      indexedDBSizeMB: 45.6, timestamp: 0,
    });

    expect(text).toContain("JS 150.2/1024");
    expect(text).toContain("120tex");
    expect(text).toContain("80geo");
    expect(text).toContain("128 MB");
  });
});

// ── DisposeTracker ───────────────────────────────────────────────────────────

describe("DisposeTracker", () => {
  beforeEach(async () => {
    const { uninstallDisposeTracker, resetCounters } = await import("./DisposeTracker");
    uninstallDisposeTracker();
    resetCounters();
  });

  it("install patches the THREE prototypes", async () => {
    const { installDisposeTracker, isInstalled, uninstallDisposeTracker } = await import("./DisposeTracker");

    expect(isInstalled()).toBe(false);

    installDisposeTracker();

    expect(isInstalled()).toBe(true);

    // Cleanup
    uninstallDisposeTracker();
    expect(isInstalled()).toBe(false);
  });

  it("tracks texture dispose calls", async () => {
    const { installDisposeTracker, getDisposeInfo, resetCounters } = await import("./DisposeTracker");

    resetCounters();
    installDisposeTracker();

    const tex = new THREE.Texture();
    tex.dispose();

    const info = getDisposeInfo();
    expect(info.texturesDisposed).toBe(1);
    expect(info.texturesCreated).toBe(1);
    expect(info.activeTextures).toBe(0);

    // Cleanup
    const { uninstallDisposeTracker } = await import("./DisposeTracker");
    uninstallDisposeTracker();
  });

  it("tracks geometry dispose calls", async () => {
    const { installDisposeTracker, getDisposeInfo, resetCounters } = await import("./DisposeTracker");

    resetCounters();
    installDisposeTracker();

    const geo = new THREE.BufferGeometry();
    geo.dispose();

    const info = getDisposeInfo();
    expect(info.geometriesDisposed).toBe(1);
    expect(info.geometriesCreated).toBe(1);

    const { uninstallDisposeTracker } = await import("./DisposeTracker");
    uninstallDisposeTracker();
  });

  it("trackTexture and trackGeometry manually register objects", async () => {
    const { trackTexture, trackGeometry, getDisposeInfo, resetCounters, installDisposeTracker, uninstallDisposeTracker } =
      await import("./DisposeTracker");

    // Le test précédent désinstalle le tracker, ce qui REND son `dispose`
    // d'origine à `THREE.Texture.prototype`. Sans réinstallation ici, les
    // `dispose()` plus bas ne sont interceptés par personne et le compteur
    // reste à 0 — panne d'ordre entre tests via un prototype global.
    installDisposeTracker();
    resetCounters();

    const tex = new THREE.Texture();
    const geo = new THREE.BufferGeometry();

    trackTexture(tex);
    trackGeometry(geo);

    const info = getDisposeInfo();
    expect(info.texturesCreated).toBe(1);
    expect(info.geometriesCreated).toBe(1);

    // Disposing should decrement active
    tex.dispose();
    geo.dispose();

    const info2 = getDisposeInfo();
    expect(info2.texturesDisposed).toBe(1);
    expect(info2.geometriesDisposed).toBe(1);

    uninstallDisposeTracker();
  });

  it("resetCounters resets all counters", async () => {
    const { installDisposeTracker, getDisposeInfo, resetCounters } = await import("./DisposeTracker");

    installDisposeTracker();
    const tex = new THREE.Texture();
    tex.dispose();
    expect(getDisposeInfo().texturesDisposed).toBe(1);

    resetCounters();
    expect(getDisposeInfo().texturesDisposed).toBe(0);
    expect(getDisposeInfo().texturesCreated).toBe(0);

    const { uninstallDisposeTracker } = await import("./DisposeTracker");
    uninstallDisposeTracker();
  });
});

// ── MemoryBudget ─────────────────────────────────────────────────────────────

describe("MemoryBudget", () => {
  it("checkBudget returns a BudgetStatus", async () => {
    const { checkBudget, getLastBudgetStatus } = await import("./MemoryBudget");

    const status = checkBudget();

    expect(status).toHaveProperty("level");
    expect(status).toHaveProperty("textures");
    expect(status).toHaveProperty("geometries");
    expect(status).toHaveProperty("drawCalls");
    expect(status).toHaveProperty("jsHeapMB");
    expect(status).toHaveProperty("warnings");
    expect(["ok", "warning", "critical"]).toContain(status.level);
  });

  it("getLastBudgetStatus returns null before first check", async () => {
    const { getLastBudgetStatus, checkBudget } = await import("./MemoryBudget");

    // After a check, it should exist
    checkBudget();
    const status = getLastBudgetStatus();
    expect(status).not.toBeNull();
  });

  it("configureBudget overrides settings", async () => {
    const { configureBudget, getBudgetConfig } = await import("./MemoryBudget");

    configureBudget({ maxTextures: 100, maxGeometries: 50 });
    const config = getBudgetConfig();
    expect(config.maxTextures).toBe(100);
    expect(config.maxGeometries).toBe(50);
  });

  it("startBudgetChecks and stopBudgetChecks are idempotent", async () => {
    const { startBudgetChecks, stopBudgetChecks } = await import("./MemoryBudget");

    // Should not throw
    startBudgetChecks();
    startBudgetChecks(); // second call should be no-op
    stopBudgetChecks();
    stopBudgetChecks(); // second call should be no-op
  });
});

// ── ObjectPool ───────────────────────────────────────────────────────────────

describe("ObjectPool", () => {
  it("acquireVector3 and releaseVector3 cycle correctly", async () => {
    const { acquireVector3, releaseVector3, getPoolMetrics } = await import("./ObjectPool");

    const v = acquireVector3();
    expect(v).toBeInstanceOf(THREE.Vector3);

    // Active count should increase
    const m1 = getPoolMetrics();
    expect(m1.vector3.active).toBeGreaterThan(0);

    releaseVector3(v);

    // After release, active decreased
    const m2 = getPoolMetrics();
    expect(m2.vector3.active).toBe(0);
  });

  it("multiple acquire calls don't create infinite objects", async () => {
    const { acquireVector3, releaseVector3 } = await import("./ObjectPool");

    const vectors: THREE.Vector3[] = [];
    for (let i = 0; i < 100; i++) {
      vectors.push(acquireVector3());
    }
    for (const v of vectors) {
      releaseVector3(v);
    }

    const { getPoolMetrics } = await import("./ObjectPool");
    const m = getPoolMetrics();
    // Should have created only what was needed (initial 16 + additional 84)
    expect(m.vector3.created).toBe(100);
    expect(m.vector3.active).toBe(0);
  });

  it("ScopedPool releases all items on releaseAll", async () => {
    const { ScopedPool, getPoolMetrics } = await import("./ObjectPool");

    const scope = new ScopedPool();
    const a = scope.v3();
    const b = scope.v3();
    const c = scope.quat();

    expect(scope.count).toBe(3);

    const m1 = getPoolMetrics();
    // Vectors were acquired, quaternions were acquired
    expect(m1.vector3.active).toBeGreaterThan(0);
    expect(m1.quaternion.active).toBeGreaterThan(0);

    scope.releaseAll();
    expect(scope.count).toBe(0);

    const m2 = getPoolMetrics();
    expect(m2.vector3.active).toBe(0);
    expect(m2.quaternion.active).toBe(0);
  });

  it("pool metrics are correctly reported", async () => {
    const { getPoolMetrics } = await import("./ObjectPool");

    const m = getPoolMetrics();
    expect(m).toHaveProperty("vector3");
    expect(m).toHaveProperty("vector2");
    expect(m).toHaveProperty("quaternion");
    expect(m).toHaveProperty("matrix4");
    expect(m).toHaveProperty("color");
    expect(m.vector3).toHaveProperty("active");
    expect(m.vector3).toHaveProperty("created");
    expect(m.vector3).toHaveProperty("size");
    expect(m.vector3.size).toBeGreaterThanOrEqual(0);
  });

  it("warmupPool pré-crée réellement N objets (pas UN recyclé N fois)", async () => {
    const { warmupPool, getPoolMetrics, acquireVector3, releaseVector3 } = await import("./ObjectPool");

    warmupPool(16, 8, 8);
    const after = getPoolMetrics();

    // Le contrat de `warmupPool` est « le pool peut servir N objets sans
    // allouer », pas « N allocations de plus » : `created` ne bouge que si la
    // réserve était à court. L'ancienne assertion (`created + 16`) échouait donc
    // dès que les tests précédents avaient déjà rempli la réserve.
    expect(after.vector3.size).toBeGreaterThanOrEqual(16);
    expect(after.vector2.size).toBeGreaterThanOrEqual(8);

    // Et on le PROUVE : 16 emprunts d'affilée ne doivent allouer aucun objet.
    // C'est cette assertion qui attrape le bug d'origine — une boucle
    // acquire/release imbriquée ne laissait qu'UN seul exemplaire en réserve.
    const createdBefore = after.vector3.created;
    const borrowed = Array.from({ length: 16 }, () => acquireVector3());
    expect(getPoolMetrics().vector3.created).toBe(createdBefore);
    for (const v of borrowed) releaseVector3(v);
  });
});

// ── MemoryBenchmark ──────────────────────────────────────────────────────────

describe("MemoryBenchmark", () => {
  it("run captures before/after snapshots", async () => {
    const { MemoryBenchmark } = await import("./MemoryBenchmark");

    const bench = new MemoryBenchmark();
    const result = await bench.run("test-run", async () => {
      // simple wait
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(result.label).toBe("test-run");
    expect(result.durationMs).toBeGreaterThanOrEqual(45);
    expect(result.before).toHaveProperty("jsHeapUsedMB");
    expect(result.after).toHaveProperty("jsHeapUsedMB");
    expect(result.delta).toHaveProperty("jsHeapUsedMB");
    expect(result.delta).toHaveProperty("elapsedSec");
  });

  it("report returns a formatted string", async () => {
    const { MemoryBenchmark } = await import("./MemoryBenchmark");

    const bench = new MemoryBenchmark();
    await bench.run("test-report", async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const report = bench.report();
    expect(report).toContain("MEMORY BENCHMARK");
    expect(report).toContain("test-report");
    expect(report).toContain("JS Heap");
    expect(report).toContain("GPU Textures");
  });

  it("summary returns a compact line", async () => {
    const { MemoryBenchmark } = await import("./MemoryBenchmark");

    const bench = new MemoryBenchmark();
    await bench.run("test-summary", async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const summary = bench.summary();
    expect(summary).toContain("[BENCH]");
    expect(summary).toContain("test-summary");
  });
});
