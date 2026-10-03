// ══════════════════════════════════════════════════════════════════════════════
// dialogue/__tests__/dialogueRunner.test.ts — Tests du moteur de dialogue
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

vi.mock("../../runtime/core/EventBus", () => ({
  eventBus: {
    on: vi.fn(),
    emit: vi.fn(),
    off: vi.fn(),
    clear: vi.fn(),
  },
}));

import { dialogueRunner } from "../dialogueRunner";
import type { DialogueDef } from "../types";
import { configureConditions, resetConditions } from "../conditions";
import { questStore } from "../../quests/questStore";

// ── Dialogue de test ─────────────────────────────────────────────────────────

const TEST_DIALOGUE: DialogueDef = {
  id: "test_dialogue",
  title: "Dialogue test",
  npcFolder: "test_npc",
  npcName: "Testeur",
  startNode: "start",
  nodes: [
    {
      id: "start",
      text: "Bonjour {player}, bienvenue au test.",
      speaker: "Testeur",
      choices: [
        { text: "Parle-moi de toi.", nextNode: "about" },
        { text: "J'ai une quête ?", nextNode: "quest_check" },
        { text: "Au revoir.", nextNode: "goodbye" },
      ],
    },
    {
      id: "about",
      text: "Je suis un PNJ de test pour le système de dialogues.",
      speaker: "Testeur",
      choices: [
        { text: "Intéressant. Bon, salut.", nextNode: "goodbye" },
      ],
    },
    {
      id: "quest_check",
      text: "Tu veux une quête ? J'en ai une pour toi.",
      speaker: "Testeur",
      choices: [
        {
          text: "Oui, donne-la moi !",
          nextNode: "quest_given",
          onSelect: [
            { type: "give_quest", params: { questId: "forge_first_blood" } },
          ],
        },
        { text: "Peut-être plus tard.", nextNode: "start" },
      ],
    },
    {
      id: "quest_given",
      text: "Quête acceptée ! Reviens me voir quand t'as fini.",
      speaker: "Testeur",
    },
    {
      id: "goodbye",
      text: "À la prochaine, {player}.",
      speaker: "Testeur",
    },
  ],
};

// ── Dialogue conditionnel (pour tester les conditions) ───────────────────────

const CONDITIONAL_DIALOGUE: DialogueDef = {
  id: "conditional_dialogue",
  title: "Dialogue conditionnel",
  npcFolder: "conditional_npc",
  npcName: "Conditionneur",
  startNode: "start",
  nodes: [
    {
      id: "start",
      text: "Testons les conditions.",
      speaker: "Conditionneur",
      choices: [
        {
          text: "Je suis niveau 5+.",
          nextNode: "high_level",
          conditions: [
            { type: "level_min", params: { min: 5 } },
          ],
        },
        {
          text: "Je suis bas niveau.",
          nextNode: "low_level",
          conditions: [
            { type: "level_max", params: { max: 4 } },
          ],
        },
        { text: "Option neutre.", nextNode: "neutral" },
      ],
    },
    { id: "high_level", text: "T'es un dur à cuire !", speaker: "Conditionneur" },
    { id: "low_level", text: "Reviens plus fort.", speaker: "Conditionneur" },
    { id: "neutral", text: "Option neutre choisie.", speaker: "Conditionneur" },
  ],
};

beforeEach(() => {
  storage.clear();
  resetConditions();
  dialogueRunner.clearRegistry();
  questStore.setCharacter("test-char");
});

describe("dialogueRunner basics", () => {
  beforeEach(() => {
    dialogueRunner.registerAll([TEST_DIALOGUE, CONDITIONAL_DIALOGUE]);
  });

  it("starts empty", () => {
    // After beforeEach, registry is cleared, so isActive should be false
    expect(dialogueRunner.isActive).toBe(false);
    expect(dialogueRunner.currentNode()).toBeNull();
  });

  it("registers and retrieves dialogues", () => {
    expect(dialogueRunner.getDef("test_dialogue")).toBe(TEST_DIALOGUE);
    expect(dialogueRunner.getDef("unknown")).toBeUndefined();
  });

  it("finds dialogues for an npc", () => {
    const npcDialogues = dialogueRunner.getDialoguesForNpc("test_npc");
    expect(npcDialogues).toHaveLength(1);
    expect(npcDialogues[0].id).toBe("test_dialogue");
  });
});

describe("dialogueRunner start/stop", () => {
  beforeEach(() => {
    dialogueRunner.register(TEST_DIALOGUE);
  });

  it("starts a dialogue and returns the start node", () => {
    const node = dialogueRunner.start("test_dialogue");
    expect(node).not.toBeNull();
    expect(node!.id).toBe("start");
    expect(node!.text).toContain("Bonjour");
    expect(dialogueRunner.isActive).toBe(true);
  });

  it("returns null and clears state for unknown dialogue id", () => {
    const node = dialogueRunner.start("unknown");
    expect(node).toBeNull();
    expect(dialogueRunner.isActive).toBe(false);
  });

  it("stops the active dialogue", () => {
    dialogueRunner.start("test_dialogue");
    expect(dialogueRunner.isActive).toBe(true);
    dialogueRunner.stop();
    expect(dialogueRunner.isActive).toBe(false);
    expect(dialogueRunner.currentNode()).toBeNull();
  });
});

describe("dialogueRunner navigation", () => {
  beforeEach(() => {
    dialogueRunner.register(TEST_DIALOGUE);
    dialogueRunner.start("test_dialogue");
  });

  it("navigates to next node via selectChoice", () => {
    const node = dialogueRunner.selectChoice(0);
    expect(node).not.toBeNull();
    expect(node!.id).toBe("about");
    expect(node!.text).toContain("PNJ de test");
  });

  it("navigates to goodbye", () => {
    const node = dialogueRunner.selectChoice(2);
    expect(node).not.toBeNull();
    expect(node!.id).toBe("goodbye");
  });

  it("handles invalid choice index", () => {
    const node = dialogueRunner.selectChoice(99);
    expect(node).toBeNull();
  });

  it("returns to start from quest_check decline", () => {
    dialogueRunner.selectChoice(1); // "J'ai une quête ?"
    expect(dialogueRunner.currentNode()!.id).toBe("quest_check");
    const node = dialogueRunner.selectChoice(1); // "Peut-être plus tard"
    expect(node).not.toBeNull();
    expect(node!.id).toBe("start");
  });

  it("executes onSelect actions when choosing", () => {
    dialogueRunner.selectChoice(1); // "J'ai une quête ?"
    const node = dialogueRunner.selectChoice(0); // "Oui, donne-la moi !"
    expect(node).not.toBeNull();
    expect(questStore.isActive("forge_first_blood")).toBe(true);
  });
});

describe("dialogueRunner with conditions", () => {
  beforeEach(() => {
    dialogueRunner.register(CONDITIONAL_DIALOGUE);
  });

  it("shows level-gated choices when condition met (level >= 5)", () => {
    configureConditions({ getLevel: () => 10 });
    dialogueRunner.start("conditional_dialogue");

    // With level 10, choice 0 ("Je suis niveau 5+") should pass conditions
    const node = dialogueRunner.selectChoice(0);
    expect(node).not.toBeNull();
    expect(node!.id).toBe("high_level");
  });

  it("hides level-gated choices when condition not met", () => {
    configureConditions({ getLevel: () => 2 });
    dialogueRunner.start("conditional_dialogue");

    // With level 2, choice 0 requires level >= 5 -> not in filtered list
    // Choice 1 requires level <= 4 -> yes
    const node = dialogueRunner.selectChoice(0); // "Je suis bas niveau" (first in filtered)
    expect(node).not.toBeNull();
    expect(node!.id).toBe("low_level");
  });

  it("allows neutral choice regardless of level", () => {
    configureConditions({ getLevel: () => 2 });
    dialogueRunner.start("conditional_dialogue");

    // Filtered choices: [low_level (index 0), neutral (index 1)]
    const node = dialogueRunner.selectChoice(1); // "Option neutre"
    expect(node).not.toBeNull();
    expect(node!.id).toBe("neutral");
  });
});

describe("dialogueRunner subscribe", () => {
  beforeEach(() => {
    dialogueRunner.register(TEST_DIALOGUE);
  });

  it("notifies on start", () => {
    let calls = 0;
    const unsub = dialogueRunner.subscribe(() => calls++);
    dialogueRunner.start("test_dialogue");
    expect(calls).toBeGreaterThanOrEqual(1);
    unsub();
  });

  it("notifies on stop", () => {
    dialogueRunner.start("test_dialogue");
    let calls = 0;
    const unsub = dialogueRunner.subscribe(() => calls++);
    dialogueRunner.stop();
    expect(calls).toBeGreaterThanOrEqual(1);
    unsub();
  });
});
