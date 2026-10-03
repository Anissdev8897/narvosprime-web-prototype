import { describe, it, expect, beforeEach } from "vitest";
import { npcEntityPool } from "./npcEntityPool";
import type { NpcConfig } from "./NpcController";

const BASE_CFG: NpcConfig = {
  maxHp: 100, moveSpeed: 3.2, aggroRange: 20,
  attackRange: 10, attackCooldown: 1.5, attackDamage: 10, hostile: true,
};

describe("npcEntityPool", () => {
  beforeEach(() => {
    // Reset interne via releaseAll
    npcEntityPool.releaseAll();
  });

  it("acquiert et libère un slot", () => {
    const slot = npcEntityPool.acquire("test_1", BASE_CFG, [0, 0, 0]);
    expect(slot.active).toBe(true);
    expect(slot.id).toBe("test_1");
    expect(slot.controller).toBeDefined();
    expect(slot.controller.maxHp).toBe(100);

    const released = npcEntityPool.release("test_1");
    expect(released).toBe(true);
    expect(npcEntityPool.activeCount).toBe(0);
  });

  it("réutilise les slots libérés (free-list)", () => {
    const s1 = npcEntityPool.acquire("a", BASE_CFG, [0, 0, 0]);
    const s2 = npcEntityPool.acquire("b", BASE_CFG, [1, 0, 0]);
    expect(npcEntityPool.activeCount).toBe(2);
    expect(npcEntityPool.stats.poolSize).toBeGreaterThanOrEqual(2);

    npcEntityPool.release("a");
    expect(npcEntityPool.activeCount).toBe(1);

    // acquire suivant devrait réutiliser le slot de "a"
    const s3 = npcEntityPool.acquire("c", BASE_CFG, [2, 0, 0]);
    expect(s3.id).toBe("c");
    expect(s3.active).toBe(true);

    // Le slot réutilisé doit avoir un useCount > 1
    expect(s3.useCount).toBeGreaterThanOrEqual(2);
  });

  it("releaseAll() libère tous les slots actifs", () => {
    npcEntityPool.acquire("a", BASE_CFG, [0, 0, 0]);
    npcEntityPool.acquire("b", BASE_CFG, [0, 0, 0]);
    npcEntityPool.acquire("c", BASE_CFG, [0, 0, 0]);

    expect(npcEntityPool.activeCount).toBe(3);
    npcEntityPool.releaseAll();
    expect(npcEntityPool.activeCount).toBe(0);
  });

  it("get(id) retourne undefined pour un slot inactif", () => {
    const s = npcEntityPool.acquire("ghost", BASE_CFG, [0, 0, 0]);
    expect(npcEntityPool.get("ghost")).toBeDefined();
    npcEntityPool.release("ghost");
    expect(npcEntityPool.get("ghost")).toBeUndefined();
  });

  it("forEach itère uniquement les slots actifs", () => {
    npcEntityPool.acquire("a", BASE_CFG, [0, 0, 0]);
    npcEntityPool.acquire("b", BASE_CFG, [0, 0, 0]);
    npcEntityPool.release("a");

    const ids: string[] = [];
    npcEntityPool.forEach((s) => ids.push(s.id));
    expect(ids).toEqual(["b"]);
  });

  it("countByBand() retourne des comptes par bande", () => {
    const s1 = npcEntityPool.acquire("near", BASE_CFG, [0, 0, 0]);
    s1.lastBand = 0;
    const s2 = npcEntityPool.acquire("mid", BASE_CFG, [0, 0, 0]);
    s2.lastBand = 1;
    const s3 = npcEntityPool.acquire("far", BASE_CFG, [0, 0, 0]);
    s3.lastBand = 2;

    const bands = npcEntityPool.countByBand();
    expect(bands.near + bands.mid + bands.far).toBe(3);
  });

  it("maintient peakActive", () => {
    expect(npcEntityPool.stats.peakActive).toBe(0);

    npcEntityPool.acquire("a", BASE_CFG, [0, 0, 0]);
    npcEntityPool.acquire("b", BASE_CFG, [0, 0, 0]);
    npcEntityPool.acquire("c", BASE_CFG, [0, 0, 0]);

    expect(npcEntityPool.stats.peakActive).toBeGreaterThanOrEqual(3);
  });

  it("ne crée pas de nouvelles instances lors de la réutilisation", () => {
    const s1 = npcEntityPool.acquire("x", BASE_CFG, [1, 2, 3]);
    const posRef = s1.position;
    const ctrlRef = s1.controller;

    npcEntityPool.release("x");
    const s2 = npcEntityPool.acquire("y", BASE_CFG, [4, 5, 6]);

    // Même objet position et controller (réutilisation)
    expect(s2.position).toBe(posRef);
    expect(s2.controller).toBe(ctrlRef);
  });
});
