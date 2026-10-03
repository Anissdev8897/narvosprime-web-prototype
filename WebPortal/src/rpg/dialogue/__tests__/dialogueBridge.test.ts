// ══════════════════════════════════════════════════════════════════════════════
// dialogue/__tests__/dialogueBridge.test.ts — Tests du pont EventBus
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from "vitest";

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

// EventBus mock — utilise une référence de module (pas de variable hoisted)
vi.mock("../../runtime/core/EventBus", () => {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    eventBus: {
      on: vi.fn((type: string, handler: (...args: unknown[]) => void) => {
        handlers[type] = handler;
        return () => { delete handlers[type]; };
      }),
      emit: vi.fn(),
      off: vi.fn(),
      clear: vi.fn(),
    },
    // Export handlers pour les tests
    __handlers: handlers,
  };
});

// Import STATIQUE du module mocké. `require()` n'est pas résolvable ici : la
// suite tourne en ESM sous Vite, et le résolveur CommonJS ne connaît pas les
// chemins de Vite — d'où le « Cannot find module » qui faisait tomber les 3 tests.
// `vi.mock` étant hoisté, cet import reçoit bien le mock, pas le vrai EventBus.
import * as eventBusModule from "../../runtime/core/EventBus";
import { initDialogueBridge, resetDialogueBridge } from "../dialogueBridge";
import { dialogueStore } from "../dialogueStore";
import { dialogueRunner } from "../dialogueRunner";
import type { DialogueDef } from "../types";

const { eventBus } = eventBusModule;
/** `__handlers` n'existe que sur le mock — le type réel du module l'ignore. */
const mockHandlers = (eventBusModule as unknown as {
  __handlers: Record<string, (...args: unknown[]) => void>;
}).__handlers;

const TEST_DIALOGUE: DialogueDef = {
  id: "bridge_test",
  npcFolder: "bridge_npc",
  npcName: "Bridge Test",
  startNode: "start",
  nodes: [
    {
      id: "start",
      text: "Bonjour du bridge.",
      speaker: "Bridge Test",
    },
  ],
};

beforeEach(() => {
  storage.clear();
  resetDialogueBridge();
  dialogueRunner.clearRegistry();
  dialogueRunner.register(TEST_DIALOGUE);
  // `globals: false` dans vitest.config → pas de clearMocks automatique.
  // Sans ça, le test « ne s'abonne qu'une fois » compte aussi les abonnements
  // des tests précédents et échoue pour une raison sans rapport.
  vi.clearAllMocks();
});

describe("dialogueBridge", () => {
  it("initializes event bus listeners", () => {
    initDialogueBridge();
    expect(eventBus.on).toHaveBeenCalledWith("dialogue:start", expect.any(Function));
  });

  it("opens dialogue store on dialogue:start event", () => {
    initDialogueBridge();

    const handler = mockHandlers["dialogue:start"];
    expect(handler).toBeDefined();
    handler({ dialogueId: "bridge_test" });

    expect(dialogueStore.isOpen).toBe(true);
    expect(dialogueStore.get().dialogueId).toBe("bridge_test");
  });

  it("does not re-initialize", () => {
    initDialogueBridge();
    initDialogueBridge();

    const calls = (eventBus.on as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: [string]) => c[0] === "dialogue:start"
    );
    // Should only subscribe once
    expect(calls).toHaveLength(1);
  });
});
