// ══════════════════════════════════════════════════════════════════════════════
// cache/unifiedCache.test.ts — Tests du cache unifié
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { UnifiedCache } from "./unifiedCache";
import { EvictionStrategy, CacheLevel } from "./types";

describe("UnifiedCache — LRU Strategy", () => {
  it("stocke et récupère une valeur en L1", async () => {
    const cache = new UnifiedCache<string, number>({
      l1Capacity: 100,
      strategy: EvictionStrategy.LRU,
      levels: { l1: true, l2: false, l3: false },
    });

    await cache.set("a", 42);
    const result = await cache.get("a");
    expect(result).toBeDefined();
    expect(result!.value).toBe(42);
    expect(result!.level).toBe(CacheLevel.L1_MEMORY);
  });

  it("retourne undefined pour une clé absente", async () => {
    const cache = new UnifiedCache<string, number>({
      l1Capacity: 100,
      levels: { l1: true, l2: false, l3: false },
    });

    const result = await cache.get("nonexistent");
    expect(result).toBeUndefined();
  });

  it("évince les entrées LRU quand la capacité est dépassée", async () => {
    const cache = new UnifiedCache<string, number>({
      l1Capacity: 3,
      strategy: EvictionStrategy.LRU,
      levels: { l1: true, l2: false, l3: false },
    });

    await cache.set("a", 1);
    await cache.set("b", 2);
    await cache.set("c", 3);

    // L1 est plein (3 entrées)
    expect((await cache.size)).toBe(3);

    // Accéder à "a" pour le marquer comme récent
    await cache.get("a");

    // Ajouter une 4e entrée → éviction de la moins récente (b)
    await cache.set("d", 4);

    // "a" et "c" et "d" doivent être présents (a a été touché récemment)
    expect(await cache.get("a")).toBeDefined();
    expect(await cache.get("b")).toBeUndefined();
    expect(await cache.get("d")).toBeDefined();
  });

  it("efface le cache", async () => {
    const cache = new UnifiedCache<string, number>({
      l1Capacity: 100,
      levels: { l1: true, l2: false, l3: false },
    });

    await cache.set("a", 1);
    await cache.set("b", 2);
    expect((await cache.size)).toBe(2);

    await cache.clear();
    expect((await cache.size)).toBe(0);
    expect(await cache.get("a")).toBeUndefined();
  });

  it("tracke les statistiques", async () => {
    const cache = new UnifiedCache<string, number>({
      l1Capacity: 100,
      levels: { l1: true, l2: false, l3: false },
    });

    await cache.get("miss1"); // miss
    await cache.get("miss2"); // miss
    await cache.set("a", 1);
    await cache.get("a"); // hit
    await cache.get("a"); // hit

    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(2);
    expect(stats.hitRate).toBe(0.5);
  });
});

describe("UnifiedCache — LFU Strategy", () => {
  it("évince l'entrée la moins fréquemment utilisée", async () => {
    const cache = new UnifiedCache<string, number>({
      l1Capacity: 3,
      strategy: EvictionStrategy.LFU,
      levels: { l1: true, l2: false, l3: false },
    });

    await cache.set("a", 1);
    await cache.set("b", 2);
    await cache.set("c", 3);

    // Fréquences après gets: a=4, b=1, c=3 (set met freq=1, chaque get +1)
    await cache.get("a"); await cache.get("a"); await cache.get("a");
    await cache.get("c"); await cache.get("c");

    // Ajouter "d" puis "e" pour saturer → éviction du moins fréquent (b)
    await cache.set("d", 4);
    await cache.set("e", 5);

    // "b" (freq=1) devrait être évincé, les fréquents restent
    expect(await cache.get("a")).toBeDefined();
    expect(await cache.get("c")).toBeDefined();
    expect(await cache.get("e")).toBeDefined();
  });
});

describe("UnifiedCache — FIFO Strategy", () => {
  it("évince la première entrée insérée", async () => {
    const cache = new UnifiedCache<string, number>({
      l1Capacity: 3,
      strategy: EvictionStrategy.FIFO,
      levels: { l1: true, l2: false, l3: false },
    });

    await cache.set("a", 1);
    await cache.set("b", 2);
    await cache.set("c", 3);

    // Accéder à "a" ne change pas l'ordre FIFO
    await cache.get("a");

    // Ajouter "d" → "a" (premier inséré) doit être évincé
    await cache.set("d", 4);

    expect(await cache.get("a")).toBeUndefined();
    expect(await cache.get("b")).toBeDefined();
    expect(await cache.get("d")).toBeDefined();
  });
});

describe("UnifiedCache — TTL Strategy", () => {
  it("invalide les entrées après expiration", async () => {
    const cache = new UnifiedCache<string, number>({
      l1Capacity: 100,
      strategy: EvictionStrategy.TTL,
      defaultTtl: 50, // 50ms TTL
      levels: { l1: true, l2: false, l3: false },
    });

    await cache.set("a", 1);
    expect(await cache.get("a")).toBeDefined();

    // Attendre que le TTL expire
    await new Promise((r) => setTimeout(r, 60));

    expect(await cache.get("a")).toBeUndefined();
  });

  it("maintient les entrées avant expiration", async () => {
    const cache = new UnifiedCache<string, number>({
      l1Capacity: 100,
      strategy: EvictionStrategy.TTL,
      defaultTtl: 5000,
      levels: { l1: true, l2: false, l3: false },
    });

    await cache.set("a", 1);
    expect(await cache.get("a")).toBeDefined();
  });
});

describe("UnifiedCache — has et delete", () => {
  it("vérifie la présence d'une clé", async () => {
    const cache = new UnifiedCache<string, number>({
      l1Capacity: 100,
      levels: { l1: true, l2: false, l3: false },
    });

    await cache.set("a", 1);
    expect(await cache.has("a")).toBe(true);
    expect(await cache.has("b")).toBe(false);
  });

  it("supprime une entrée", async () => {
    const cache = new UnifiedCache<string, number>({
      l1Capacity: 100,
      levels: { l1: true, l2: false, l3: false },
    });

    await cache.set("a", 1);
    expect(await cache.has("a")).toBe(true);

    await cache.delete("a");
    expect(await cache.has("a")).toBe(false);
    expect(await cache.get("a")).toBeUndefined();
  });
});

describe("UnifiedCache — promotion L2/L3 vers L1", () => {
  it("délègue au L3 fetcher et promeut dans L1", async () => {
    let fetcherCalled = 0;
    const cache = new UnifiedCache<string, string>({
      l1Capacity: 100,
      strategy: EvictionStrategy.LRU,
      levels: { l1: true, l2: false, l3: true },
      fetcher: async (key) => {
        fetcherCalled++;
        return `fetched:${key}`;
      },
      promoteToL1: true,
    });

    // Premier get → fetcher L3
    const r1 = await cache.get("x");
    expect(r1).toBeDefined();
    expect(r1!.value).toBe("fetched:x");
    expect(r1!.level).toBe(CacheLevel.L3_NETWORK);
    expect(fetcherCalled).toBe(1);

    // Deuxième get → cache L1
    const r2 = await cache.get("x");
    expect(r2).toBeDefined();
    expect(r2!.level).toBe(CacheLevel.L1_MEMORY);
    expect(fetcherCalled).toBe(1); // pas de nouvel appel
  });
});

describe("UnifiedCache — stratégie dynamique", () => {
  it("change de stratégie sans vider le cache", async () => {
    const cache = new UnifiedCache<string, number>({
      l1Capacity: 10,
      strategy: EvictionStrategy.LRU,
      levels: { l1: true, l2: false, l3: false },
    });

    await cache.set("a", 1);
    await cache.set("b", 2);

    cache.setStrategy(EvictionStrategy.LFU);
    expect(cache.strategy).toBe(EvictionStrategy.LFU);
    expect(await cache.get("a")).toBeDefined();
  });
});
