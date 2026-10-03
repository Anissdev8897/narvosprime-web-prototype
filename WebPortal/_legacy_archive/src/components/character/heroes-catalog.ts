/**
 * heroes-catalog.ts — Catalogue centralisé des héros NARVOS PRIME.
 *
 * Source de vérité unique pour :
 *   - La liste des héros disponibles (mappée vers les GLBs réels de /models/characters/)
 *   - Leur faction (AKARLYS / ZAYAN)
 *   - Leurs stats de base
 *   - Leur description / lore
 *
 * Pourquoi ce fichier remplace `narvos-data.tsx` + `data/narvos-classes.ts` ?
 *   - narvos-classes.ts pointait vers `/models/iso_poc/` qui n'existe pas
 *   - narvos-data.tsx mélangeait sprites 2D et 3D
 *   - Ici : 100% 3D, mapping direct vers les GLBs réellement présents
 *
 * Pour ajouter un héros : ajoute une entrée + un dossier dans /models/characters/.
 */

export type Faction = "AKARLYS" | "ZAYAN";

export interface HeroDef {
  /** Identifiant unique stable (utilisé dans la DB, ne pas changer après création de persos). */
  id: string;
  /** Nom affiché. */
  displayName: string;
  /** Faction. */
  faction: Faction;
  /** Titre/rôle court. */
  roleTitle: string;
  /** Description / lore (1-3 phrases). */
  description: string;
  /** Path du dossier dans /models/characters/. */
  modelFolder: string;
  /** Échelle d'affichage en preview (1.0 = neutre). */
  previewScale?: number;
  /** Offset Y pour centrer le personnage dans le cadre preview. */
  previewYOffset?: number;
  /** Couleurs faction pour l'UI. */
  uiColors: {
    primary: string;     // accent principal (boutons hover, glow)
    secondary: string;   // accent secondaire
    bg: string;          // fond carte
  };
  /** Stats de base (gameplay FPS — HP/PV principalement, le reste optionnel). */
  stats: {
    hp: number;
    armor: number;
    shield?: number;
    speedMultiplier?: number;   // 1.0 = vitesse normale, 1.1 = +10%
  };
  /** Animations disponibles dans le merged GLB (toutes les anims Meshy AI standard). */
  animations: {
    idle: string;
    walking: string;
    running: string;
    aim?: string;
    death?: string;
  };
}

/** GLB merged Meshy AI (toujours le même nom dans chaque dossier). */
const MERGED_GLB = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations.glb";

/** Construit le path d'un model perso à partir de son folder. */
function modelPath(folder: string): string {
  return `/models/characters/${folder}/${MERGED_GLB}`;
}

/** Couleurs UI par faction. */
const FACTION_COLORS: Record<Faction, HeroDef["uiColors"]> = {
  AKARLYS: { primary: "#0ea5e9", secondary: "#38bdf8", bg: "#0c1929" },
  ZAYAN:   { primary: "#f97316", secondary: "#fb923c", bg: "#1f0c08" },
};

/** Animations standard pour les persos merged (noms tels qu'exportés par Meshy AI). */
const STANDARD_ANIMS = {
  idle: "Idle_11",
  walking: "Walking",
  running: "Running",
  aim: "Rifle_Aim_Turn_Right",
  death: "Dead",
};

/**
 * Catalogue des héros — 17 personnages avec format merged complet
 * (les 3 sans merged GLB : mercenaire_tank, profhete_alien, venom_stalker — non listés).
 */
export const HEROES_CATALOG: HeroDef[] = [
  // ── AKARLYS (Faction Humaine) ─────────────────────────────────────────────
  {
    id: "soldat_humain",
    displayName: "Soldat Humain",
    faction: "AKARLYS",
    roleTitle: "Fantassin polyvalent",
    description: "Soldat d'infanterie standard de l'armée AKARLYS. Équilibré et polyvalent, idéal pour débuter.",
    modelFolder: "soldat_humain",
    uiColors: FACTION_COLORS.AKARLYS,
    stats: { hp: 100, armor: 50 },
    animations: { idle: STANDARD_ANIMS.idle, walking: STANDARD_ANIMS.walking, running: STANDARD_ANIMS.running, aim: STANDARD_ANIMS.aim, death: STANDARD_ANIMS.death },
  },
  {
    id: "soldat_femme",
    displayName: "Soldat Femme",
    faction: "AKARLYS",
    roleTitle: "Tireuse d'élite",
    description: "Spécialiste du tir longue distance, précision supérieure aux fantassins standards.",
    modelFolder: "soldat_femme",
    uiColors: FACTION_COLORS.AKARLYS,
    stats: { hp: 85, armor: 40, speedMultiplier: 1.15 },
    animations: { idle: STANDARD_ANIMS.idle, walking: STANDARD_ANIMS.walking, running: STANDARD_ANIMS.running, aim: STANDARD_ANIMS.aim, death: STANDARD_ANIMS.death },
  },
  {
    id: "mercenaire_humain_tank",
    displayName: "Mercenaire Tank",
    faction: "AKARLYS",
    roleTitle: "Char d'assaut",
    description: "Mercenaire blindé. Bouclier renforcé et armure lourde au prix de la vitesse.",
    modelFolder: "mercenaire_humain_tank",
    uiColors: FACTION_COLORS.AKARLYS,
    stats: { hp: 160, armor: 100, shield: 50, speedMultiplier: 0.85 },
    animations: { idle: STANDARD_ANIMS.idle, walking: STANDARD_ANIMS.walking, running: STANDARD_ANIMS.running, aim: STANDARD_ANIMS.aim, death: STANDARD_ANIMS.death },
  },
  {
    id: "soldat_mercenaire",
    displayName: "Soldat Mercenaire",
    faction: "AKARLYS",
    roleTitle: "Combattant indépendant",
    description: "Vétéran mercenaire au service du plus offrant. Polyvalent et expérimenté.",
    modelFolder: "soldat_mercenaire",
    uiColors: FACTION_COLORS.AKARLYS,
    stats: { hp: 110, armor: 60 },
    animations: { idle: STANDARD_ANIMS.idle, walking: STANDARD_ANIMS.walking, running: STANDARD_ANIMS.running, aim: STANDARD_ANIMS.aim, death: STANDARD_ANIMS.death },
  },
  {
    id: "sou_major",
    displayName: "Sous-Major",
    faction: "AKARLYS",
    roleTitle: "Officier de terrain",
    description: "Officier subalterne d'AKARLYS. Buffs d'équipe et leadership tactique.",
    modelFolder: "sou_major",
    uiColors: FACTION_COLORS.AKARLYS,
    stats: { hp: 120, armor: 70 },
    animations: { idle: STANDARD_ANIMS.idle, walking: STANDARD_ANIMS.walking, running: STANDARD_ANIMS.running, aim: STANDARD_ANIMS.aim, death: STANDARD_ANIMS.death },
  },
  {
    id: "kgnitig",
    displayName: "Kgnitig",
    faction: "AKARLYS",
    roleTitle: "Spécialiste mystique",
    description: "Manipulateur d'énergie kinetique. Capacités spéciales rares et puissantes.",
    modelFolder: "kgnitig",
    uiColors: FACTION_COLORS.AKARLYS,
    stats: { hp: 95, armor: 35, speedMultiplier: 1.05 },
    animations: { idle: STANDARD_ANIMS.idle, walking: STANDARD_ANIMS.walking, running: STANDARD_ANIMS.running, aim: STANDARD_ANIMS.aim, death: STANDARD_ANIMS.death },
  },
  {
    id: "soldat_vert",
    displayName: "Soldat Vert",
    faction: "AKARLYS",
    roleTitle: "Recrue verte",
    description: "Jeune recrue, équipement de base. Bonus d'XP en début de carrière.",
    modelFolder: "soldat_vert",
    uiColors: FACTION_COLORS.AKARLYS,
    stats: { hp: 80, armor: 30, speedMultiplier: 1.10 },
    animations: { idle: STANDARD_ANIMS.idle, walking: STANDARD_ANIMS.walking, running: STANDARD_ANIMS.running, aim: STANDARD_ANIMS.aim, death: STANDARD_ANIMS.death },
  },

  // ── ZAYAN (Peuple Grongnoni alien) ────────────────────────────────────────
  {
    id: "gran_cheff",
    displayName: "Grand Chef",
    faction: "ZAYAN",
    roleTitle: "Chef de tribu",
    description: "Chef vénérable des Grongnoni. Aura de commandement et résistance élevée.",
    modelFolder: "gran_cheff",
    uiColors: FACTION_COLORS.ZAYAN,
    stats: { hp: 180, armor: 80, speedMultiplier: 0.95 },
    animations: { idle: STANDARD_ANIMS.idle, walking: STANDARD_ANIMS.walking, running: STANDARD_ANIMS.running, aim: STANDARD_ANIMS.aim, death: STANDARD_ANIMS.death },
  },
  {
    id: "grongnoni_majeur",
    displayName: "Grongnoni Majeur",
    faction: "ZAYAN",
    roleTitle: "Vétéran Grongnoni",
    description: "Guerrier expérimenté. Bonus de dégâts contre les humains AKARLYS.",
    modelFolder: "grongnoni_majeur",
    uiColors: FACTION_COLORS.ZAYAN,
    stats: { hp: 130, armor: 65 },
    animations: { idle: STANDARD_ANIMS.idle, walking: STANDARD_ANIMS.walking, running: STANDARD_ANIMS.running, aim: STANDARD_ANIMS.aim, death: STANDARD_ANIMS.death },
  },
  {
    id: "gronomi_ardent",
    displayName: "Gronomi Ardent",
    faction: "ZAYAN",
    roleTitle: "Pyromage",
    description: "Maîtrise les flammes plasma. Dégâts de zone élevés.",
    modelFolder: "gronomi_ardent",
    uiColors: FACTION_COLORS.ZAYAN,
    stats: { hp: 90, armor: 45 },
    animations: { idle: STANDARD_ANIMS.idle, walking: STANDARD_ANIMS.walking, running: STANDARD_ANIMS.running, aim: STANDARD_ANIMS.aim, death: STANDARD_ANIMS.death },
  },
  {
    id: "gronomi_infaterie",
    displayName: "Gronomi Infanterie",
    faction: "ZAYAN",
    roleTitle: "Fantassin alien",
    description: "Soldat de base ZAYAN. Force brute et résistance élevée.",
    modelFolder: "gronomi_infaterie",
    uiColors: FACTION_COLORS.ZAYAN,
    stats: { hp: 115, armor: 55 },
    animations: { idle: STANDARD_ANIMS.idle, walking: STANDARD_ANIMS.walking, running: STANDARD_ANIMS.running, aim: STANDARD_ANIMS.aim, death: STANDARD_ANIMS.death },
  },
  {
    id: "gronomi_mineur",
    displayName: "Gronomi Mineur",
    faction: "ZAYAN",
    roleTitle: "Jeune Grongnoni",
    description: "Recrue ZAYAN. Apprentissage rapide et capacités émergentes.",
    modelFolder: "gronomi_mineur",
    uiColors: FACTION_COLORS.ZAYAN,
    stats: { hp: 85, armor: 35, speedMultiplier: 1.10 },
    animations: { idle: STANDARD_ANIMS.idle, walking: STANDARD_ANIMS.walking, running: STANDARD_ANIMS.running, aim: STANDARD_ANIMS.aim, death: STANDARD_ANIMS.death },
  },
  {
    id: "general",
    displayName: "Général",
    faction: "ZAYAN",
    roleTitle: "Stratège militaire",
    description: "Général d'armée ZAYAN. Tactique et coordination de troupes.",
    modelFolder: "general",
    uiColors: FACTION_COLORS.ZAYAN,
    stats: { hp: 140, armor: 75 },
    animations: { idle: STANDARD_ANIMS.idle, walking: STANDARD_ANIMS.walking, running: STANDARD_ANIMS.running, aim: STANDARD_ANIMS.aim, death: STANDARD_ANIMS.death },
  },
  {
    id: "general_mission",
    displayName: "Général de Mission",
    faction: "ZAYAN",
    roleTitle: "Commandant d'opération",
    description: "Officier supérieur dédié aux missions spéciales. Équipement avancé.",
    modelFolder: "general_mission",
    uiColors: FACTION_COLORS.ZAYAN,
    stats: { hp: 150, armor: 80 },
    animations: { idle: STANDARD_ANIMS.idle, walking: STANDARD_ANIMS.walking, running: STANDARD_ANIMS.running, aim: STANDARD_ANIMS.aim, death: STANDARD_ANIMS.death },
  },
  {
    id: "mercenaire_alien",
    displayName: "Mercenaire Alien",
    faction: "ZAYAN",
    roleTitle: "Combattant indépendant",
    description: "Mercenaire ZAYAN, hors caste. Comportement imprévisible.",
    modelFolder: "mercenaire_alien",
    uiColors: FACTION_COLORS.ZAYAN,
    stats: { hp: 105, armor: 50 },
    animations: { idle: STANDARD_ANIMS.idle, walking: STANDARD_ANIMS.walking, running: STANDARD_ANIMS.running, aim: STANDARD_ANIMS.aim, death: STANDARD_ANIMS.death },
  },
  {
    id: "Grunt",
    displayName: "Grunt",
    faction: "ZAYAN",
    roleTitle: "Soldat brut",
    description: "Soldat ZAYAN de base. Combat rapproché efficace, manque de finesse.",
    modelFolder: "Grunt",
    uiColors: FACTION_COLORS.ZAYAN,
    stats: { hp: 100, armor: 45 },
    animations: { idle: STANDARD_ANIMS.idle, walking: STANDARD_ANIMS.walking, running: STANDARD_ANIMS.running, aim: STANDARD_ANIMS.aim, death: STANDARD_ANIMS.death },
  },
  {
    id: "profhete",
    displayName: "Prophète",
    faction: "ZAYAN",
    roleTitle: "Mystique ZAYAN",
    description: "Prophète des Grongnoni. Capacités psioniques et buffs d'équipe puissants.",
    modelFolder: "profhete",
    uiColors: FACTION_COLORS.ZAYAN,
    stats: { hp: 95, armor: 40 },
    animations: { idle: STANDARD_ANIMS.idle, walking: STANDARD_ANIMS.walking, running: STANDARD_ANIMS.running, aim: STANDARD_ANIMS.aim, death: STANDARD_ANIMS.death },
  },
];

/** Lookup helpers. */
export function getHeroById(id: string): HeroDef | undefined {
  return HEROES_CATALOG.find((h) => h.id === id);
}

export function getHeroesByFaction(faction: Faction): HeroDef[] {
  return HEROES_CATALOG.filter((h) => h.faction === faction);
}

export function getHeroModelPath(hero: HeroDef): string {
  return modelPath(hero.modelFolder);
}
