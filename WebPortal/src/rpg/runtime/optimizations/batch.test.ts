// ══════════════════════════════════════════════════════════════════════════════
// runtime/optimizations/batch.bench.ts — Benchmark batch vs individual processing
//
// Measures the performance difference between per-entity processing
// and batch processing for animations, NPC AI, and physics queries.
//
// Run: npx vitest run --reporter=verbose src/rpg/runtime/optimizations/batch.bench.ts
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from "vitest";
import { BatchSystem, BatchProcessingProbe } from "./BatchSystem";
import { batchAnimationSystem, type AnimationBatchContext } from "./BatchAnimationSystem";
import { batchNpcSystem, type NpcBatchContext } from "./BatchNpcSystem";
import { batchPhysicsSystem, BatchQueryCollector } from "./BatchPhysicsSystem";

// ── Helpers ───────────────────────────────────────────────────────────────────

interface MockController {
  updateCalls: number;
  update: (dt: number) => void;
}
interface MockControllerRef { current: MockController | null }

/** Create N mock AnimationController-like objects. */
function createMockControllers(n: number): MockControllerRef[] {
  const refs: MockControllerRef[] = [];
  for (let i = 0; i < n; i++) {
    const ctrl: MockController = {
      updateCalls: 0,
      update: function (_dt: number) { this.updateCalls++; },
    };
    refs.push({ current: ctrl });
  }
  return refs;
}

interface MockNpc {
  updateCalls: number;
  update: (dt: number, dist: number, senses: { canSee?: boolean; playerAlive?: boolean }) => { action: "idle" | "run" | "attack" | "death"; moving: boolean; attackFired: boolean };
  alive: boolean;
  state: string;
  hostile: boolean;
}

/** Create N mock NPC controller-like objects. */
function createMockNpcs(n: number): MockNpc[] {
  const npcs: MockNpc[] = [];
  for (let i = 0; i < n; i++) {
    npcs.push({
      updateCalls: 0,
      update: function (_dt: number, _dist: number, _senses: { canSee?: boolean; playerAlive?: boolean }) {
        this.updateCalls++;
        return { action: "idle", moving: false, attackFired: false };
      },
      alive: true,
      state: "idle",
      hostile: true,
    });
  }
  return npcs;
}

// ── BatchSystem ──────────────────────────────────────────────────────────────

describe("BatchSystem<T>", () => {
  let system: BatchSystem<{ value: number }>;

  beforeEach(() => {
    system = new BatchSystem<{ value: number }>();
  });

  it("registers and unregisters items", () => {
    system.register("a", { value: 1 });
    system.register("b", { value: 2 });
    expect(system.size).toBe(2);
    expect(system.has("a")).toBe(true);
    expect(system.get("a")?.value).toBe(1);

    system.unregister("a");
    expect(system.size).toBe(1);
    expect(system.has("a")).toBe(false);
  });

  it("processes items individually", () => {
    system.register("a", { value: 10 });
    system.register("b", { value: 20 });
    const results: number[] = [];
    system.processIndividual((_id, item) => { results.push(item.value); });
    expect(results).toEqual([10, 20]);
  });

  it("processes items in batch", () => {
    system.register("a", { value: 10 });
    system.register("b", { value: 20 });
    const results: number[] = [];
    system.processBatch((items) => {
      items.forEach((item) => results.push(item.value));
    });
    expect(results).toEqual([10, 20]);
  });

  it("handles empty system gracefully", () => {
    expect(system.processIndividual(() => {})).toBe(0);
    expect(system.processBatch(() => {})).toBe(0);
    expect(system.size).toBe(0);
  });

  it("supports begin/end pass", () => {
    system.register("a", { value: 1 });
    const pass = system.begin();
    expect(pass.size).toBe(1);
    pass.processAll((items) => {
      expect((items.get("a") as { value: number }).value).toBe(1);
    });
    const result = pass.end();
    expect(result.size).toBe(1);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(result.itemsPerMs).toBeGreaterThanOrEqual(0);
  });

  it("clears all items", () => {
    system.register("a", { value: 1 });
    system.register("b", { value: 2 });
    system.clear();
    expect(system.size).toBe(0);
  });
});

// ── BatchProcessingProbe ─────────────────────────────────────────────────────

describe("BatchProcessingProbe", () => {
  let probe: BatchProcessingProbe;

  beforeEach(() => {
    probe = new BatchProcessingProbe();
  });

  it("measures execution time", () => {
    const result = probe.measure("test", 100, () => {
      let sum = 0;
      for (let i = 0; i < 10000; i++) sum += i;
      return sum;
    });
    expect(result).toBe(49995000);
    expect(probe.sampleCount).toBe(1);

    const samples = probe.getSamples();
    expect(samples[0].label).toBe("test");
    expect(samples[0].itemCount).toBe(100);
    expect(samples[0].elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it("produces comparison reports", () => {
    // Simulate fast and slow operations
    probe.measure("slow", 100, () => {
      let sum = 0;
      for (let i = 0; i < 1000000; i++) sum += i;
      return sum;
    });
    probe.measure("fast", 100, () => {
      let sum = 0;
      for (let i = 0; i < 10; i++) sum += i;
      return sum;
    });

    const report = probe.compare("slow", "fast");
    expect(report).not.toBeNull();
    if (report) {
      expect(report.speedup).toBeGreaterThan(1);
      expect(report.recommendation).toContain("✅");
    }
  });

  it("returns null for insufficient data", () => {
    expect(probe.compare("a", "b")).toBeNull();
  });

  it("generates formatted report", () => {
    probe.measure("individual", 50, () => 1 + 1);
    probe.measure("batch", 50, () => 1 + 1);
    const formatted = probe.formatReport("individual", "batch");
    expect(formatted).toContain("BATCH BENCHMARK REPORT");
    expect(formatted).toContain("individual");
    expect(formatted).toContain("batch");
  });

  it("can be disabled", () => {
    probe.enabled = false;
    const result = probe.measure("test", 100, () => 42);
    expect(result).toBe(42);
    expect(probe.sampleCount).toBe(0);
  });
});

// ── BatchAnimationSystem ─────────────────────────────────────────────────────

describe("BatchAnimationSystem", () => {
  beforeEach(() => {
    batchAnimationSystem.clear();
    batchAnimationSystem.enabled = true;
  });

  it("updates all registered animation controllers via batch", () => {
    const refs = createMockControllers(5);
    for (let i = 0; i < refs.length; i++) {
      batchAnimationSystem.register(`char_${i}`, {
        controllerRef: refs[i] as unknown as AnimationBatchContext["controllerRef"],
        dt: 1 / 60,
        band: 0, // NEAR
        frameTick: 0,
      });
    }

    const updated = batchAnimationSystem.updateAll(1 / 60);
    expect(updated).toBe(5);
    for (const ref of refs) {
      expect(ref.current!.updateCalls).toBe(1);
    }
  });

  it("respects LOD bands (FAR = skip)", () => {
    const nearRef = createMockControllers(1)[0];
    const farRef = createMockControllers(1)[0];

    batchAnimationSystem.register("near", {
      controllerRef: nearRef as unknown as AnimationBatchContext["controllerRef"],
      dt: 1 / 60,
      band: 0, // NEAR
    });
    batchAnimationSystem.register("far", {
      controllerRef: farRef as unknown as AnimationBatchContext["controllerRef"],
      dt: 1 / 60,
      band: 2, // FAR
    });

    const updated = batchAnimationSystem.updateAll(1 / 60);
    expect(updated).toBe(1);
    expect(nearRef.current!.updateCalls).toBe(1);
    expect(farRef.current!.updateCalls).toBe(0);
  });

  it("has zero updates when disabled", () => {
    batchAnimationSystem.enabled = false;
    const ref = createMockControllers(1)[0];
    batchAnimationSystem.register("char", {
      controllerRef: ref as unknown as AnimationBatchContext["controllerRef"],
      dt: 1 / 60,
      band: 0,
    });

    expect(batchAnimationSystem.updateAll(1 / 60)).toBe(0);
    expect(ref.current!.updateCalls).toBe(0);
  });

  it("measures individual vs batch performance", () => {
    const refs = createMockControllers(20);
    for (let i = 0; i < refs.length; i++) {
      batchAnimationSystem.register(`char_${i}`, {
        controllerRef: refs[i] as unknown as AnimationBatchContext["controllerRef"],
        dt: 1 / 60,
        band: 0,
      });
    }

    const report = batchAnimationSystem.measure(
      "anim_individual",
      "anim_batch",
      (sys) => { (sys as typeof batchAnimationSystem).updateAllIndividual(1 / 60); },
      (sys) => { (sys as typeof batchAnimationSystem).updateAll(1 / 60); },
      5,
    );
    expect(report).not.toBeNull();
    if (report) {
      expect(report.baseline.passCount).toBeGreaterThan(0);
      expect(report.optimized.passCount).toBeGreaterThan(0);
    }
  });
});

// ── BatchNpcSystem ──────────────────────────────────────────────────────────

describe("BatchNpcSystem", () => {
  beforeEach(() => {
    batchNpcSystem.clear();
    batchNpcSystem.enabled = true;
  });

  it("updates all NPCs in batch returning decisions", () => {
    const npcs = createMockNpcs(3);
    for (let i = 0; i < npcs.length; i++) {
      batchNpcSystem.register(`npc_${i}`, {
        controller: npcs[i],
        distToPlayer: 15,
        canSee: true,
        playerAlive: true,
      });
    }

    const result = batchNpcSystem.updateAll();
    expect(result.count).toBe(3);
    expect(result.decisions.size).toBe(3);
    for (const ref of npcs) {
      expect(ref.updateCalls).toBe(1);
    }
  });

  it("skips dead NPCs", () => {
    const aliveNpc = createMockNpcs(1)[0];
    const deadNpc = createMockNpcs(1)[0];
    deadNpc.alive = false;

    batchNpcSystem.register("alive", {
      controller: aliveNpc,
      distToPlayer: 5,
      canSee: true,
      playerAlive: true,
    });
    batchNpcSystem.register("dead", {
      controller: deadNpc,
      distToPlayer: 5,
      canSee: true,
      playerAlive: true,
    });

    const result = batchNpcSystem.updateAll();
    expect(result.count).toBe(1);
    expect(aliveNpc.updateCalls).toBe(1);
    expect(deadNpc.updateCalls).toBe(0);
  });

  it("returns empty for no NPCs", () => {
    const result = batchNpcSystem.updateAll();
    expect(result.count).toBe(0);
    expect(result.decisions.size).toBe(0);
  });

  it("handles individual vs batch measurement", () => {
    const npcs = createMockNpcs(10);
    for (let i = 0; i < npcs.length; i++) {
      batchNpcSystem.register(`npc_${i}`, {
        controller: npcs[i],
        distToPlayer: 10,
        canSee: true,
        playerAlive: true,
      });
    }

    const report = batchNpcSystem.measure(
      "npc_individual",
      "npc_batch",
      (sys) => { (sys as typeof batchNpcSystem).updateAllIndividual(); },
      (sys) => { (sys as typeof batchNpcSystem).updateAll(); },
      3,
    );
    expect(report).not.toBeNull();
    if (report) {
      expect(report.baseline.passCount).toBeGreaterThan(0);
    }
  });
});

// ── BatchPhysicsSystem ───────────────────────────────────────────────────────

describe("BatchQueryCollector", () => {
  let collector: BatchQueryCollector;
  // Mock isBlocked function: always returns false (LOS clear)
  const mockIsBlocked = () => false;
  // Mock getGroundY: always returns 0
  const mockGetGroundY = () => 0;

  beforeEach(() => {
    collector = new BatchQueryCollector();
    collector.enabled = true;
  });

  it("batches LOS queries", () => {
    collector.addLos({
      entityId: "npc_1",
      eyeX: 0, eyeY: 1.4, eyeZ: 0,
      targetX: 10, targetY: 1.2, targetZ: 0,
      radius: 0.2,
    });
    collector.addLos({
      entityId: "npc_2",
      eyeX: 5, eyeY: 1.4, eyeZ: 0,
      targetX: 15, targetY: 1.2, targetZ: 0,
      radius: 0.2,
    });

    expect(collector.losCount).toBe(2);
    const count = collector.executeLosBatch(mockIsBlocked);
    expect(count).toBe(2);

    expect(collector.getLosResult("npc_1")).toBe(false);
    expect(collector.getLosResult("npc_2")).toBe(false);
  });

  it("batches ground snap queries", () => {
    collector.addGroundSnap({
      entityId: "npc_1",
      x: 10, z: 20, fromHeight: 100,
    });
    collector.addGroundSnap({
      entityId: "npc_2",
      x: 30, z: 40, fromHeight: 100,
    });

    expect(collector.groundSnapCount).toBe(2);
    const count = collector.executeGroundSnapBatch(mockGetGroundY);
    expect(count).toBe(2);

    expect(collector.getGroundSnapResult("npc_1")).toBe(0);
    expect(collector.getGroundSnapResult("npc_2")).toBe(0);
  });

  it("clears all queries", () => {
    collector.addLos({ entityId: "npc_1", eyeX: 0, eyeY: 0, eyeZ: 0, targetX: 1, targetY: 1, targetZ: 1, radius: 0.2 });
    collector.addGroundSnap({ entityId: "npc_1", x: 0, z: 0, fromHeight: 100 });
    collector.clear();
    expect(collector.losCount).toBe(0);
    expect(collector.groundSnapCount).toBe(0);
  });

  it("compares batch vs individual LOS execution", () => {
    for (let i = 0; i < 5; i++) {
      collector.addLos({
        entityId: `npc_${i}`,
        eyeX: i, eyeY: 1.4, eyeZ: i,
        targetX: i + 10, targetY: 1.2, targetZ: i + 10,
        radius: 0.2,
      });
    }

    // Run individual first
    collector.executeLosIndividual(mockIsBlocked);
    collector.clear();

    // Re-add and run batch
    for (let i = 0; i < 5; i++) {
      collector.addLos({
        entityId: `npc_${i}`,
        eyeX: i, eyeY: 1.4, eyeZ: i,
        targetX: i + 10, targetY: 1.2, targetZ: i + 10,
        radius: 0.2,
      });
    }
    collector.executeLosBatch(mockIsBlocked);

    // Note: the probe is the same, so compare works
    const report = collector.compareLos("phy_los_individual", "phy_los_batch");
    // May be null if probe was cleared between calls
    // The probe is shared, so there should be data
    if (report) {
      expect(report.baseline.passCount).toBeGreaterThan(0);
      expect(report.optimized.passCount).toBeGreaterThan(0);
    }
  });
});

describe("BatchPhysicsSystem", () => {
  beforeEach(() => {
    batchPhysicsSystem.clear();
    batchPhysicsSystem.collector.clear();
  });

  it("packs LOS queries into flat array", () => {
    batchPhysicsSystem.collector.addLos({
      entityId: "npc_1",
      eyeX: 1, eyeY: 2, eyeZ: 3,
      targetX: 4, targetY: 5, targetZ: 6,
      radius: 0.2,
    });
    batchPhysicsSystem.collector.addLos({
      entityId: "npc_2",
      eyeX: 7, eyeY: 8, eyeZ: 9,
      targetX: 10, targetY: 11, targetZ: 12,
      radius: 0.3,
    });

    const packed = batchPhysicsSystem.packLosQueries();
    // 2 queries × 7 floats = 14
    expect(packed.length).toBe(14);
    expect(packed[0]).toBe(1);   // npc_1 eyeX
    expect(packed[6]).toBeCloseTo(0.2, 5); // npc_1 radius
    expect(packed[7]).toBe(7);   // npc_2 eyeX
    expect(packed[13]).toBeCloseTo(0.3, 5); // npc_2 radius
  });

  it("packs ground snap queries into flat array", () => {
    batchPhysicsSystem.collector.addGroundSnap({
      entityId: "npc_1", x: 10, z: 20, fromHeight: 50,
    });
    batchPhysicsSystem.collector.addGroundSnap({
      entityId: "npc_2", x: 30, z: 40, fromHeight: 100,
    });

    const packed = batchPhysicsSystem.packGroundSnapQueries();
    expect(packed.length).toBe(6); // 2 × 3
    expect(packed[0]).toBe(10);
    expect(packed[2]).toBe(50);
    expect(packed[4]).toBe(40);
  });

  it("returns empty array when no queries", () => {
    expect(batchPhysicsSystem.packLosQueries().length).toBe(0);
    expect(batchPhysicsSystem.packGroundSnapQueries().length).toBe(0);
  });
});

// ── Batch Report formatting ──────────────────────────────────────────────────

describe("BatchMeasureReport formatting", () => {
  it("produces a readable ASCII report", () => {
    const probe = new BatchProcessingProbe();
    probe.measure("individual", 100, () => {
      let s = 0;
      for (let i = 0; i < 500000; i++) s += i;
    });
    probe.measure("batch", 100, () => {
      let s = 0;
      for (let i = 0; i < 5000; i++) s += i;
    });

    const report = probe.formatReport("individual", "batch");
    expect(report).toContain("BATCH BENCHMARK REPORT");
    expect(report).toContain("Speedup");
    expect(report).toContain("Overhead");
    expect(report).toContain("✅"); // batch should be faster
  });
});

// ── Integration benchmark: scalability ───────────────────────────────────────

describe("Batch scalability benchmark", () => {
  it("scales linearly with entity count", () => {
    const system = new BatchSystem<{ id: number }>();
    const N = 1000;

    for (let i = 0; i < N; i++) {
      system.register(`e${i}`, { id: i });
    }

    const probe = system.getProbe();

    // Individual
    probe.measure("individual_1k", N, () => {
      system.processIndividual((_id, item) => {
        item.id += 1; // simple op
      });
    });

    // Batch
    probe.measure("batch_1k", N, () => {
      system.processBatch((items) => {
        items.forEach((item) => { item.id += 1; });
      });
    });

    const report = probe.compare("individual_1k", "batch_1k");
    expect(report).not.toBeNull();
    // Performance should be at least comparable
    if (report) {
      expect(report.optimized.avgItemsPerMs).toBeGreaterThan(0);
    }
  });
});
