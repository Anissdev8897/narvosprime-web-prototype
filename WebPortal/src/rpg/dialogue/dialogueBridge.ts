// ══════════════════════════════════════════════════════════════════════════════
// dialogue/dialogueBridge.ts — Pont EventBus ↔ système de dialogues
//
// Connecte les événements du monde aux dialogues :
//   - dialogue:start → démarre un dialogue avec un PNJ
//   - dialogue:action → actions exécutées par les dialogues (quêtes, rep…)
// ══════════════════════════════════════════════════════════════════════════════

import { eventBus } from "../runtime/core/EventBus";
import { dialogueStore } from "./dialogueStore";

// ── Types d'événements dialogue ──────────────────────────────────────────────

export interface DialogueStartEvent {
  dialogueId: string;
  npcId?: string;
}

export interface DialogueActionEvent {
  action: string;
  questId?: string;
  itemId?: string;
  quantity?: number;
  flag?: string;
  value?: string | number | boolean;
  npcFolder?: string;
  x?: number;
  z?: number;
  factionA?: string;
  factionB?: string;
  relation?: string;
  animationId?: string;
}

// ── Étendre WorldEvents ─────────────────────────────────────────────────────

declare module "../runtime/core/worldTypes" {
  interface WorldEvents {
    "dialogue:start": DialogueStartEvent;
    "dialogue:action": DialogueActionEvent;
  }
}

// ── Initialisation ───────────────────────────────────────────────────────────

let initialized = false;

/** Abonne le bus aux événements dialogue. À appeler une fois au boot. */
export function initDialogueBridge(): void {
  if (initialized) return;
  initialized = true;

  eventBus.on("dialogue:start", (payload) => {
    dialogueStore.open(payload.dialogueId);
  });

  // Les actions sont déjà exécutées par actions.ts via executeActions.
  // Ce bridge relaye les événements dialogue:action vers d'autres systèmes
  // qui peuvent les écouter (ex: système d'inventaire, flags, etc.).
}

/** Réinitialise (tests). */
export function resetDialogueBridge(): void {
  initialized = false;
}
