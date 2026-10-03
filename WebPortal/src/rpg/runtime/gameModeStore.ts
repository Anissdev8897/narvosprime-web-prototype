// runtime/gameModeStore.ts — MODE DE JEU (normal | edit). Découple l'accès aux outils.
//
//   normal : expérience joueur verrouillée — AUCUN outil d'édition (engrenages, gizmos,
//            panneaux admin, F6-F11). Seul le noclip reste autorisé.
//   edit   : outils de construction/réglage actifs (admin uniquement).
//
// (Le 3e mode « Forge » est un ESPACE SÉPARÉ hors-jeu : écran admin Forge Map / Éditeur 3D.)
// Le mode edit n'est accessible qu'aux admins — voir editMode().
import { useSyncExternalStore } from "react";
import { isAdmin } from "./admin/AdminPanel";

export type GameMode = "normal" | "edit";

let mode: GameMode = "normal"; // défaut : jeu verrouillé
const listeners = new Set<() => void>();

export const gameModeStore = {
  get(): GameMode { return mode; },
  set(m: GameMode): void { if (m !== mode) { mode = m; for (const l of listeners) l(); } },
  toggle(): void { gameModeStore.set(mode === "edit" ? "normal" : "edit"); },
  subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; },
};

export function useGameMode(): GameMode {
  return useSyncExternalStore(gameModeStore.subscribe, gameModeStore.get, gameModeStore.get);
}

/** true = outils d'édition autorisés (admin ET mode edit). Toute UI/raccourci d'outil gate dessus. */
export function editMode(): boolean {
  return isAdmin() && mode === "edit";
}

/**
 * Version RÉACTIVE d'editMode() — à utiliser dans tout composant React dont la
 * visibilité dépend du mode admin.
 *
 * POURQUOI : `editMode()` lit `mode` directement. Un composant qui fait
 * `if (!editMode()) return null` ne se re-rend PAS quand le mode bascule — il
 * reste affiché jusqu'au prochain rendu déclenché par autre chose. C'est ce qui
 * imposait un rechargement de page après /adminmode.
 */
export function useEditMode(): boolean {
  const m = useGameMode();
  return isAdmin() && m === "edit";
}
