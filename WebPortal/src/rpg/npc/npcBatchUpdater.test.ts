import { describe, it, expect, beforeEach } from "vitest";
import { npcBatchUpdater, type BatchConfig } from "./npcBatchUpdater";

describe("npcBatchUpdater", () => {
  beforeEach(() => {
    npcBatchUpdater.clear();
    npcBatchUpdater.setConfig({ batchSize: 30, farInterval: 8, midInterval: 2 });
  });

  it("enregistre et tick un NPC NEAR", () => {
    npcBatchUpdater.register("test_1", 0);

    let tickedId = "";
    npcBatchUpdater.tick(0.016, (id) => { tickedId = id; });

    expect(tickedId).toBe("test_1");
    expect(npcBatchUpdater.stats.tickCount).toBe(1);
  });

  it("tick les NEAR en priorité sur les FAR", () => {
    npcBatchUpdater.register("near_1", 0);
    npcBatchUpdater.register("far_1", 2);

    const ticked: string[] = [];
    for (let i = 0; i < 5; i++) {
      npcBatchUpdater.tick(0.016, (id) => ticked.push(id));
    }

    // NEAR doit avoir été tické plusieurs fois
    const nearCount = ticked.filter((id) => id === "near_1").length;
    expect(nearCount).toBeGreaterThanOrEqual(5); // NEAR ticke chaque frame
  });

  it("FAR NPC tické seulement toutes les farInterval frames", () => {
    npcBatchUpdater.setConfig({ batchSize: 100, farInterval: 4, midInterval: 2 });
    npcBatchUpdater.register("far_1", 2);

    const ticked: string[] = [];
    for (let i = 0; i < 10; i++) {
      npcBatchUpdater.tick(0.016, (id) => ticked.push(id));
    }

    // Sur 10 frames avec farInterval=4 → environ 2-3 ticks
    expect(ticked.length).toBeGreaterThanOrEqual(1);
    expect(ticked.length).toBeLessThanOrEqual(4);
  });

  it("MID NPC tické 1 fois toutes les midInterval frames", () => {
    npcBatchUpdater.setConfig({ batchSize: 100, midInterval: 3, farInterval: 10 });
    npcBatchUpdater.register("mid_1", 1);

    const ticked: string[] = [];
    for (let i = 0; i < 10; i++) {
      npcBatchUpdater.tick(0.016, (id) => ticked.push(id));
    }

    // Avec midInterval=3, sur 10 frames → 3-4 ticks
    expect(ticked.length).toBeGreaterThanOrEqual(2);
    expect(ticked.length).toBeLessThanOrEqual(5);
  });

  it("storeResult et getLastResult fonctionnent", () => {
    npcBatchUpdater.register("npc_1", 0);

    const result = { action: "attack" as const, moving: false, attackFired: true };
    npcBatchUpdater.storeResult("npc_1", result);

    const stored = npcBatchUpdater.getLastResult("npc_1");
    expect(stored).toEqual(result);
  });

  it("updatePriority change la bande", () => {
    npcBatchUpdater.register("mover", 2); // FAR

    npcBatchUpdater.updatePriority("mover", 0); // NEAR

    const ticked: string[] = [];
    npcBatchUpdater.tick(0.016, (id) => ticked.push(id));
    expect(ticked).toContain("mover");
  });

  it("unregister supprime l'entrée", () => {
    npcBatchUpdater.register("temp", 0);
    expect(npcBatchUpdater.stats.registered).toBe(1);

    npcBatchUpdater.unregister("temp");
    expect(npcBatchUpdater.stats.registered).toBe(0);
  });

  it("clear() vide tout", () => {
    npcBatchUpdater.register("a", 0);
    npcBatchUpdater.register("b", 1);
    npcBatchUpdater.register("c", 2);

    npcBatchUpdater.clear();
    expect(npcBatchUpdater.stats.registered).toBe(0);
    expect(npcBatchUpdater.stats.tickCount).toBe(0);
  });

  it("respecte batchSize", () => {
    npcBatchUpdater.setConfig({ batchSize: 2, farInterval: 1, midInterval: 1 });
    npcBatchUpdater.register("a", 0);
    npcBatchUpdater.register("b", 0);
    npcBatchUpdater.register("c", 0);

    const ticked: string[] = [];
    npcBatchUpdater.tick(0.016, (id) => ticked.push(id));

    // batchSize=2 → max 2 tickés
    expect(ticked.length).toBeLessThanOrEqual(2);
  });
});
