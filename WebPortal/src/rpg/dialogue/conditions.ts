// ══════════════════════════════════════════════════════════════════════════════
// dialogue/conditions.ts — Évaluateur de conditions pour dialogues
//
// Vérifie conditions runtime : quêtes, réputation, niveau, items, flags.
// ══════════════════════════════════════════════════════════════════════════════

import type { DialogueCondition } from "./types";
import { questStore } from "../quests/questStore";
import { reputationStore } from "../reputation/reputationStore";
import type { FactionId } from "../runtime/core/worldTypes";

// ── Point d'injection pour les dépendances externes (niveau joueur, inventaire) ─
// Ces fonctions sont des valeurs par défaut ; l'appelant peut les surcharger
// via configureConditions() pour coller à son système de jeu.

export interface ConditionContext {
  /** Niveau courant du joueur. */
  getLevel: () => number;
  /** Vérifie si le joueur possède un item (par id). */
  hasItem: (itemId: string) => boolean;
  /** Vérifie si un flag global est positionné. */
  hasFlag: (flag: string) => boolean;
}

const defaultCtx: ConditionContext = {
  getLevel: () => 1,
  hasItem: () => false,
  hasFlag: () => false,
};

let ctx: ConditionContext = { ...defaultCtx };

/** Surcharge le contexte de conditions (à appeler depuis RpgGameWorld). */
export function configureConditions(overrides: Partial<ConditionContext>): void {
  ctx = { ...ctx, ...overrides };
}

/** Réinitialise le contexte (tests). */
export function resetConditions(): void {
  ctx = { ...defaultCtx };
}

// ── Évaluation ───────────────────────────────────────────────────────────────

export function evaluateCondition(cond: DialogueCondition): boolean {
  const { type, params } = cond;

  switch (type) {
    case "quest_active": {
      const questId = params.questId as string | undefined;
      return questId ? questStore.isActive(questId) : false;
    }
    case "quest_completed": {
      const questId = params.questId as string | undefined;
      return questId ? questStore.isCompleted(questId) : false;
    }
    case "quest_not_active": {
      const questId = params.questId as string | undefined;
      return questId ? !questStore.isActive(questId) : true;
    }
    case "quest_not_completed": {
      const questId = params.questId as string | undefined;
      return questId ? !questStore.isCompleted(questId) : true;
    }
    case "reputation_min": {
      const faction = params.faction as FactionId | undefined;
      const min = Number(params.min) || 0;
      if (!faction) return false;
      const rep = reputationStore.get()[faction];
      return rep >= min;
    }
    case "reputation_max": {
      const faction = params.faction as FactionId | undefined;
      const max = Number(params.max) || 0;
      if (!faction) return false;
      const rep = reputationStore.get()[faction];
      return rep <= max;
    }
    case "level_min": {
      const min = Number(params.min) || 1;
      return ctx.getLevel() >= min;
    }
    case "level_max": {
      const max = Number(params.max) || 1;
      return ctx.getLevel() <= max;
    }
    case "has_item": {
      const itemId = params.itemId as string | undefined;
      return itemId ? ctx.hasItem(itemId) : false;
    }
    case "faction": {
      const required = params.faction as FactionId | undefined;
      // La faction du joueur est déterminée par le système de classes/choix.
      // On utilise le contexte ou le paramètre playerFaction passé à l'évaluation.
      const playerFaction = params.playerFaction as FactionId | undefined;
      return required ? required === playerFaction : false;
    }
    case "flag": {
      const flag = params.flag as string | undefined;
      return flag ? ctx.hasFlag(flag) : false;
    }
    default:
      return false;
  }
}

/** Évalue un tableau de conditions (ET). true si aucune condition ou toutes vraies. */
export function evaluateConditions(conditions?: DialogueCondition[]): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every(evaluateCondition);
}
