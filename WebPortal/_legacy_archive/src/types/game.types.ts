/**
 * =============================================================================
 * NARVOS PRIME - TYPES DU JEU
 * =============================================================================
 * Types TypeScript pour le prototype web, adaptés de dofus-like-character-creator
 */

// ═══════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════

export enum GameState {
    LOGIN = 'LOGIN',
    SERVER_SELECTION = 'SERVER_SELECTION',
    MENU = 'MENU',
    CHARACTER_SELECTION = 'CHARACTER_SELECTION',
    LOADING = 'LOADING',
    PLAYING = 'PLAYING',
    OPTIONS = 'OPTIONS',
    EXIT = 'EXIT'
}

export enum Faction {
    AKARLYS = 'akarlys',
    ZAYAN = 'zayan',
    MEZALAYIS = 'mezalayis',
    HOSTILE = 'hostile',
    NEUTRAL = 'neutral'
}

export enum PlayerClass {
    // AKARLYS (Human)
    BIO_SCOUT = 'bio_scout',
    CURRENT_BREAKER = 'current_breaker',
    AQUARYS_SHADOW = 'aquarys_shadow',
    PRESSURE_MANIPULATOR = 'pressure_manipulator',
    // ZAYAN (Alien)
    PARASITE_SOWER = 'parasite_sower',
    CANOPY_PROPHET = 'canopy_prophet',
    MYCELIUM_HOST = 'mycelium_host',
    VENOM_STALKER = 'venom_stalker',
    // MEZALAYIS (Mercenary)
    PYRO_ALCHEMIST = 'pyro_alchemist',
    FLUX_SCAVENGER = 'flux_scavenger',
    DESERT_MIRAGE = 'desert_mirage',
    DUST_JUGGERNAUT = 'dust_juggernaut'
}

export enum Gender {
    MALE = 'MALE',
    FEMALE = 'FEMALE'
}

export enum Element {
    EARTH = 'earth',
    FIRE = 'fire',
    WATER = 'water',
    AIR = 'air',
    NEUTRAL = 'neutral',
    HEAL = 'heal'
}

export type ZoneShape = 'single' | 'circle' | 'cross' | 'line' | 'square';

// ═══════════════════════════════════════════════════════════════
// STATS & COMBAT
// ═══════════════════════════════════════════════════════════════

export interface EntityStats {
    hp: number;
    maxHp?: number;
    pa: number;
    pm: number;
    puissance: number;
    initiative: number;
    critique: number;
}

export interface SpellDamage {
    min: number;
    max: number;
    element: Element;
}

export interface SpellAnimationConfig {
    folder: string;
    prefix: string;
    frameCount: number;
}

export interface Spell {
    id: string;
    name: string;
    description: string;
    icon: string;
    apCost: number;
    range: number;
    minRange?: number;
    damage: SpellDamage;
    effectType: 'projectile' | 'area' | 'self' | 'melee';
    color: string;
    zoneShape: ZoneShape;
    zoneSize: number;
    animationConfig?: SpellAnimationConfig;
}

// ═══════════════════════════════════════════════════════════════
// CLASSES & CHARACTERS
// ═══════════════════════════════════════════════════════════════

export interface ClassColors {
    primary: string;
    secondary: string;
    tertiary?: string;
    skin: string;
}

export interface SpriteConfig {
    useSplitSprites?: boolean;
    maleSpritesFolder?: string;
    femaleSpritesFolder?: string;
    spriteCount?: number;
    malePath?: string;
    femalePath?: string;
    rows: number;
    cols: number;
    bgToRemove?: string;
}

export interface ClassRole {
    title: string;
    description: string;
    iconType: 'damage' | 'tank' | 'support' | 'utility';
}

/**
 * Configuration d'un modele 3D anime (GLB Meshy AI) associe a une classe.
 * Utilise par le pipeline iso 3D temps reel (POC + futur runtime).
 * Independant du `spriteConfig` (sprites 2D plats) qui reste pour le mode legacy.
 */
export interface Model3DConfig {
    /** GLB de base (T-pose ou Idle). */
    basePath: string;
    /** Map des animations -> path GLB ou clip name. */
    animations: {
        idle?: string;
        walking?: string;
        running?: string;
        attacking?: string;
        casting?: string;
        hit?: string;
        death?: string;
    };
    /** Echelle a appliquer (1 par defaut). */
    scale?: number;
    /** Offset Y (0 par defaut). */
    yOffset?: number;
    /** Rotation initiale Y en radians. */
    rotationY?: number;
}

export interface ClassData {
    id: string;
    name: string;
    roleTitle?: string;
    faction: Faction;
    description: string;
    colors: ClassColors;
    stats: EntityStats;
    spells: Spell[];
    roles?: ClassRole[];
    spriteConfig?: SpriteConfig;
    /** Modele 3D anime (Meshy AI GLB). Optionnel — coexiste avec spriteConfig. */
    model3D?: Model3DConfig;
    difficulty?: number;
}

export interface CharacterCustomization {
    gender: Gender;
    headIndex: number;
    colors: {
        skin: string;
        hair: string;
        tunic1: string;
        tunic2?: string;
    };
}

export interface SavedCharacter {
    id: string;
    name: string;
    classId: string;
    level: number;
    gender: 'M' | 'F';
    colors: {
        skin: string;
        hair: string;
        tunic1: string;
        tunic2?: string;
    };
    headIndex: number;
    spriteDataUrl?: string;
    lastMap?: { x: number; y: number };
    createdAt: number;
    stats?: EntityStats & {
        experience: number;
        experienceMax: number;
        statPoints: number;
    };
}

// ═══════════════════════════════════════════════════════════════
// MONSTERS
// ═══════════════════════════════════════════════════════════════

export interface MonsterData {
    id: string;
    name: string;
    level: number;
    stats: EntityStats;
    spriteUrl: string;
    isSpriteSheet: boolean;
    spells: Spell[];
    aiBehavior?: 'aggressive' | 'coward' | 'tactical' | 'strategic';
    // Aggro & Interaction
    isAggressive?: boolean; // Auto-attacks player on proximity
    aggroRadius?: number; // % of screen distance for aggro detection
    canTalk?: boolean; // Has dialogue option
    dialogueId?: string; // ID of dialogue tree in MONSTER_DIALOGUES
}

// ═══════════════════════════════════════════════════════════════
// MAPS & WORLD
// ═══════════════════════════════════════════════════════════════

export interface MapProp {
    id: string;
    type: string;
    x: number;
    y: number;
    width: number;
    height: number;
    src?: string;
    name?: string;
    isSolid?: boolean;
    isCollisionZone?: boolean;
    collisionOpacity?: number;
}

export interface SavedMap {
    id: string;
    imageUrl: string;
    props: MapProp[];
    theme?: string;
}

export interface City {
    id: string;
    name: string;
    maps: string[];
}

/** Type de zone pour le menu carte (touche M) */
export type RegionMapType = 'ville' | 'exterieur' | 'donjon';

/** Limites max de maps par catégorie (menu régions) */
export const MAX_MAPS_VILLE = 10;
export const MAX_MAPS_EXTERIEUR = 10;
export const MAX_MAPS_DONJON = 5;

export interface Region {
    id: string;
    name: string;
    description: string;
    startingMap: string;
    color: string;
    cities: City[];
    /** Maps ville (max 10) - chemins ou URLs */
    mapsVille?: string[];
    /** Maps extérieur de ville (max 10) */
    mapsExterieur?: string[];
    /** Maps donjon (max 5) */
    mapsDonjon?: string[];
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

export const HEAD_VARIANTS = [
    { id: 0, name: 'Standard' },
    { id: 1, name: 'Alternatif A' },
    { id: 2, name: 'Alternatif B' },
    { id: 3, name: 'Rare' }
];
