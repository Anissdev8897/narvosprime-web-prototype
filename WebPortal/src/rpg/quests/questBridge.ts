// ══════════════════════════════════════════════════════════════════════════════
// quests/questBridge.ts — Pont d'événements jeu → quêtes (event bridge)
//
// Découple les systèmes de jeu (combat, dialogue, inventaire, craft…) du
// questStore. Les systèmes émettent des événements génériques ; le bridge
// les route vers les bonnes méthodes record*() du store.
//
// Deux modes d'utilisation :
//   1. Appel direct : `questBridge.emit(type, payload)` depuis n'importe où.
//   2. Auto-wiring avec eventBus : subscribe le bridge aux événements du bus
//      global (si les systèmes utilisent déjà eventBus).
// ══════════════════════════════════════════════════════════════════════════════

import { questStore } from "./questStore";
import type { QuestDef } from "./questCatalog";

// ── Typage des payloads ───────────────────────────────────────────────────────

export interface QuestKillPayload {
  /** Folder d'ennemi (optionnel). */
  folder?: string;
}

export interface QuestCollectPayload {
  /** Fonction retournant la quantité possédée d'un item. */
  have: (itemId: string) => number;
}

export interface QuestReachPayload {
  mapId: string;
  x: number;
  z: number;
}

export interface QuestTalkPayload {
  npcId: string;
}

export interface QuestSurvivePayload {
  /** Temps écoulé depuis le dernier appel (secondes). */
  dt: number;
}

export interface QuestEscortPayload {
  npcId: string;
}

export interface QuestUsePayload {
  itemId: string;
}

export interface QuestCraftPayload {
  itemId: string;
}

/** Union de tous les payloads possibles pour le pont d'événements. */
export type QuestEventPayload =
  | ({ type: "quest:kill" } & QuestKillPayload)
  | ({ type: "quest:collect" } & QuestCollectPayload)
  | ({ type: "quest:reach" } & QuestReachPayload)
  | ({ type: "quest:talk" } & QuestTalkPayload)
  | ({ type: "quest:survive" } & QuestSurvivePayload)
  | ({ type: "quest:escort" } & QuestEscortPayload)
  | ({ type: "quest:use" } & QuestUsePayload)
  | ({ type: "quest:craft" } & QuestCraftPayload);

// ── Bridge ─────────────────────────────────────────────────────────────────────

/**
 * Pont d'événements quêtes. Point d'entrée unique pour tous les systèmes
 * de jeu qui veulent déclencher la progression des quêtes.
 *
 * Usage :
 * ```ts
 * import { questBridge } from "../quests/questBridge";
 *
 * // Après un kill :
 * questBridge.emitKill({ folder: "space_ship" });
 *
 * // Quand l'inventaire change :
 * questBridge.emitCollect(() => getItemCount("fragment_vie"));
 * ```
 */
export const questBridge = {
  /**
   * Émet un événement générique vers le questStore.
   * Retourne les quêtes qui viennent d'être complétées par cet événement.
   */
  emit(event: QuestEventPayload): QuestDef[] {
    return questStore.handleEvent(event.type, event as unknown as Record<string, unknown>);
  },

  /** Raccourci typé pour les kills. */
  emitKill(payload: QuestKillPayload = {}): QuestDef[] {
    return questStore.handleEvent("quest:kill", payload as unknown as Record<string, unknown>);
  },

  /** Raccourci typé pour les collectes. */
  emitCollect(have: (itemId: string) => number): QuestDef[] {
    return questStore.handleEvent("quest:collect", { have } as unknown as Record<string, unknown>);
  },

  /** Raccourci typé pour les déplacements. */
  emitReach(payload: QuestReachPayload): QuestDef[] {
    return questStore.handleEvent("quest:reach", payload as unknown as Record<string, unknown>);
  },

  /** Raccourci typé pour les dialogues. */
  emitTalk(payload: QuestTalkPayload): QuestDef[] {
    return questStore.handleEvent("quest:talk", payload as unknown as Record<string, unknown>);
  },

  /** Raccourci typé pour la survie. */
  emitSurvive(payload: QuestSurvivePayload): QuestDef[] {
    return questStore.handleEvent("quest:survive", payload as unknown as Record<string, unknown>);
  },

  /** Raccourci typé pour les escortes. */
  emitEscort(payload: QuestEscortPayload): QuestDef[] {
    return questStore.handleEvent("quest:escort", payload as unknown as Record<string, unknown>);
  },

  /** Raccourci typé pour l'utilisation d'objets. */
  emitUse(payload: QuestUsePayload): QuestDef[] {
    return questStore.handleEvent("quest:use", payload as unknown as Record<string, unknown>);
  },

  /** Raccourci typé pour le craft. */
  emitCraft(payload: QuestCraftPayload): QuestDef[] {
    return questStore.handleEvent("quest:craft", payload as unknown as Record<string, unknown>);
  },
};

// ── Auto-wiring avec eventBus ─────────────────────────────────────────────────
// Branche les événements du bus global vers le questBridge pour que n'importe
// quel système puisse déclencher la progression des quêtes sans import direct.

import { eventBus } from "../runtime/core/EventBus";

/**
 * Active le pont automatique entre l'eventBus global et le système de quêtes.
 * Retourne une fonction de nettoyage (à appeler au démontage / changement de map).
 *
 * Usage :
 * ```ts
 * useEffect(() => wireQuestBridge(), []);
 * ```
 */
export function wireQuestBridge(): () => void {
  const unsubs: (() => void)[] = [];

  // Événement générique quest:objective → routé vers questBridge qui
  // dispatche vers la bonne méthode record*() selon le kind.
  unsubs.push(
    eventBus.on("quest:objective", (payload) => {
      questBridge.emit(payload as unknown as QuestEventPayload);
    })
  );

  // Branchements sur des événements métier existants :
  // (décommente et adapte selon les événements de ton jeu)
  //
  // eventBus.on("npc:dialogue", (p) => questBridge.emitTalk({ npcId: p.npcId }));
  // eventBus.on("inventory:changed", (p) => questBridge.emitCollect(p.have));
  // eventBus.on("craft:completed", (p) => questBridge.emitCraft({ itemId: p.itemId }));
  // etc.

  return () => unsubs.forEach((fn) => fn());
}
