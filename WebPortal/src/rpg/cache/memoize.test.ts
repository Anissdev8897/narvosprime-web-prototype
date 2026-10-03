// ══════════════════════════════════════════════════════════════════════════════
// cache/memoize.test.ts — Tests de la mémoïsation
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { memoize, memoizeSync, memoizeSyncPure, clearAllMemoCaches } from "./memoize";
import { EvictionStrategy } from "./types";

describe("memoize (async)", () => {
  it("mémoïse une fonction asynchrone", async () => {
    let callCount = 0;
    const fn = memoize(async (x: number) => {
      callCount++;
      return x * 2;
    }, { name: "test-async" });

    expect(await fn(5)).toBe(10);
    expect(callCount).toBe(1);

    // Deuxième appel → cache
    expect(await fn(5)).toBe(10);
    expect(callCount).toBe(1);
  });

  it("distingue les arguments différents", async () => {
    let callCount = 0;
    const fn = memoize(async (x: number, y: number) => {
      callCount++;
      return x + y;
    }, { name: "test-args" });

    expect(await fn(1, 2)).toBe(3);
    expect(await fn(3, 4)).toBe(7);
    expect(callCount).toBe(2);
  });

  it("gère les objets comme arguments", async () => {
    let callCount = 0;
    const fn = memoize(async (obj: { a: number }) => {
      callCount++;
      return obj.a * 2;
    }, { name: "test-obj" });

    expect(await fn({ a: 5 })).toBe(10);
    expect(await fn({ a: 5 })).toBe(10);
    expect(callCount).toBe(1); // Même JSON → cache hit
    expect(await fn({ a: 3 })).toBe(6);
    expect(callCount).toBe(2);
  });

  it("évince avec une stratégie LRU", async () => {
    let callCount = 0;
    const fn = memoize(async (x: number) => {
      callCount++;
      return x;
    }, {
      name: "test-lru",
      capacity: 3,
      strategy: EvictionStrategy.LRU,
    });

    await fn(1); await fn(2); await fn(3); // 3 appels, cache: [1,2,3]
    await fn(4); // callCount=4, évince 1, cache: [2,3,4]
    expect(callCount).toBe(4);

    await fn(1); // recalcul (1 évincé), callCount=5, évince 2, cache: [3,4,1]
    expect(callCount).toBe(5);

    await fn(2); // recalcul (2 évincé), callCount=6
    expect(callCount).toBe(6);
  });
});

describe("memoizeSync (wrap synchrone)", () => {
  it("mémoïse une fonction synchrone", async () => {
    let callCount = 0;
    const fn = memoizeSync((x: number) => {
      callCount++;
      return x * 3;
    }, { name: "test-sync" });

    expect(await fn(3)).toBe(9);
    expect(await fn(3)).toBe(9);
    expect(callCount).toBe(1);
  });
});

describe("memoizeSyncPure (synchrone direct)", () => {
  it("retourne le même résultat sans promesse", () => {
    let callCount = 0;
    const fn = memoizeSyncPure((x: number) => {
      callCount++;
      return x * 2;
    }, { capacity: 10 });

    expect(fn(5)).toBe(10);
    expect(fn(5)).toBe(10);
    expect(callCount).toBe(1);
    expect(fn(3)).toBe(6);
    expect(callCount).toBe(2);
  });
});

describe("clearAllMemoCaches", () => {
  it("vide tous les caches de mémoïsation", async () => {
    let callCount = 0;
    const fn = memoize(async (x: number) => {
      callCount++;
      return x;
    }, { name: "test-clear" });

    await fn(1);
    expect(callCount).toBe(1);
    await fn(1);
    expect(callCount).toBe(1); // en cache

    clearAllMemoCaches();

    await fn(1);
    expect(callCount).toBe(2); // recalculé
  });
});
