// ══════════════════════════════════════════════════════════════════════════════
// input/types.ts — Types fondamentaux du système d'input amélioré (EnhancedInput-like)
//
// Définit les types de valeur d'action, les énumérations et les structures de
// base partagées par tous les autres modules du système d'input.
// ══════════════════════════════════════════════════════════════════════════════

/** Types de valeur que peut produire une Input Action. */
export enum EInputValueType {
  /** Valeur booléenne (bouton pressé / relâché). */
  Digital = 'digital',
  /** Valeur 1D : nombre entre -1 et 1 (ex: accélérateur). */
  Axis1D = 'axis1d',
  /** Valeur 2D : paire [x, y] entre -1 et 1 (ex: stick de mouvement). */
  Axis2D = 'axis2d',
  /** Valeur 3D : triplet [x, y, z] entre -1 et 1 (ex: accéléromètre). */
  Axis3D = 'axis3d',
}

/** Types d'action d'entrée (comme EnhancedInput UE). */
export type InputActionValue = boolean | number | [number, number] | [number, number, number];

/** Type de trigger. */
export enum ETriggerType {
  /** Se déclenche immédiatement à la pression. */
  Pressed = 'pressed',
  /** Se déclenche après un temps de maintien. */
  Hold = 'hold',
  /** Se déclenche sur appui rapide (press + release dans une fenêtre). */
  Tap = 'tap',
  /** Se déclenche sur deux appuis rapides successifs. */
  DoubleTap = 'doubleTap',
  /** Se déclenche périodiquement tant que la touche est maintenue. */
  Pulse = 'pulse',
  /** Se déclenche uniquement au relâchement. */
  Released = 'released',
}

/** Type de modificateur d'entrée. */
export enum EModifierType {
  /** Zone morte : ignore les valeurs en dessous d'un seuil. */
  DeadZone = 'deadZone',
  /** Multiplie la valeur par un facteur. */
  Scalar = 'scalar',
  /** Inverse la valeur (multiplie par -1). */
  Negate = 'negate',
  /** Réorganise les axes (ex: YZ -> XY). */
  Swizzle = 'swizzle',
}

/** Priorités des contextes de mapping (plus haut = prioritaire). */
export enum EContextPriority {
  /** UI / menus système (overlay). */
  UI = 0,
  /** Boîtes de dialogue / popups. */
  Dialogue = 10,
  /** Menu de pause / paramètres. */
  Menu = 20,
  /** Gameplay actif (jeu). */
  Game = 30,
}

/** Configuration d'un trigger. */
export interface TriggerConfig {
  type: ETriggerType;
  /** Durée de maintien requise pour Hold (ms). */
  holdTimeMs?: number;
  /** Fenêtre de temps pour Tap/DoubleTap (ms). */
  tapWindowMs?: number;
  /** Intervalle entre pulses pour Pulse (ms). */
  pulseIntervalMs?: number;
}

/** Configuration d'un modificateur. */
export interface ModifierConfig {
  type: EModifierType;
  /** Seuil pour DeadZone (0-1). */
  threshold?: number;
  /** Facteur multiplicatif pour Scalar. */
  factor?: number;
  /** Ordre des axes pour Swizzle (ex: [1,0,2] pour YXZ). */
  swizzleOrder?: number[];
}

/** Mapping d'une action vers une ou plusieurs touches. */
export interface KeyMapping {
  /** Codes des touches (e.code) pour cette action. */
  keys: string[];
  /** Modificateurs optionnels appliqués à cette action. */
  modifiers?: ModifierConfig[];
  /** Trigger optionnel pour cette action. */
  trigger?: TriggerConfig;
}

/** Définition complète d'une Input Action. */
export interface InputActionDef {
  /** Identifiant unique de l'action (ex: 'move'). */
  id: string;
  /** Nom affiché dans l'UI. */
  displayName: string;
  /** Groupe d'affichage (ex: 'Déplacement', 'Combat'). */
  group: string;
  /** Type de valeur produite. */
  valueType: EInputValueType;
  /** Valeur par défaut (touches attribuées). */
  defaultMappings: string[];
  /** Modificateurs par défaut. */
  defaultModifiers?: ModifierConfig[];
  /** Trigger par défaut. */
  defaultTrigger?: TriggerConfig;
  /** Description courte (tooltip). */
  description?: string;
}

/** État d'un trigger en cours d'évaluation. */
export interface TriggerState {
  /** Timestamp de la première pression (ms). */
  pressedAt: number;
  /** Timestamp du relâchement (ms). */
  releasedAt: number;
  /** La touche est-elle actuellement pressée ? */
  isPressed: boolean;
  /** A-t-elle été pressée depuis la dernière évaluation ? */
  wasPressed: boolean;
  /** A-t-elle été relâchée depuis la dernière évaluation ? */
  wasReleased: boolean;
}

/** Sortie d'un trigger après évaluation (donne l'événement consommable). */
export interface TriggerOutput {
  /** L'action s'est-elle déclenchée cette frame ? */
  triggered: boolean;
  /** Valeur actuelle de l'action. */
  value: InputActionValue;
  /** Intensité (0-1) de l'action déclenchée. */
  elapsed: number;
  /** Intensité (0f-1f). */
  intensity: number;
}
