// ══════════════════════════════════════════════════════════════════════════════
// dialogue/data/index.ts — Index de tous les dialogues
//
// Point d'entrée unique pour charger tous les dialogues du jeu.
// Les dialogues sont définis en TS (type-safe) et/ou chargés depuis YAML.
// ══════════════════════════════════════════════════════════════════════════════

import type { DialogueDef } from "../types";
import { MAITRE_FORGERON_DIALOGUE } from "./maitre_forgeron";

/**
 * Catalogue de tous les dialogues chargés statiquement (TS).
 * Les dialogues YAML sont chargés dynamiquement via dialogueLoader.
 */
export const DIALOGUE_CATALOG: DialogueDef[] = [
  MAITRE_FORGERON_DIALOGUE,
];
