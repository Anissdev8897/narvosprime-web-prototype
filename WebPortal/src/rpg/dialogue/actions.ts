// ══════════════════════════════════════════════════════════════════════════════
// dialogue/actions.ts — Exécuteur d'actions déclenchées par les dialogues
//
// Pont vers les systèmes existants : quêtes, réputation, event bus, etc.
// ══════════════════════════════════════════════════════════════════════════════

import type { DialogueAction } from "./types";
import { questStore } from "../quests/questStore";
import { reputationStore } from "../reputation/reputationStore";
import { eventBus } from "../runtime/core/EventBus";
import type { FactionId } from "../runtime/core/worldTypes";

// Activer l'extension WorldEvents (définie dans dialogueBridge.ts)
import type {} from "./dialogueBridge";

// ── Contexte d'exécution ─────────────────────────────────────────────────────
export interface ActionContext {
  /** Déclenche un changement de map/téléportation. */
  teleport: (mapId: string, x: number, y: number, z: number) => void;
  /** Ouvre l'UI marchand. */
  openShop: (merchantId: string) => void;
  /** Joue un son. */
  playSound: (soundId: string) => void;
  /** Ouvre une UI quelconque. */
  openUi: (uiName: string) => void;
  /** Log / debug. */
  log: (msg: string) => void;
}

const noopCtx: ActionContext = {
  teleport: () => {},
  openShop: () => {},
  playSound: () => {},
  openUi: () => {},
  log: () => {},
};

let actionCtx: ActionContext = { ...noopCtx };

export function configureActions(overrides: Partial<ActionContext>): void {
  actionCtx = { ...actionCtx, ...overrides };
}

export function resetActions(): void {
  actionCtx = { ...noopCtx };
}

// ── Exécution ────────────────────────────────────────────────────────────────

export function executeAction(action: DialogueAction): void {
  const { type, params } = action;

  switch (type) {
    case "give_quest": {
      const questId = params.questId as string | undefined;
      if (questId) questStore.accept(questId);
      break;
    }
    case "complete_quest": {
      const questId = params.questId as string | undefined;
      // Forcer la complétion via l'EventBus → le questStore écoute
      if (questId) {
        eventBus.emit("dialogue:action", {
          action: "complete_quest",
          questId,
        });
      }
      break;
    }
    case "add_reputation": {
      const faction = params.faction as FactionId | undefined;
      const amount = Number(params.amount) || 0;
      if (faction && amount) reputationStore.gain(faction, amount);
      break;
    }
    case "teleport": {
      const mapId = params.mapId as string | undefined;
      const x = Number(params.x) || 0;
      const y = Number(params.y) || 0;
      const z = Number(params.z) || 0;
      if (mapId) actionCtx.teleport(mapId, x, y, z);
      break;
    }
    case "give_item": {
      const itemId = params.itemId as string | undefined;
      if (itemId) {
        eventBus.emit("dialogue:action", {
          action: "give_item",
          itemId,
          quantity: Number(params.quantity) || 1,
        });
      }
      break;
    }
    case "remove_item": {
      const itemId = params.itemId as string | undefined;
      if (itemId) {
        eventBus.emit("dialogue:action", {
          action: "remove_item",
          itemId,
          quantity: Number(params.quantity) || 1,
        });
      }
      break;
    }
    case "set_flag": {
      const flag = params.flag as string | undefined;
      if (flag) {
        eventBus.emit("dialogue:action", {
          action: "set_flag",
          flag,
          value: params.value ?? true,
        });
      }
      break;
    }
    case "clear_flag": {
      const flag = params.flag as string | undefined;
      if (flag) {
        eventBus.emit("dialogue:action", {
          action: "clear_flag",
          flag,
        });
      }
      break;
    }
    case "open_shop": {
      const merchantId = params.merchantId as string | undefined;
      if (merchantId) actionCtx.openShop(merchantId);
      break;
    }
    case "spawn_npc": {
      eventBus.emit("dialogue:action", {
        action: "spawn_npc",
        npcFolder: params.npcFolder as string,
        x: Number(params.x) || 0,
        z: Number(params.z) || 0,
      });
      break;
    }
    case "change_faction_relation": {
      eventBus.emit("dialogue:action", {
        action: "change_faction_relation",
        factionA: params.factionA as string,
        factionB: params.factionB as string,
        relation: params.relation as string,
      });
      break;
    }
    case "set_global_flag": {
      eventBus.emit("dialogue:action", {
        action: "set_global_flag",
        flag: params.flag as string,
        value: params.value ?? true,
      });
      break;
    }
    case "play_sound": {
      const soundId = params.soundId as string | undefined;
      if (soundId) actionCtx.playSound(soundId);
      break;
    }
    case "play_animation": {
      const animId = params.animationId as string | undefined;
      if (animId) {
        eventBus.emit("dialogue:action", {
          action: "play_animation",
          animationId: animId,
        });
      }
      break;
    }
    case "open_ui": {
      const uiName = params.uiName as string | undefined;
      if (uiName) actionCtx.openUi(uiName);
      break;
    }
    case "nop":
      break;
    default:
      actionCtx.log(`[Dialogue] Unknown action: ${type}`);
  }
}

export function executeActions(actions?: DialogueAction[]): void {
  if (!actions) return;
  for (const a of actions) executeAction(a);
}
