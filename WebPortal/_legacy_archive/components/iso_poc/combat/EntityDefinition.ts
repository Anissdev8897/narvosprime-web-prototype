/**
 * EntityDefinition.ts - Schemas unifies pour personnages, monstres et NPC
 * du POC NARVOS PRIME.
 *
 * Tous les acteurs du jeu (joueur, allies, ennemis, boss) partagent la meme
 * structure `EntityDefinition`. Les variations specifiques (controle joueur,
 * IA, niveau, type) sont des champs optionnels du meme schema.
 *
 * Ces types correspondent au format des fichiers JSON dans
 * `public/configs/iso_poc/`.
 */

import type {
  AnimationState,
  CharacterStats,
  Faction,
  GridCell,
  Spell,
} from "./CombatTypes";

/**
 * Type d'entite — determine le comportement runtime (UI, IA, contraintes).
 */
export type EntityKind = "player" | "monster" | "npc" | "boss" | "elite";

export type AiBehavior =
  | "passive"          // ne fait rien
  | "defensive"        // contre-attaque seulement
  | "aggressive"       // engage la cible la plus proche
  | "tactical"         // garde distance + sorts longs
  | "swarm"            // fonce groupe
  | "boss";            // pattern scripte

export interface ModelConfig {
  /** GLB de base (T-pose ou idle). Le mesh + skeleton viennent de ce fichier. */
  basePath: string;
  /** Map des animations -> path GLB (ou clip name dans le base GLB). */
  animations: Partial<Record<AnimationState, string>>;
  /** Echelle a appliquer (1 par defaut). */
  scale?: number;
  /** Offset Y en unites monde (0 par defaut). Utile si le mesh ne pose pas a y=0. */
  yOffset?: number;
  /** Rotation initiale Y en radians (Math.PI = face camera). */
  rotationY?: number;
}

/**
 * Definition canonique d'une entite — applicable a tout acteur du jeu.
 *
 * Pour un personnage joueur :          kind="player",   stats + spells, no aiBehavior
 * Pour un monstre normal :             kind="monster",  aiBehavior, level
 * Pour un boss :                       kind="boss",     phases scriptees
 * Pour un PNJ marchand :               kind="npc",      pas de stats, pas de spells
 */
export interface EntityDefinition {
  id: string;
  name: string;
  kind: EntityKind;
  faction: Faction;

  /** Classe/role en cas de player ou monstre nomme. */
  classId?: string;

  model: ModelConfig;

  /** Stats de base. Pour npc, peut etre absent. */
  stats?: CharacterStats;

  /** Sorts de base. Pour monstre/IA, c'est aussi son arsenal. */
  spellIds?: string[];

  /** Niveau (monstres). 1 par defaut. */
  level?: number;

  /** Comportement IA (uniquement si kind != "player"). */
  aiBehavior?: AiBehavior;

  /** Description / lore (UI). */
  description?: string;
}

/**
 * Classe / role jouable — donne stats de base + spells de depart.
 * Charge depuis `configs/classes.json`.
 */
export interface ClassDefinition {
  id: string;
  name: string;
  faction: Faction;
  description: string;
  /** Stats de base accordees au niveau 1. */
  baseStats: CharacterStats;
  /** Sorts de depart (ids). */
  startingSpells: string[];
  /** Modele 3D par defaut associe (peut etre override). */
  defaultModelId?: string;
}

/**
 * Configuration d'une map 3D.
 * Charge depuis `configs/maps_3d.json`.
 */
export interface Map3DConfig {
  id: string;
  name: string;
  /** Path du GLB de la map. Si vide, plane test arena. */
  glbPath?: string;
  /** Dimensions de la grille tactique. */
  grid: { width: number; height: number; cellSize: number };
  /** Couleur de fond du Canvas. */
  bgColor?: string;
  /** Couleur du sol (si pas de glbPath). */
  groundColor?: string;
  /** Lighting preset id (ex: "akarlys_day", "fungaria_dusk"). */
  lightingPreset?: string;
  /** Faction dominante (decor influencé). */
  faction?: Faction;
  description?: string;
}

/**
 * Point de spawn sur une map.
 * Charge depuis `configs/spawn_points.json`.
 */
export interface SpawnPoint {
  mapId: string;
  cell: GridCell;
  /** Type d'entite acceptee. Si absent, accepte tout. */
  acceptKinds?: EntityKind[];
  /** Faction acceptee. Si absent, accepte tout. */
  acceptFactions?: Faction[];
  /** Tag (ex: "player_start", "boss", "wave_1"). */
  tag?: string;
  /** Rotation initiale (radians). */
  rotationY?: number;
}

/**
 * Personnage joueur preconfigure (pour tests rapides du POC).
 * Charge depuis `configs/characters.json`.
 *
 * En vrai jeu, les personnages sont crees par l'utilisateur via
 * un menu de creation, mais pour le POC on a 1-3 personnages tout faits.
 */
export interface CharacterDefinition extends EntityDefinition {
  kind: "player";
  /** Map de depart pour ce perso. */
  startMapId: string;
  /** Cellule de spawn par defaut. */
  startCell: GridCell;
}

/**
 * Definition de monstre — extend EntityDefinition avec champs IA.
 * Charge depuis `configs/monsters.json`.
 */
export interface MonsterDefinition extends EntityDefinition {
  kind: "monster" | "boss" | "elite";
  level: number;
  aiBehavior: AiBehavior;
  /** XP donne au joueur si tue. */
  xpReward?: number;
  /** Drops simples (ids items). Pour POC, juste pour tests. */
  drops?: string[];
}

/**
 * Banque consolidee de toutes les configs chargees.
 */
export interface EntityRegistry {
  classes: Record<string, ClassDefinition>;
  spells: Record<string, Spell>;
  characters: Record<string, CharacterDefinition>;
  monsters: Record<string, MonsterDefinition>;
  maps: Record<string, Map3DConfig>;
  spawnPoints: SpawnPoint[];
}
