// ══════════════════════════════════════════════════════════════════════════════
// dialogue/__tests__/conditions.test.ts — Tests des conditions de dialogue
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock localStorage ────────────────────────────────────────────────────────
const storage = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
});

vi.mock("../../persistence/dbStore", () => ({
  loadCharacterDb: vi.fn().mockResolvedValue(null),
  saveCharacterDb: vi.fn(),
}));

import { evaluateCondition, evaluateConditions, configureConditions, resetConditions } from "../conditions";
import { questStore } from "../../quests/questStore";
import type { DialogueCondition } from "../types";

beforeEach(() => {
  storage.clear();
  resetConditions();
  questStore.setCharacter("test-char");
});

describe("evaluateCondition", () => {
  it("returns true for empty conditions array", () => {
    expect(evaluateConditions([])).toBe(true);
    expect(evaluateConditions(undefined)).toBe(true);
  });

  it("evaluates quest_active condition", () => {
    questStore.accept("forge_first_blood");
    const cond: DialogueCondition = {
      type: "quest_active",
      params: { questId: "forge_first_blood" },
    };
    expect(evaluateCondition(cond)).toBe(true);

    cond.params = { questId: "nonexistent" };
    expect(evaluateCondition(cond)).toBe(false);
  });

  it("evaluates quest_completed condition", () => {
    // Complete the quest
    questStore.accept("forge_first_blood");
    for (let i = 0; i < 5; i++) questStore.recordKill();

    const cond: DialogueCondition = {
      type: "quest_completed",
      params: { questId: "forge_first_blood" },
    };
    expect(evaluateCondition(cond)).toBe(true);

    const cond2: DialogueCondition = {
      type: "quest_completed",
      params: { questId: "nonexistent" },
    };
    expect(evaluateCondition(cond2)).toBe(false);
  });

  it("evaluates quest_not_active condition", () => {
    const cond: DialogueCondition = {
      type: "quest_not_active",
      params: { questId: "forge_first_blood" },
    };
    expect(evaluateCondition(cond)).toBe(true);

    questStore.accept("forge_first_blood");
    expect(evaluateCondition(cond)).toBe(false);
  });

  it("evaluates quest_not_completed condition", () => {
    const cond: DialogueCondition = {
      type: "quest_not_completed",
      params: { questId: "forge_first_blood" },
    };
    // Not completed yet
    expect(evaluateCondition(cond)).toBe(true);

    // Complete it
    questStore.accept("forge_first_blood");
    for (let i = 0; i < 5; i++) questStore.recordKill();
    expect(evaluateCondition(cond)).toBe(false);
  });

  it("evaluates level_min condition", () => {
    configureConditions({ getLevel: () => 10 });

    const cond: DialogueCondition = {
      type: "level_min",
      params: { min: 5 },
    };
    expect(evaluateCondition(cond)).toBe(true);

    const cond2: DialogueCondition = {
      type: "level_min",
      params: { min: 15 },
    };
    expect(evaluateCondition(cond2)).toBe(false);
  });

  it("evaluates level_max condition", () => {
    configureConditions({ getLevel: () => 10 });

    const cond: DialogueCondition = {
      type: "level_max",
      params: { max: 15 },
    };
    expect(evaluateCondition(cond)).toBe(true);

    const cond2: DialogueCondition = {
      type: "level_max",
      params: { max: 5 },
    };
    expect(evaluateCondition(cond2)).toBe(false);
  });

  it("evaluates has_item condition", () => {
    configureConditions({ hasItem: (id) => id === "potion_soin" });

    const cond: DialogueCondition = {
      type: "has_item",
      params: { itemId: "potion_soin" },
    };
    expect(evaluateCondition(cond)).toBe(true);

    const cond2: DialogueCondition = {
      type: "has_item",
      params: { itemId: "rare_sword" },
    };
    expect(evaluateCondition(cond2)).toBe(false);
  });

  it("evaluates flag condition", () => {
    configureConditions({ hasFlag: (f) => f === "met_boris" });

    const cond: DialogueCondition = {
      type: "flag",
      params: { flag: "met_boris" },
    };
    expect(evaluateCondition(cond)).toBe(true);

    const cond2: DialogueCondition = {
      type: "flag",
      params: { flag: "unknown_flag" },
    };
    expect(evaluateCondition(cond2)).toBe(false);
  });

  it("returns false for unknown condition type", () => {
    const cond = { type: "invalid_type" as any, params: {} };
    expect(evaluateCondition(cond)).toBe(false);
  });

  it("evaluates multiple conditions with AND logic", () => {
    questStore.accept("forge_first_blood");
    configureConditions({ getLevel: () => 10 });

    const conds: DialogueCondition[] = [
      { type: "quest_active", params: { questId: "forge_first_blood" } },
      { type: "level_min", params: { min: 5 } },
    ];
    expect(evaluateConditions(conds)).toBe(true);

    // One fails
    conds.push({ type: "level_max", params: { max: 3 } });
    expect(evaluateConditions(conds)).toBe(false);
  });
});
