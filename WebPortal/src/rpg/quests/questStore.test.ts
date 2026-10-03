import { describe, it, expect, beforeEach, vi } from "vitest";

const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
});

vi.mock("../persistence/dbStore", () => ({
  loadCharacterDb: vi.fn().mockResolvedValue(null),
  saveCharacterDb: vi.fn(),
}));

import { questStore } from "./questStore";
import { getQuest } from "./questCatalog";

beforeEach(() => {
  storage.clear();
  questStore.setCharacter("test-char");
});

describe("questStore basics", () => {
  it("starts empty", () => {
    const s = questStore.get();
    expect(s.active).toEqual([]);
    expect(s.completed).toEqual([]);
  });

  it("accept adds quest to active", () => {
    questStore.accept("forge_first_blood");
    expect(questStore.isActive("forge_first_blood")).toBe(true);
    const prog = questStore.get().active[0];
    expect(prog.id).toBe("forge_first_blood");
    expect(prog.counts).toEqual([0]);
    expect(prog.done).toBe(false);
  });

  it("accept no-ops for unknown quest", () => {
    questStore.accept("nonexistent_quest");
    expect(questStore.get().active).toHaveLength(0);
  });

  it("accept no-ops for already active quest", () => {
    questStore.accept("forge_first_blood");
    questStore.accept("forge_first_blood");
    expect(questStore.get().active).toHaveLength(1);
  });

  it("abandon removes from active", () => {
    questStore.accept("forge_first_blood");
    questStore.abandon("forge_first_blood");
    expect(questStore.isActive("forge_first_blood")).toBe(false);
    expect(questStore.get().active).toHaveLength(0);
  });

  it("abandon no-ops for non-active quest", () => {
    questStore.abandon("forge_first_blood");
    expect(questStore.get().active).toHaveLength(0);
  });
});

describe("prerequisites", () => {
  it("forge_frontline not available before forge_first_blood completed", () => {
    const def = getQuest("forge_frontline")!;
    expect(questStore.isAvailable(def)).toBe(false);
  });

  it("forge_frontline available after forge_first_blood completed", () => {
    questStore.accept("forge_first_blood");
    for (let i = 0; i < 5; i++) questStore.recordKill();
    const def = getQuest("forge_frontline")!;
    expect(questStore.isAvailable(def)).toBe(true);
  });
});

describe("recordKill", () => {
  it("increments kill objective", () => {
    questStore.accept("forge_first_blood");
    questStore.recordKill();
    expect(questStore.get().active[0].counts[0]).toBe(1);
  });

  it("returns completed quest when target reached", () => {
    questStore.accept("forge_first_blood");
    let completed: ReturnType<typeof questStore.recordKill> = [];
    for (let i = 0; i < 5; i++) {
      completed = questStore.recordKill();
    }
    expect(completed).toHaveLength(1);
    expect(completed[0].id).toBe("forge_first_blood");
    expect(questStore.isCompleted("forge_first_blood")).toBe(true);
    expect(questStore.isActive("forge_first_blood")).toBe(false);
  });

  it("caps at target (no overflow)", () => {
    questStore.accept("forge_first_blood");
    for (let i = 0; i < 10; i++) questStore.recordKill();
    expect(questStore.isCompleted("forge_first_blood")).toBe(true);
  });

  it("returns empty when no quest completes", () => {
    questStore.accept("forge_first_blood");
    const completed = questStore.recordKill();
    expect(completed).toHaveLength(0);
  });
});

describe("recordReach", () => {
  it("completes reach objective when in zone", () => {
    questStore.accept("forge_first_blood");
    for (let i = 0; i < 5; i++) questStore.recordKill();
    questStore.accept("forge_frontline");
    const completed = questStore.recordReach("forge", 0, -50);
    expect(completed).toHaveLength(1);
    expect(completed[0].id).toBe("forge_frontline");
  });

  it("does not complete when outside zone", () => {
    questStore.accept("forge_first_blood");
    for (let i = 0; i < 5; i++) questStore.recordKill();
    questStore.accept("forge_frontline");
    const completed = questStore.recordReach("forge", 999, 999);
    expect(completed).toHaveLength(0);
  });

  it("does not match wrong map", () => {
    questStore.accept("forge_first_blood");
    for (let i = 0; i < 5; i++) questStore.recordKill();
    questStore.accept("forge_frontline");
    const completed = questStore.recordReach("tower", 0, -50);
    expect(completed).toHaveLength(0);
  });
});

describe("availableForMap", () => {
  it("returns forge quests for forge map", () => {
    const available = questStore.availableForMap("forge");
    expect(available.some((q) => q.id === "forge_first_blood")).toBe(true);
  });

  it("includes global quests (no mapId)", () => {
    const available = questStore.availableForMap("forge");
    expect(available.some((q) => q.id === "acces_donjon_furiste")).toBe(true);
  });

  it("excludes already active quests", () => {
    questStore.accept("forge_first_blood");
    const available = questStore.availableForMap("forge");
    expect(available.some((q) => q.id === "forge_first_blood")).toBe(false);
  });
});

describe("persistence", () => {
  it("persists and restores per character", () => {
    questStore.accept("forge_first_blood");
    questStore.recordKill();
    questStore.setCharacter("other-char");
    expect(questStore.get().active).toHaveLength(0);
    questStore.setCharacter("test-char");
    expect(questStore.get().active).toHaveLength(1);
    expect(questStore.get().active[0].counts[0]).toBe(1);
  });
});

describe("subscribe", () => {
  it("notifies on mutations", () => {
    let calls = 0;
    const unsub = questStore.subscribe(() => calls++);
    questStore.accept("forge_first_blood");
    expect(calls).toBeGreaterThan(0);
    unsub();
  });

  it("unsubscribe stops notifications", () => {
    let calls = 0;
    const unsub = questStore.subscribe(() => calls++);
    questStore.accept("forge_first_blood");
    const before = calls;
    unsub();
    questStore.abandon("forge_first_blood");
    expect(calls).toBe(before);
  });
});
