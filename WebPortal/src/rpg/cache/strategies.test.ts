// ══════════════════════════════════════════════════════════════════════════════
// cache/strategies.test.ts — Tests unitaires des politiques d'éviction
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { LRUPolicy, LFUPolicy, FIFOPolicy, TTLPolicy, createPolicy } from "./strategies";
import { EvictionStrategy } from "./types";
import type { CacheEntryMeta } from "./types";

function makeMeta(accessCount = 1, createdAt = 0): CacheEntryMeta {
  return {
    createdAt,
    lastAccessedAt: createdAt,
    accessCount,
    ttl: 0,
  };
}

describe("LRUPolicy", () => {
  it("évince la clé la moins récemment utilisée", () => {
    const policy = new LRUPolicy<string>();
    policy.recordSet("a");
    policy.recordSet("b");
    policy.recordSet("c");

    const metaMap = new Map<string, CacheEntryMeta>([
      ["a", makeMeta()], ["b", makeMeta()], ["c", makeMeta()],
    ]);

    expect(policy.getEvictionCandidate(metaMap)).toBe("a");

    policy.recordAccess("a");
    expect(policy.getEvictionCandidate(metaMap)).toBe("b");
  });

  it("gère la suppression", () => {
    const policy = new LRUPolicy<string>();
    policy.recordSet("a");
    policy.recordSet("b");
    policy.recordDelete("a");

    expect(policy.size).toBe(1);
    expect(policy.getOrder()).toEqual(["b"]);
  });
});

describe("LFUPolicy", () => {
  it("évince la clé la moins fréquemment utilisée", () => {
    const policy = new LFUPolicy<string>();
    policy.recordSet("a");
    policy.recordSet("b");
    policy.recordSet("c");

    const metaMap = new Map<string, CacheEntryMeta>([
      ["a", makeMeta(5)],  // 5 accès
      ["b", makeMeta(1)],  // 1 accès
      ["c", makeMeta(3)],  // 3 accès
    ]);

    expect(policy.getEvictionCandidate(metaMap)).toBe("b");
  });
});

describe("FIFOPolicy", () => {
  it("évince la première clé insérée", () => {
    const policy = new FIFOPolicy<string>();
    policy.recordSet("a");
    policy.recordSet("b");
    policy.recordSet("c");

    const metaMap = new Map<string, CacheEntryMeta>([
      ["a", makeMeta()], ["b", makeMeta()], ["c", makeMeta()],
    ]);

    expect(policy.getEvictionCandidate(metaMap)).toBe("a");

    // L'accès ne change pas l'ordre FIFO
    policy.recordAccess("a");
    expect(policy.getEvictionCandidate(metaMap)).toBe("a");
  });
});

describe("TTLPolicy", () => {
  it("retourne une clé expirée", () => {
    const policy = new TTLPolicy<string>();
    policy.recordSet("a");
    policy.recordSet("b");

    const metaMap = new Map<string, CacheEntryMeta>([
      ["a", makeMeta(1, 0)],           // créée à t=0, TTL non défini dans la meta
      ["b", makeMeta(1, performance.now() - 100)], // créée il y a 100ms
    ]);

    // Avec TTLPolicy, on utilise le TTL dans CacheEntryMeta
    // Comme nos meta ont ttl=0, aucune n'expire pas
    const candidate = policy.getEvictionCandidate(metaMap);
    // ttl=0 signifie pas de TTL → pas d'expiration
    expect(candidate).toBeUndefined();
  });

  it("identifie les clés avec TTL expiré", () => {
    const policy = new TTLPolicy<string>();
    policy.recordSet("fresh");
    policy.recordSet("stale");

    const metaMap = new Map<string, CacheEntryMeta>([
      ["fresh", { createdAt: performance.now(), lastAccessedAt: performance.now(), accessCount: 1, ttl: 5000 }],
      ["stale", { createdAt: performance.now() - 100, lastAccessedAt: performance.now() - 100, accessCount: 1, ttl: 50 }],
    ]);

    // "stale" a 100ms de age avec TTL=50ms → expiré
    const expired = policy.getExpiredKeys(metaMap);
    expect(expired).toContain("stale");
    expect(expired).not.toContain("fresh");
  });
});

describe("createPolicy", () => {
  it("crée la bonne politique selon la stratégie", () => {
    expect(createPolicy(EvictionStrategy.LRU)).toBeInstanceOf(LRUPolicy);
    expect(createPolicy(EvictionStrategy.LFU)).toBeInstanceOf(LFUPolicy);
    expect(createPolicy(EvictionStrategy.FIFO)).toBeInstanceOf(FIFOPolicy);
    expect(createPolicy(EvictionStrategy.TTL)).toBeInstanceOf(TTLPolicy);
  });
});
