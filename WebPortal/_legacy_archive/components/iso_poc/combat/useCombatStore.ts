/**
 * useCombatStore.ts - Hook React pour gerer l'etat du combat tour par tour.
 *
 * Sprint 1: minimal, expose seulement l'etat et les setters de base.
 * Sprint 3: ajouter dispatchers pour cast/move/end_turn/ai_play.
 *
 * Pas de dependance externe (Zustand/Redux) pour l'instant — useReducer + Context
 * suffisent pour le POC.
 */

import { useCallback, useMemo, useReducer } from "react";
import type {
  CombatEntity,
  CombatState,
  GridCell,
  Spell,
  TurnPhase,
} from "./CombatTypes";

type Action =
  | { type: "INIT_COMBAT"; entities: CombatEntity[] }
  | { type: "SET_PHASE"; phase: TurnPhase }
  | { type: "SELECT_SPELL"; spellId: string | null }
  | { type: "SET_HOVER_CELL"; cell: GridCell | null }
  | { type: "SET_REACHABLE_CELLS"; cells: GridCell[] }
  | { type: "SET_ATTACKABLE_CELLS"; cells: GridCell[] }
  | { type: "SET_AOE_CELLS"; cells: GridCell[] }
  | { type: "MOVE_ENTITY"; entityId: string; cell: GridCell; pmCost: number }
  | { type: "CAST_SPELL"; entityId: string; spellId: string; targetCell: GridCell; targets: string[]; damage: number }
  | { type: "END_TURN" }
  | { type: "RESET" };

const INITIAL_STATE: CombatState = {
  phase: "idle",
  turnIndex: 0,
  turnNumber: 0,
  timeline: [],
  entities: {},
  selectedSpellId: null,
  hoveredCell: null,
  reachableCells: [],
  attackableCells: [],
  aoeCells: [],
};

function reducer(state: CombatState, action: Action): CombatState {
  switch (action.type) {
    case "INIT_COMBAT": {
      const entities: Record<string, CombatEntity> = {};
      action.entities.forEach((e) => (entities[e.id] = e));
      // Ordre par initiative descendante
      const timeline = [...action.entities]
        .sort((a, b) => b.stats.initiative - a.stats.initiative)
        .map((e) => e.id);
      return {
        ...state,
        entities,
        timeline,
        phase: timeline.length > 0 ? "player_turn" : "idle",
        turnIndex: 0,
        turnNumber: 1,
      };
    }

    case "SET_PHASE":
      return { ...state, phase: action.phase };

    case "SELECT_SPELL":
      return { ...state, selectedSpellId: action.spellId, attackableCells: [], aoeCells: [] };

    case "SET_HOVER_CELL":
      return { ...state, hoveredCell: action.cell };

    case "SET_REACHABLE_CELLS":
      return { ...state, reachableCells: action.cells };

    case "SET_ATTACKABLE_CELLS":
      return { ...state, attackableCells: action.cells };

    case "SET_AOE_CELLS":
      return { ...state, aoeCells: action.cells };

    case "MOVE_ENTITY": {
      const ent = state.entities[action.entityId];
      if (!ent) return state;
      const updated: CombatEntity = {
        ...ent,
        cell: action.cell,
        stats: { ...ent.stats, pm: Math.max(0, ent.stats.pm - action.pmCost) },
      };
      return {
        ...state,
        entities: { ...state.entities, [action.entityId]: updated },
      };
    }

    case "CAST_SPELL": {
      const caster = state.entities[action.entityId];
      const spell = caster?.spells.find((s) => s.id === action.spellId);
      if (!caster || !spell) return state;

      const updatedEntities: Record<string, CombatEntity> = { ...state.entities };
      updatedEntities[action.entityId] = {
        ...caster,
        stats: { ...caster.stats, pa: Math.max(0, caster.stats.pa - spell.paCost) },
      };
      action.targets.forEach((tid) => {
        const target = updatedEntities[tid];
        if (!target) return;
        const newHp = Math.max(0, target.stats.hp - action.damage);
        updatedEntities[tid] = {
          ...target,
          stats: { ...target.stats, hp: newHp },
          isDead: newHp === 0,
        };
      });
      return {
        ...state,
        entities: updatedEntities,
        selectedSpellId: null,
        attackableCells: [],
        aoeCells: [],
      };
    }

    case "END_TURN": {
      // Cycle au suivant dans la timeline
      let next = state.turnIndex + 1;
      let turnNumber = state.turnNumber;
      if (next >= state.timeline.length) {
        next = 0;
        turnNumber += 1;
      }

      // Refill PA / PM de l'entite qui prend son tour
      const entId = state.timeline[next];
      const ent = state.entities[entId];
      const updatedEntities = { ...state.entities };
      if (ent) {
        updatedEntities[entId] = {
          ...ent,
          stats: { ...ent.stats, pa: ent.stats.paMax, pm: ent.stats.pmMax },
        };
      }

      const phase: TurnPhase = ent?.isPlayer ? "player_turn" : "enemy_turn";
      return {
        ...state,
        entities: updatedEntities,
        turnIndex: next,
        turnNumber,
        phase,
        selectedSpellId: null,
        attackableCells: [],
        aoeCells: [],
      };
    }

    case "RESET":
      return INITIAL_STATE;

    default:
      return state;
  }
}

export function useCombatStore() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const initCombat = useCallback((entities: CombatEntity[]) => {
    dispatch({ type: "INIT_COMBAT", entities });
  }, []);

  const selectSpell = useCallback((spellId: string | null) => {
    dispatch({ type: "SELECT_SPELL", spellId });
  }, []);

  const setHoverCell = useCallback((cell: GridCell | null) => {
    dispatch({ type: "SET_HOVER_CELL", cell });
  }, []);

  const moveEntity = useCallback((entityId: string, cell: GridCell, pmCost: number) => {
    dispatch({ type: "MOVE_ENTITY", entityId, cell, pmCost });
  }, []);

  const castSpell = useCallback(
    (entityId: string, spellId: string, targetCell: GridCell, targets: string[], damage: number) => {
      dispatch({ type: "CAST_SPELL", entityId, spellId, targetCell, targets, damage });
    },
    []
  );

  const endTurn = useCallback(() => {
    dispatch({ type: "END_TURN" });
  }, []);

  const reset = useCallback(() => dispatch({ type: "RESET" }), []);

  const currentEntity: CombatEntity | null = useMemo(() => {
    const id = state.timeline[state.turnIndex];
    return id ? state.entities[id] || null : null;
  }, [state]);

  return {
    state,
    currentEntity,
    initCombat,
    selectSpell,
    setHoverCell,
    moveEntity,
    castSpell,
    endTurn,
    reset,
  };
}
