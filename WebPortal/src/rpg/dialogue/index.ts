// ══════════════════════════════════════════════════════════════════════════════
// dialogue/index.ts — Point d'entrée du système de dialogues
//
// Exports publics : types, systèmes, UI.
// ══════════════════════════════════════════════════════════════════════════════

export type {
  DialogueDef,
  DialogueNode,
  DialogueChoice,
  DialogueCondition,
  DialogueAction,
  ActiveDialogue,
  DialogueUiState,
  DialogueConditionType,
  DialogueActionType,
  DialogueRegistry,
} from "./types";
export {
  dialogueRunner,
} from "./dialogueRunner";
export {
  dialogueStore,
} from "./dialogueStore";
export {
  initDialogueBridge,
  resetDialogueBridge,
} from "./dialogueBridge";
export {
  loadDialoguesFromYaml,
  parseYamlDialogue,
} from "./dialogueLoader";
export {
  evaluateCondition,
  evaluateConditions,
  configureConditions,
  resetConditions,
  type ConditionContext,
} from "./conditions";
export {
  executeAction,
  executeActions,
  configureActions,
  resetActions,
  type ActionContext,
} from "./actions";
export { DialogueUi, useStartDialogue } from "./DialogueUi";

// Catalogue des dialogues (TS)
export { DIALOGUE_CATALOG } from "./data/index";
