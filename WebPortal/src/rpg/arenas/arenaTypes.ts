// ══════════════════════════════════════════════════════════════════════════════
// arenas/arenaTypes.ts — Types partagés pour les arènes tactiques
//
// Définit les structures de données pour le cover, les zones de trigger, les
// vagues d'ennemis, et les configurations tactiques par map.
//
// Chaque map de combat peut avoir :
//   • Cover points (hard / soft / hybrid)
//   • Trigger zones (entry, boss, encounter, safe)
//   • Encounter waves (patterns d'apparition progressifs)
//   • Tactical routes (chemins de flanking / sniper)
// ══════════════════════════════════════════════════════════════════════════════

/** Type de cover */
export type CoverKind = "hard" | "soft" | "hybrid";

/** État du cover */
export type CoverState = "static" | "moveable" | "moving" | "dynamic";

/** Hauteur de cover */
export type CoverHeight = "low" | "high";

/** Un point de couvert dans l'arène */
export interface CoverPoint {
  /** Identifiant unique. Auto-généré si omis (par le store). */
  id?: string;
  pos: [number, number, number];
  size: [number, number, number];
  kind: CoverKind;
  state: CoverState;
  height: CoverHeight;
  /** Label lisible pour l'éditeur */
  label: string;
  /** true = generé automatiquement, modifiable en bloc */
  gen?: boolean;
}

/** Type de zone de trigger */
export type TriggerKind = "entry" | "boss" | "encounter" | "safe" | "no_mans_land" | "vantage" | "arena";

/** Zone trigger sur la map (déclencheur logique) */
export interface TriggerZone {
  /** Identifiant unique. Auto-généré si omis (par le store). */
  id?: string;
  kind: TriggerKind;
  center: [number, number, number];
  radius: number;
  label: string;
  /** Actif dès le départ ? Sinon, activé par un autre trigger/event */
  enabled: boolean;
  /** Id du trigger parent (ex: entry active encounter) */
  activates?: string[];
  /** true = généré automatiquement */
  gen?: boolean;
}

/** Direction d'arrivée des renforts */
export type SpawnDirection = "front" | "left" | "right" | "rear";

/** Une courbe (curveball) qui peut survenir dans une vague */
export type CurveballKind = "smoke" | "quake" | "cover_change" | "darkness" | "reinforcement";

/** Un spawn au sein d'une vague */
export interface WaveSpawn {
  /** Folder du NPC (dans npcCatalog) */
  folder: string;
  /** Combien d'instances */
  count: number;
  /** Position de spawn relative */
  pos: [number, number, number];
  /** Direction d'où ils arrivent (pour renforts) */
  fromDirection?: SpawnDirection;
  /** Délai en ms après le début de la vague */
  delayMs?: number;
  /** Taille de meute (1-5, défaut 1) */
  packSize?: number;
}

/** Une vague d'ennemis */
export interface EncounterWave {
  /** Identifiant unique. Auto-généré si omis (par le store). */
  id?: string;
  label: string;
  /** Délai en ms après début du combat ou vague précédente */
  delayMs: number;
  spawns: WaveSpawn[];
  /** Courbes optionnelles qui changent le déroulement */
  curveballs?: CurveballKind[];
  /** Si true, attend que la vague précédente soit finie pour démarrer */
  waitPrevious?: boolean;
}

/** Type de route tactique */
export type RouteKind =
  | "main"
  | "flank_left"
  | "flank_right"
  | "sniper_nest"
  | "ninja_path"
  | "retreat";

/** Une route tactique dans l'arène */
export interface TacticalRoute {
  /** Identifiant unique. */
  id: string;
  kind: RouteKind;
  label: string;
  waypoints: [number, number, number][];
  /** Archétypes recommandés pour cette route */
  recommendedFor?: string[];
}

/** Configuration complète d'une arène */
export interface ArenaConfig {
  /** MapId correspondant */
  mapId: string;
  /** Nom d'affichage */
  name: string;
  /** Description narrative */
  description: string;
  /** Type d'arène */
  arenaType: "boss" | "expedition" | "pvp";
  /** Faction dominante */
  faction: string;
  /** Points de cover */
  covers: CoverPoint[];
  /** Zones de trigger */
  triggers: TriggerZone[];
  /** Vagues d'ennemis */
  waves: EncounterWave[];
  /** Routes tactiques */
  routes: TacticalRoute[];
  /** Nombre de chunks GLB */
  chunkCount: number;
  /** Recommandations de NPC (pour seed initial) */
  recommendedNpcs?: {
    folder: string;
    pos: [number, number, number];
    level: number;
    rank: "mob" | "boss";
    packSize?: number;
    respawnSec?: number;
    aggroRange?: number;
    attackRange?: number;
  }[];
}
