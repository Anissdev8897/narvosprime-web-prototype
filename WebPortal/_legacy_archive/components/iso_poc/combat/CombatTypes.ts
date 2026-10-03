/**
 * CombatTypes.ts - Types pour le combat tour par tour NARVOS PRIME
 *
 * Sprint 1: definitions de base pour preparer l'architecture, pas encore
 * implementees activement. Le POC affiche un perso anime, mais expose deja
 * ces types pour permettre l'integration progressive.
 */

import type { Vector3Tuple } from "three";

export type Faction = "AKARLYS" | "ZAYAN" | "MEZALAYIS" | "NEUTRAL";

export type AnimationState =
  | "idle"
  | "walking"
  | "running"
  | "attacking"
  | "casting"
  | "hit"
  | "death";

/** Coordonnees de cellule sur la grille tactique. */
export interface GridCell {
  x: number;
  y: number;
}

/** Cellule iso utilisee pour le rendu (centre monde). */
export interface IsoCell extends GridCell {
  worldPosition: Vector3Tuple;
  walkable: boolean;
}

export type SpellTargetMode =
  | "single"          // une cellule (ou entite)
  | "line"            // ligne droite
  | "cone"            // cone face a la cible
  | "circle"          // disque autour d'un point
  | "diamond"         // losange iso (Dofus-style)
  | "self";           // soi-meme

export interface SpellShape {
  mode: SpellTargetMode;
  range: number;        // portee max en cellules
  rangeMin?: number;    // portee min (sorts pas castable a cote)
  size?: number;        // rayon / largeur de zone
  needsLineOfSight?: boolean;
}

export interface Spell {
  id: string;
  name: string;
  faction: Faction;
  paCost: number;       // cout en Points d'Action
  cooldown?: number;    // tours
  shape: SpellShape;
  damage?: number;
  description?: string;
  castAnimation?: AnimationState;   // anim a jouer (default 'casting')
  vfxId?: string;                   // identifiant FX visuel
}

export interface CharacterStats {
  hp: number;
  hpMax: number;
  pa: number;           // Points d'Action (du tour actuel)
  paMax: number;
  pm: number;           // Points de Mouvement (du tour actuel)
  pmMax: number;
  initiative: number;   // determine l'ordre de tour
}

export interface CombatEntity {
  id: string;
  name: string;
  faction: Faction;
  modelPath: string;                          // GLB path
  animationsPath?: Record<AnimationState, string>; // mapping anim -> GLB
  cell: GridCell;
  stats: CharacterStats;
  spells: Spell[];
  isPlayer?: boolean;
  isDead?: boolean;
}

export type TurnPhase =
  | "idle"               // hors combat
  | "init"               // demarrage combat, calcul initiative
  | "player_turn"
  | "enemy_turn"
  | "ally_turn"
  | "animation"          // animation en cours, on attend
  | "victory"
  | "defeat";

export interface CombatState {
  phase: TurnPhase;
  turnIndex: number;            // qui joue (index dans timeline)
  turnNumber: number;           // round count
  timeline: string[];           // entity ids dans l'ordre d'initiative
  entities: Record<string, CombatEntity>;
  selectedSpellId: string | null;
  hoveredCell: GridCell | null;
  reachableCells: GridCell[];   // cellules accessibles avec PM restants
  attackableCells: GridCell[];  // cellules ciblees par sort selectionne
  aoeCells: GridCell[];         // cellules dans la zone d'effet preview
}
