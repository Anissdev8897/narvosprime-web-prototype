import { describe, it, expect, beforeEach, vi } from "vitest";

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
});

import { petStore } from "./petStore";

beforeEach(() => {
  storage.clear();
  petStore.init("test-char");
});

describe("petStore", () => {
  it("starts empty after init", () => {
    const s = petStore.get();
    expect(s.owned).toEqual([]);
    expect(s.activeCompanionId).toBeNull();
  });

  it("adopt adds a pet", () => {
    petStore.adopt("wolf_01", "Fang");
    const owned = petStore.get().owned;
    expect(owned).toHaveLength(1);
    expect(owned[0].id).toBe("wolf_01");
    expect(owned[0].nickname).toBe("Fang");
    expect(owned[0].level).toBe(1);
    expect(owned[0].xp).toBe(0);
  });

  it("adopt without nickname uses id", () => {
    petStore.adopt("cat_01");
    expect(petStore.get().owned[0].nickname).toBe("cat_01");
  });

  it("adopt no-ops for duplicate pet", () => {
    petStore.adopt("wolf_01", "Fang");
    petStore.adopt("wolf_01", "Fang2");
    expect(petStore.get().owned).toHaveLength(1);
    expect(petStore.get().owned[0].nickname).toBe("Fang");
  });

  it("rename changes nickname", () => {
    petStore.adopt("wolf_01", "Fang");
    petStore.rename("wolf_01", "Shadow");
    expect(petStore.getOwned("wolf_01")?.nickname).toBe("Shadow");
  });

  it("setActive sets companion", () => {
    petStore.adopt("wolf_01");
    petStore.setActive("wolf_01");
    expect(petStore.get().activeCompanionId).toBe("wolf_01");
  });

  it("setActive null clears companion", () => {
    petStore.adopt("wolf_01");
    petStore.setActive("wolf_01");
    petStore.setActive(null);
    expect(petStore.get().activeCompanionId).toBeNull();
  });

  it("setActive no-ops for unowned pet", () => {
    petStore.setActive("unknown_pet");
    expect(petStore.get().activeCompanionId).toBeNull();
  });

  it("getActiveCompanion returns active pet", () => {
    petStore.adopt("wolf_01", "Fang");
    petStore.setActive("wolf_01");
    const c = petStore.getActiveCompanion();
    expect(c?.id).toBe("wolf_01");
    expect(c?.nickname).toBe("Fang");
  });

  it("getActiveCompanion returns undefined when none active", () => {
    expect(petStore.getActiveCompanion()).toBeUndefined();
  });

  it("grantXp increases xp", () => {
    petStore.adopt("wolf_01");
    petStore.grantXp("wolf_01", 50);
    expect(petStore.getOwned("wolf_01")?.xp).toBe(50);
  });

  it("grantXp auto-levels when threshold met", () => {
    petStore.adopt("wolf_01");
    const needed = petStore.xpForLevel(1);
    petStore.grantXp("wolf_01", needed);
    const pet = petStore.getOwned("wolf_01")!;
    expect(pet.level).toBe(2);
    expect(pet.xp).toBe(0);
  });

  it("grantXp multi-level from big xp grant", () => {
    petStore.adopt("wolf_01");
    const lvl1 = petStore.xpForLevel(1);
    const lvl2 = petStore.xpForLevel(2);
    petStore.grantXp("wolf_01", lvl1 + lvl2 + 10);
    const pet = petStore.getOwned("wolf_01")!;
    expect(pet.level).toBe(3);
    expect(pet.xp).toBe(10);
  });

  it("grantXp caps at MAX_PET_LEVEL", () => {
    petStore.adopt("wolf_01");
    petStore.grantXp("wolf_01", 999999);
    const pet = petStore.getOwned("wolf_01")!;
    expect(pet.level).toBe(petStore.MAX_PET_LEVEL);
  });

  it("persists and restores per character", () => {
    petStore.adopt("wolf_01", "Fang");
    petStore.init("other-char");
    expect(petStore.get().owned).toHaveLength(0);
    petStore.init("test-char");
    expect(petStore.get().owned).toHaveLength(1);
    expect(petStore.get().owned[0].nickname).toBe("Fang");
  });

  it("subscribe emits on mutation", () => {
    let calls = 0;
    const unsub = petStore.subscribe(() => calls++);
    petStore.adopt("wolf_01");
    expect(calls).toBeGreaterThan(0);
    unsub();
  });

  it("unsubscribe stops notifications", () => {
    let calls = 0;
    const unsub = petStore.subscribe(() => calls++);
    petStore.adopt("wolf_01");
    const before = calls;
    unsub();
    petStore.adopt("cat_01");
    expect(calls).toBe(before);
  });
});

describe("xpForLevel", () => {
  it("returns 120 for level 1", () => {
    expect(petStore.xpForLevel(1)).toBe(120);
  });

  it("increases per level", () => {
    expect(petStore.xpForLevel(5)).toBeGreaterThan(petStore.xpForLevel(1));
  });
});
