import { describe, it, expect, beforeEach } from "vitest";
import { npcBenchmark } from "./npcBenchmark";
import { npcEntityPool } from "./npcEntityPool";
import { npcBatchUpdater } from "./npcBatchUpdater";
import { npcSleepManager } from "./npcSleepManager";
import type { NpcConfig } from "./NpcController";

const BASE_CFG: NpcConfig = {
  maxHp: 100, moveSpeed: 3.2, aggroRange: 20,
  attackRange: 10, attackCooldown: 1.5, attackDamage: 10, hostile: true,
};

describe("npcBenchmark", () => {
  beforeEach(() => {
    npcEntityPool.releaseAll();
    npcBatchUpdater.clear();
    npcSleepManager.clear();
    npcBenchmark.enable();
  });

  it("sample() retourne des stats sans planter", () => {
    const sample = npcBenchmark.sample();
    expect(sample).toBeDefined();
    expect(sample.timestamp).toBeGreaterThan(0);
    expect(sample.totalRegistered).toBe(0);
    expect(sample.poolActive).toBe(0);
  });

  it("sample() reflète l'état du pool", () => {
    npcEntityPool.acquire("n1", BASE_CFG, [0, 0, 0]);
    npcEntityPool.acquire("n2", BASE_CFG, [10, 0, 10]);

    const sample = npcBenchmark.sample();
    expect(sample.poolActive).toBe(2);
    expect(sample.poolSize).toBeGreaterThanOrEqual(2);
  });

  it("sample() capture la répartition LOD", () => {
    const s1 = npcEntityPool.acquire("near", BASE_CFG, [0, 0, 0]);
    s1.lastBand = 0;
    const s2 = npcEntityPool.acquire("far", BASE_CFG, [100, 0, 100]);
    s2.lastBand = 2;

    const sample = npcBenchmark.sample();
    expect(sample.byBand.near).toBe(1);
    expect(sample.byBand.far).toBe(1);
  });

  it("sample() capture les stats de sommeil", () => {
    npcSleepManager.register("a", 0);
    npcSleepManager.update("a", 2); // endormi

    const sample = npcBenchmark.sample();
    expect(sample.sleepStats.asleep).toBeGreaterThanOrEqual(1);
  });

  it("report() génère un texte formaté", () => {
    // Ajoute quelques données
    npcEntityPool.acquire("test", BASE_CFG, [0, 0, 0]);
    npcBenchmark.recordTickTime(0.05);
    npcBenchmark.recordTickTime(0.07);

    const report = npcBenchmark.report();
    expect(report).toContain("NPC BENCHMARK");
    expect(report).toContain("Population");
    expect(report).toContain("avg tick");
    expect(report).toContain("Mémoire");
  });

  it("enable/disable fonctionne", () => {
    expect(npcBenchmark.enabled).toBe(true);
    npcBenchmark.disable();
    expect(npcBenchmark.enabled).toBe(false);
    npcBenchmark.enable();
    expect(npcBenchmark.enabled).toBe(true);
  });

  it("estimatedMaxNpcFor30Fps est raisonnable", () => {
    npcBenchmark.recordTickTime(0.05); // 0.05 ms par NPC
    const sample = npcBenchmark.sample();
    // Avec 8.67 ms dispo pour les NPC et 0.05 ms/NPC → ~173 NPC max
    expect(sample.estimatedMaxNpcFor30Fps).toBeGreaterThan(50);
  });
});
