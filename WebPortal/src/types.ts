
export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

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

export enum GridType {
  ORTHOGONAL = 'ORTHOGONAL',
  ISOMETRIC = 'ISOMETRIC'
}

export enum ServerType {
  NORMAL = 'NORMAL',
  HEROIC = 'HEROIC'
}

export enum CurrencyType {
  LYS = 'LYS',
  ALA = 'ALA',
  DARNIAR = 'DARNIAR'
}

export interface GameServer {
  id: string;
  name: string;
  type: ServerType;
  description: string;
  status: 'ONLINE' | 'OFFLINE' | 'FULL';
  population: 'LOW' | 'MEDIUM' | 'HIGH';
  xpRate: number;
}

export enum SceneMode {
  PLANET = 'PLANET',
  HUB = 'HUB'
}

export enum EntityType {
  HUMANOID = 'HUMANOID',
  ALIEN = 'ALIEN',
  PROP = 'PROP',
  MONSTER = 'MONSTER',
  NPC = 'NPC',
  HOLOGRAM = 'HOLOGRAM'
}

export enum Faction {
  HUMAN = 'HUMAN', // Akarlys
  ALIEN = 'ALIEN', // Zayan
  MERCENARY = 'MERCENARY', // Mezalayis
  HOSTILE = 'HOSTILE',
  NEUTRAL = 'NEUTRAL'
}

export enum PlayerClass {
  // AKARLYS (Human)
  PRESSURE_MANIPULATOR = 'PRESSURE_MANIPULATOR',
  BIO_SCOUT = 'BIO_SCOUT',
  CURRENT_BREAKER = 'CURRENT_BREAKER',
  AQUARYS_SHADOW = 'AQUARYS_SHADOW',
  // ZAYAN (Alien)
  PARASITE_SOWER = 'PARASITE_SOWER',
  CANOPY_PROPHET = 'CANOPY_PROPHET',
  MYCELIUM_HOST = 'MYCELIUM_HOST',
  VENOM_STALKER = 'VENOM_STALKER',
  // MEZALAYIS (Mercenary)
  PYRO_ALCHEMIST = 'PYRO_ALCHEMIST',
  FLUX_SCAVENGER = 'FLUX_SCAVENGER',
  DESERT_MIRAGE = 'DESERT_MIRAGE',
  DUST_JUGGERNAUT = 'DUST_JUGGERNAUT'
}

export interface CharacterCustomization {
  gender: Gender;
  faceId: number;
  // Dofus Customization
  skinColor?: string;
  hairColor?: string;
  baseColor?: string;
  secondaryColor?: string;
  detailColor?: string;
  hairStyle?: number;
  accessoryId?: number;

  // Backward compatibility
  colors: {
    skin: string;
    hair: string;
    base: string;
    secondary: string;
    detail: string;
  };
  equippedItems: {
    head?: string;
    back?: string;
  };
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE'
}

export enum CameraMode {
  TACTICAL_ISO = 'TACTICAL_ISO',
  DOFUS_2D = 'DOFUS_2D'
}

export interface SpriteConfig {
  malePath?: string;   // Full sheet URL (legacy)
  femalePath?: string; // Full sheet URL (legacy)
  maleFramesFolder?: string;   // Folder containing s000.png, etc. (legacy)
  femaleFramesFolder?: string; // Folder containing s000.png, etc. (legacy)

  // New: Individual sprites system
  useSplitSprites?: boolean;  // If true, use individual sprite files
  maleSpritesFolder?: string;  // e.g., /textures/personnage/bio_scout/H_bio_scout
  femaleSpritesFolder?: string; // e.g., /textures/personnage/bio_scout/F_bio_scout
  spriteCount?: number;  // Number of sprites (default 8)

  useHero8Dir?: boolean; // New: 8-directional system with useHeroAnimation hook
  isFlatSpritesheet?: boolean; // New: Legacy pre-made characters format (Alex, etc.)
  assetType?: 'V4_HERO' | 'V4_MONSTER' | 'V4_NPC' | 'PROP' | 'LEGACY_NPC'; 

  rows?: number;
  cols?: number;
  bgToRemove?: string; // Optional: background color to remove (e.g. "#FFFFFF")
  basePalette?: {
    skin: string;
    hair: string;
    primary: string;
    secondary: string;
  };
}

export interface AnimationState {
  current: string;
  frame: number;
  direction: number; // 0-7
  lastUpdate: number;
}

// --- SAVED DATA TYPES ---
export interface MapProp {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  src?: string;
  name?: string;
  monsterId?: string;
  merchantId?: string;
  level?: number;
  isSolid?: boolean;
  // Collision system
  isCollisionZone?: boolean;  // True if this is a collision/blocking zone
  collisionOpacity?: number;  // Opacity for visual display (0-1)
}

export interface SavedMap {
  id: string;
  imageUrl: string;
  props: MapProp[];
  theme?: string;
}

export interface SavedObject {
  id: string;
  url: string;
  name: string;
}

export interface SavedSprite {
  id: string;
  dataUrl: string;
}

export interface SavedFactionMap {
  id: string;
  name: string;
  imageUrl: string;
  props: MapProp[];
  theme: string;
}

// --- ADDITIONAL TYPES FOR COMPATIBILITY ---
export interface SavedCharacter {
  id: string;
  name: string;
  classId: string;
  level: number;
  gender: 'M' | 'F';
  colors: {
    skin: string;
    hair: string;
    eyes?: string;     
    pants?: string;    
    shoes?: string;    
    jacket: string;   
    tunic1?: string;
    tunic2?: string;
  };
  headIndex: number;
  spriteDataUrl: string;
  username?: string;
  server?: string;
  lastMap: { x: number, y: number };
  lastPosition?: { x: number, y: number };
  createdAt: number;
  stats?: {
    hp: number;
    maxHp: number;
    pa: number;
    pm: number;
    puissance: number;
    critique: number;
    initiative: number;
    experience: number;
    experienceMax: number;
    statPoints: number;
    spellPoints: number;
    statsInvested: {
      vitalite: number;
      sagesse: number;
      force: number;
      intelligence: number;
      chance: number;
      agilite: number;
    };
    maitrise?: Record<string, number>;
    resistances?: Record<string, number>;
  };
  inventory?: Inventory;
  equipment?: Equipment;
  spells?: Spell[];
  isFromSql?: boolean;
  serverType?: 'NORMAL' | 'HEROIC'; // Server type - characters are tied to their server mode
  isDead?: boolean; // For heroic mode - permanent death flag
  faction?: string; // Character faction (AKARLYS, MEZALAYIS, ZAYAN)
}

export interface ClassRole {
  title: string;
  description: string;
  iconType: 'damage' | 'tank' | 'support' | 'utility';
}

export interface ClassData {
  id: string;
  name: string;
  level?: number;
  spriteUrl?: string;
  roleTitle?: string; // Narvos
  lore?: string;
  element?: string;
  faction?: string;
  colors: {
    primary: string;
    secondary: string;
    tertiary?: string;
    skin: string;
  };
  // Dofus Style
  baseStats?: {
    hp: number;
    ap: number;
    mp: number;
    range: number;
    movement: number;
    strength: number;
    intelligence: number;
    chance: number;
    agility: number;
  };
  // Narvos Style
  stats?: {
    hp: number;
    pa: number;
    pm: number;
    puissance: number;
    initiative: number;
    critique: number;
  };
  roles?: ClassRole[]; // Narvos
  spells: any[];
  archetype?: string;
  difficulty?: number;
  description?: string;
  starterSpells?: string[];
  icon?: string;
  spriteConfig?: SpriteConfig;
}

export interface Region {
  id: string;
  name: string;
  description: string;
  startingMap: string;
  cities: City[];
  color: string;
}

export interface City {
  id: string;
  name: string;
  maps: string[]; // Paths to fixed maps
}

export type CharacterState = {
  name: string;
  classId: string;
  gender: 'M' | 'F';
  colors: {
    skin: string;
    hair: string;
    eyes?: string;
    pants?: string;
    shoes?: string;
    jacket: string;
    tunic1?: string;
    tunic2?: string;
  };
  headIndex: number;
  level?: number;
  lastPosition?: { x: number, y: number };
  inventory?: Inventory;
  equipment?: Equipment;
  stats?: CombatantStats;
  spells?: Spell[];
};

// --- COMBAT & ENTITY TYPES ---
export interface EntityStats {
  hp: number;
  maxHp: number;
  pa: number;
  pm: number;
  puissance: number;
  initiative: number;
  critique: number;
}

export interface SpellDamage {
  min: number;
  max: number;
  element: 'earth' | 'fire' | 'water' | 'air' | 'neutral' | 'heal';
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
  apCost?: number;   // Legacy
  paCost: number;     // Narvos Prime
  pmCost: number;
  range?: number;    // Legacy
  minRange: number;
  maxRange: number;
  damage?: SpellDamage;
  effectType?: 'projectile' | 'area' | 'self' | 'melee';
  color: string;
  animationConfig?: SpellAnimationConfig;

  // Champs Tactiques
  lineOfSight: boolean;
  modifiableRange: boolean;
  zoneShape: ZoneShape;
  zoneSize: number;
  targetType?: string;
  cooldown: number;
  usesPerTurn: number;
  currentLevel: number;
  maxLevel: number;
  levelRequired: number;
  type: string;
  effects: any[];
}

export interface MonsterData {
  id: string;
  name: string;
  level: number;
  spriteUrl: string;
  isSpriteSheet: boolean;
  stats: EntityStats;
  spells: Spell[];
  aiBehavior?: 'aggressive' | 'coward' | 'tactical' | 'strategic';
}

export type Element = 'eau' | 'feu' | 'air' | 'terre' | 'neutre';
export type ZoneShape = 'single' | 'circle' | 'cross' | 'line' | 'square';
export type CombatPhase = 'preparation' | 'active' | 'turn_player' | 'turn_enemy' | 'animation' | 'result';
export type AIBehavior = 'aggressive' | 'coward' | 'tactical' | 'strategic';

export interface ActiveEffect {
  id: string;
  spellId: string;
  name?: string;
  type: 'buff' | 'debuff' | 'poison' | 'shield';
  stat?: keyof CombatantStats;
  statAffected?: string; // Ajouté pour TacticalCombatScene
  value: number;
  duration: number;
  casterId: string;
  icon?: string; // Ajouté pour TacticalCombatScene
}

export interface CombatantStats extends EntityStats {
  maxPa: number;
  maxPm: number;
  dommages: number;
  domCritique: number;
  domMelee: number;
  domDistance: number;
  esquive: number;
  parade: number;
  resMelee: number;
  resDistance: number;
  maitrise: Record<string, number>;
  resistances: Record<string, number>;
  vitesse: number;
  niveau: number;
  experience: number;
  experienceMax: number;
  statPoints?: number;
  spellPoints?: number;
  statsInvested?: {
    vitalite: number;
    sagesse: number;
    force: number;
    intelligence: number;
    chance: number;
    agilite: number;
  };
}

export interface Inventory {
  aros: number;
  items: Item[];
  lysAmount: number;
  alakyrisAmount: number;
  darniarAmount: number;
  maxSlots: number;
}

export interface Equipment {
  slots: Partial<Record<EquipmentSlot, Item>>;
}

export type EquipmentSlot = 'helmet' | 'amulet' | 'weapon' | 'armor' | 'shield' | 'ring1' | 'ring2' | 'belt' | 'boots' | 'cloak';

export interface Item {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: 'weapon' | 'armor' | 'accessory' | 'consumable' | 'resource' | 'quest';
  rarity: string;
  statsBonus?: Record<string, number>;
  quantity: number;
  level?: number;
  weight?: number;
  spriteUrl?: string;
  stackable?: boolean;
  basePrice?: number;
  effect?: {
    type: string;
    value: number;
  };
}

export interface GridCell {
  x: number;
  y: number;
  isObstacle: boolean;
  isWalkable: boolean;
  isSpawnPlayer?: boolean;
  isSpawnEnemy?: boolean;
  type?: string;
  occupiedBy?: string | null;
  walkable?: boolean;
  blocksLineOfSight?: boolean; // Ajouté pour TacticalCombatScene
}

export interface CombatGrid {
  width: number;
  height: number;
  cells: GridCell[][];
  playerSpawnZones?: { x: number, y: number }[];
  monsterSpawnZones?: { x: number, y: number }[];
}

export interface SpellEffect {
  type: 'damage' | 'heal' | 'buff' | 'debuff' | 'push' | 'pull' | 'teleport' | 'poison' | 'shield';
  element?: Element;
  value: number;
  valuePerLevel?: number;
  statAffected?: string;
  duration?: number;
  distance?: number;
  chance?: number;
}

export interface Combatant {
  id: string;
  classId?: string;
  name: string;
  type: 'player' | 'monster' | 'summon' | 'enemy';
  team: 'A' | 'B' | 'player' | 'enemy';
  stats: CombatantStats;
  position: { x: number, y: number };
  gridX: number; // Mis de optionnel à obligatoire pour simplifier
  gridY: number; // Mis de optionnel à obligatoire pour simplifier
  spells: Spell[];
  activeEffects: ActiveEffect[];
  isDead: boolean;
  isAlive?: boolean;
  isCasting?: boolean;
  aiBehavior?: AIBehavior;
  spriteUrl?: string;
  isSpriteSheet?: boolean;
  isSpritesheetV4?: boolean; // V4 Spritesheet System
  animState?: 'IDLE' | 'RUN' | 'JUMP' | 'ATTACK' | 'HIT' | 'DEATH';
  animFrame?: number;
  orientation?: 'S' | 'SW' | 'W' | 'NW' | 'N' | 'NE' | 'E' | 'SE';
  splitSpritesFolder?: string;
  isFlipped?: boolean;
  spellCooldowns: Record<string, number>; // Obligatoire
  spellUsesThisTurn?: Record<string, number>; // Ajouté pour TacticalCombatScene
  hasPlayed?: boolean; // Ajouté pour TacticalCombatScene
}

export interface CombatLogEntry {
  id: string;
  text: string;
  type: 'damage' | 'heal' | 'buff' | 'info' | 'error' | 'victory' | 'defeat';
  timestamp: number;
}

export interface CombatState {
  phase: CombatPhase;
  turn: number;
  activeCombatantId: string | null;
  grid: CombatGrid;
  combatants: Combatant[];
  selectedSpellId: string | null;
  selectedSpell?: Spell | null; // Compatibilité
  targetCell: { x: number, y: number } | null;
  log: CombatLogEntry[];
  combatLog?: CombatLogEntry[]; // Compatibilité
  turnOrder: string[];
  currentTurnIndex: number;
  currentRound: number;
  preparationTimeRemaining?: number;
  turnTimeRemaining?: number;
  targetableCells?: { x: number, y: number }[];
  movableCells?: { x: number, y: number }[];
}

export interface ElementalStats {
  eau: number;
  feu: number;
  air: number;
  terre: number;
  neutre: number;
}

export interface Merchant {
  id: string;
  name: string;
  subtitle?: string;
  type: 'general' | 'resource' | 'consumable' | 'specialized';
  spriteUrl: string;
  inventory: Item[];
  buyFactor: number;
  sellMultiplier?: number;
}