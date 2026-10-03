// ══════════════════════════════════════════════════════════════════════════════
// dialogue/dialogueStore.ts — État UI des dialogues (React-compatible)
//
// Singleton hors-React. Gère l'état d'affichage des dialogues :
// ouvert/fermé, noeud courant, portrait, etc.
// ══════════════════════════════════════════════════════════════════════════════

import type { DialogueUiState, DialogueDef, DialogueNode } from "./types";
import { dialogueRunner } from "./dialogueRunner";

const DEFAULT: DialogueUiState = {
  open: false,
  dialogueId: null,
  currentNode: null,
  speakerName: "",
  speakerPortrait: null,
};

let state: DialogueUiState = { ...DEFAULT };
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

export const dialogueStore = {
  get: (): DialogueUiState => state,

  /** Ouvre l'UI pour un dialogue. */
  open(dialogueId: string): boolean {
    const node = dialogueRunner.start(dialogueId);
    if (!node) return false;

    const def = dialogueRunner.getDef(dialogueId);
    state = {
      open: true,
      dialogueId,
      currentNode: node,
      speakerName: def?.npcName ?? "???",
      speakerPortrait: def?.npcFolder ?? null,
    };
    emit();
    return true;
  },

  /** Déplace vers le choix suivant. */
  selectChoice(index: number): void {
    if (!state.open) return;
    const nextNode = dialogueRunner.selectChoice(index);
    if (!nextNode) {
      // Dialogue terminé
      state = { ...DEFAULT };
      emit();
      return;
    }

    const def = dialogueRunner.getDef(state.dialogueId!);
    state = {
      ...state,
      currentNode: nextNode,
      speakerName: nextNode.speaker ?? def?.npcName ?? "???",
      speakerPortrait: nextNode.portrait ?? def?.npcFolder ?? null,
    };
    emit();
  },

  /** Ferme le dialogue. */
  close(): void {
    dialogueRunner.stop();
    state = { ...DEFAULT };
    emit();
  },

  /** true si l'UI dialogue est ouverte. */
  get isOpen(): boolean {
    return state.open;
  },

  subscribe: (l: () => void): (() => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};
