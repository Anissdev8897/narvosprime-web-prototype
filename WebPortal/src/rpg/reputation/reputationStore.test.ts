import { describe, it, expect, beforeEach, vi } from "vitest";

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
});

import { reputationStore, currentTier } from "./reputationStore";
import { nextTier, merchantDiscount, REPUTATION_TIERS } from "./reputationCatalog";

beforeEach(() => {
  reputationStore.reset();
  storage.clear();
});

describe("reputationStore", () => {
  it("starts at 0 for all factions", () => {
    const s = reputationStore.get();
    expect(s.akarlys).toBe(0);
    expect(s.mezalayis).toBe(0);
    expect(s.zayan).toBe(0);
  });

  it("gain increases reputation", () => {
    reputationStore.init("test-char");
    reputationStore.gain("akarlys", 100);
    expect(reputationStore.get().akarlys).toBe(100);
  });

  it("gain ignores non-positive amounts", () => {
    reputationStore.init("test-char");
    reputationStore.gain("akarlys", 0);
    reputationStore.gain("akarlys", -5);
    expect(reputationStore.get().akarlys).toBe(0);
  });

  it("lose decreases reputation", () => {
    reputationStore.init("test-char");
    reputationStore.gain("mezalayis", 500);
    reputationStore.lose("mezalayis", 200);
    expect(reputationStore.get().mezalayis).toBe(300);
  });

  it("lose can go negative", () => {
    reputationStore.init("test-char");
    reputationStore.lose("zayan", 1000);
    expect(reputationStore.get().zayan).toBe(-1000);
  });

  it("set overwrites value", () => {
    reputationStore.init("test-char");
    reputationStore.set("akarlys", 9999);
    expect(reputationStore.get().akarlys).toBe(9999);
  });

  it("set no-ops when value unchanged", () => {
    reputationStore.init("test-char");
    let calls = 0;
    const unsub = reputationStore.subscribe(() => calls++);
    reputationStore.set("akarlys", 0);
    expect(calls).toBe(0);
    unsub();
  });

  it("persists and restores per characterId", () => {
    reputationStore.init("char-a");
    reputationStore.gain("akarlys", 5000);
    reputationStore.reset();

    reputationStore.init("char-a");
    expect(reputationStore.get().akarlys).toBe(5000);
  });

  it("isolates data between characters", () => {
    reputationStore.init("char-a");
    reputationStore.gain("akarlys", 3000);
    reputationStore.reset();

    reputationStore.init("char-b");
    expect(reputationStore.get().akarlys).toBe(0);
  });

  it("reset clears state", () => {
    reputationStore.init("test-char");
    reputationStore.gain("akarlys", 1000);
    reputationStore.gain("mezalayis", 2000);
    reputationStore.reset();
    const s = reputationStore.get();
    expect(s.akarlys).toBe(0);
    expect(s.mezalayis).toBe(0);
    expect(s.zayan).toBe(0);
  });

  it("emits on state change", () => {
    let calls = 0;
    const unsub = reputationStore.subscribe(() => calls++);
    reputationStore.init("test-char");
    reputationStore.gain("akarlys", 100);
    expect(calls).toBe(2);
    unsub();
  });

  it("unsubscribe stops notifications", () => {
    let calls = 0;
    const unsub = reputationStore.subscribe(() => calls++);
    reputationStore.init("test-char");
    unsub();
    reputationStore.gain("akarlys", 100);
    expect(calls).toBe(1);
  });
});

describe("currentTier", () => {
  it("returns hostile for very negative rep", () => {
    expect(currentTier(-10000)).toBe("hostile");
  });

  it("returns unfriendly at -3000", () => {
    expect(currentTier(-3000)).toBe("unfriendly");
  });

  it("returns neutral at 0", () => {
    expect(currentTier(0)).toBe("neutral");
  });

  it("returns friendly at 3000", () => {
    expect(currentTier(3000)).toBe("friendly");
  });

  it("returns honored at 9000", () => {
    expect(currentTier(9000)).toBe("honored");
  });

  it("returns revered at 21000", () => {
    expect(currentTier(21000)).toBe("revered");
  });

  it("returns exalted at 42000", () => {
    expect(currentTier(42000)).toBe("exalted");
  });

  it("returns exalted for massive rep", () => {
    expect(currentTier(999999)).toBe("exalted");
  });
});

describe("tierOf integration", () => {
  it("reflects current faction tier", () => {
    reputationStore.init("test-char");
    reputationStore.gain("akarlys", 9500);
    expect(reputationStore.tierOf("akarlys")).toBe("honored");
  });
});

describe("reputationCatalog", () => {
  it("tiers sorted by minRep ascending", () => {
    for (let i = 1; i < REPUTATION_TIERS.length; i++) {
      expect(REPUTATION_TIERS[i].minRep).toBeGreaterThan(REPUTATION_TIERS[i - 1].minRep);
    }
  });

  it("nextTier returns next for neutral", () => {
    const n = nextTier("neutral");
    expect(n?.id).toBe("friendly");
  });

  it("nextTier returns null for exalted", () => {
    expect(nextTier("exalted")).toBeNull();
  });

  it("merchantDiscount hostile = 3x", () => {
    expect(merchantDiscount("hostile")).toBe(3.0);
  });

  it("merchantDiscount neutral = 1x", () => {
    expect(merchantDiscount("neutral")).toBe(1.0);
  });

  it("merchantDiscount exalted = 0.6x", () => {
    expect(merchantDiscount("exalted")).toBe(0.6);
  });
});
