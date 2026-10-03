// ══════════════════════════════════════════════════════════════════════════════
// dialogue/types.ts — Types du système de dialogues (noeuds, choix, conditions,
// actions). Structure YAML compatible pour les dialogues narratifs.
// ══════════════════════════════════════════════════════════════════════════════

// ── Conditions ───────────────────────────────────────────────────────────────
export type DialogueConditionType =
  | "quest_active"
  | "quest_completed"
  | "quest_not_active"
  | "quest_not_completed"
  | "reputation_min"
  | "reputation_max"
  | "level_min"
  | "level_max"
  | "has_item"
  | "faction"
  | "flag";

export interface DialogueCondition {
  type: DialogueConditionType;
  /** Paramètres (ex: questId, faction, min, max…). */
  params: Record<string, string | number | boolean>;
}

// ── Actions ──────────────────────────────────────────────────────────────────
export type DialogueActionType =
  | "give_quest"
  | "complete_quest"
  | "add_reputation"
  | "teleport"
  | "give_item"
  | "remove_item"
  | "set_flag"
  | "clear_flag"
  | "open_shop"
  | "spawn_npc"
  | "change_faction_relation"
  | "set_global_flag"
  | "play_sound"
  | "play_animation"
  | "open_ui"
  | "nop";

export interface DialogueAction {
  type: DialogueActionType;
  params: Record<string, string | number | boolean>;
}

// ── Noeuds ───────────────────────────────────────────────────────────────────
export interface DialogueChoice {
  /** Texte du choix affiché au joueur. */
  text: string;
  /** ID du noeud cible. */
  nextNode: string;
  /** Conditions pour que ce choix apparaisse. */
  conditions?: DialogueCondition[];
  /** Actions déclenchées quand le joueur choisit cette option. */
  onSelect?: DialogueAction[];
}

export interface DialogueNode {
  /** Identifiant unique dans le dialogue. */
  id: string;
  /** Texte affiché (bulle du PNJ). """
   *  Supporte les marqueurs {player} (nom du joueur). */
  text: string;
  /** Locuteur affiché (défaut = NPC name dans DialogueDef). */
  speaker?: string;
  /** Portrait asset (nom de fichier sans extension). */
  portrait?: string;
  /** Choix proposés au joueur. Si vide = fin du dialogue. */
  choices?: DialogueChoice[];
  /** Actions exécutées en entrant dans ce noeud. */
  onEnter?: DialogueAction[];
  /** Actions exécutées en quittant ce noeud. */
  onExit?: DialogueAction[];
  /** Conditions pour que ce noeud soit accessible. */
  conditions?: DialogueCondition[];
}

// ── Définition complète d'un dialogue ───────────────────────────────────────
export interface DialogueDef {
  /** Identifiant unique (ex: "maitre_forgeron"). */
  id: string;
  /** Titre du dialogue (usage debug / éditeur). */
  title?: string;
  /** NPC associé (folder du catalogue npcCatalog). */
  npcFolder?: string;
  /** NPC label (affiché dans la bulle si speaker non précisé). */
  npcName?: string;
  /** ID du noeud de départ. */
  startNode: string;
  /** Tous les noeuds. */
  nodes: DialogueNode[];
  /** Tags pour filtrage / catégorisation. */
  tags?: string[];
}

// ── État runtime d'un dialogue actif ─────────────────────────────────────────
export interface ActiveDialogue {
  def: DialogueDef;
  currentNodeId: string;
  /** Historique des noeuds visités (pour le rollback si besoin). */
  history: string[];
  /** Variables du dialogue (flags temporaires). */
  vars: Record<string, string | number | boolean>;
}

// ── État de l'UI dialogues ───────────────────────────────────────────────────
export interface DialogueUiState {
  open: boolean;
  dialogueId: string | null;
  currentNode: DialogueNode | null;
  speakerName: string;
  speakerPortrait: string | null;
}

/** Registre de tous les dialogues disponibles. */
export type DialogueRegistry = Map<string, DialogueDef>;
