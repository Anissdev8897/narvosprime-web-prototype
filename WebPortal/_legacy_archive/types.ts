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

export interface Currency {
  type: CurrencyType;
  symbol: string;
  amount: number;
  baseRate: number;
}

export interface CurrencyConfig {
  symbol: string;
  baseRate: number;
  currentRate: number;
}

export interface ExchangeRate {
  from: CurrencyType;
  to: CurrencyType;
  rate: number;
  fee: number;
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

export interface Missile {
  id: string;
  position: Vector3;
  velocity: Vector3;
  faction: Faction;
  mesh?: any;
  lifetime: number;
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
  DOFUS_2D = 'DOFUS_2D'  // Mode 2D authentique style Dofus avec caméra orthographique
}
export interface SpriteConfig {
  texturePath: string; // Fallback
  maskPath?: string;   // Fallback
  malePath?: string;
  femalePath?: string;
  maleMask?: string;
  femaleMask?: string;
  frameWidth: number;
  frameHeight: number;
  totalFrames: number;
  rows: number;
  cols: number;
  frameRate: number;
  isDirectional: boolean;
  aspectRatio?: number;
}

export interface CharacterModelConfig {
  faction: Faction;
  rank: Rank;
  gender: Gender;
  modelPath: string;
  texturePath: string;
  iconPath: string;
  scale: number;
}

export interface AnimationState {
  current: string;
  frame: number;
  direction: number; // 0-7
  lastUpdate: number;
}

export enum BiomeType {
  OCEAN = 'OCEAN',
  DESERT = 'DESERT',
  FUNGAL = 'FUNGAL',
  HUB = 'HUB'
}

export enum AIState {
  IDLE = 'IDLE',
  PATROL = 'PATROL',
  CHASE = 'CHASE',
  ATTACK = 'ATTACK',
  FLEE = 'FLEE',
  AMBUSH = 'AMBUSH'
}

export enum ZoneType {
  SAFE = 'SAFE',
  WAR = 'WAR',
  DANGEROUS = 'DANGEROUS'
}

// Obsolete ToolMode removed

export interface Vector3 {
  x: number;
  y: number;
  z: number;
  // Duplicate definition fix: The export up top is correct, but TS allows interface merging.
  // However, removing this duplicate block if it causes issues.
}

export enum PlayerStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  IDLE = 'IDLE',
  COMBAT = 'COMBAT',
  AFK = 'AFK',
  TRAITOR = 'TRAITOR',
  SUSPENDED = 'SUSPENDED',
  CITIZEN = 'CITIZEN',
  ASSASSIN = 'ASSASSIN'
}

export interface Stats {
  hp: number;
  maxHp: number;
  ap: number;    // Points d'Action (Dofus Style)
  maxAp?: number; // Optional for Dofus fallback
  mp: number;    // Points de Mouvement (Dofus Style)
  maxMp?: number; // Optional

  // Dofus Specific Stats (Optional or merged)
  vitality?: number;
  wisdom?: number;
  strength?: number;
  intelligence?: number;
  chance?: number;
  agility?: number;
  initiative?: number;

  // Sci-Fi / Legacy Stats (Optional)
  armor?: number;
  maxArmor?: number;
  range?: number; // Portée bonus
  oxygen?: number;
  maxOxygen?: number;
}

export interface Equipment {
  id: string;
  name: string;
  slot: 'HEAD' | 'BODY' | 'LEGS' | 'WEAPON' | 'CAPE' | 'AMULET' | 'RING' | 'BOOTS' | 'BELT' | 'SHIELD' | 'PET';
  rarity: Rarity;
  statsBonus: Partial<Stats>;
}

export interface InventoryItem {
  id: string;
  count: number;
}

export interface PlayerEntity {
  id: number;
  type: EntityType;
  position: Vector3;
  velocity: Vector3;
  rotation: number;
  pitch: number;
  color: string;
  speed: number;
  size: number;
  stats: Stats;
  faction: Faction;
  isDead: boolean;
  inventory: InventoryItem[];
  rank: Rank;
  level: number;
  experience: number;
  equippedItems: { [slot: string]: string };
  name: string;
  reputation?: { [faction: string]: number };
  rpIdentity?: RPIdentity;
  gender: Gender;
  characterModelId?: string;
  class?: PlayerClass;
  customization?: CharacterCustomization;
  spriteConfig?: SpriteConfig;
  animation?: AnimationState;
  currentAnimation?: string;
  canMove?: boolean;
  selectedSpellId?: string | null;
  currentAp: number;
  currentMp: number;
  currentWeapon?: string;
  weaponAmmo?: number;
  userData?: any;
}

export interface Spell {
  id: string;
  name: string;
  description: string;
  apCost: number;
  minRange: number;
  maxRange: number;
  damage: number;
  type: 'OFFENSIVE' | 'DEFENSIVE' | 'UTILITY';
  faction?: Faction;
  aoe?: number; // Rayon d'effet
  cooldown?: number; // Temps en secondes
  lastUsed?: number; // Timestamp
  shortcut?: string; // ex: 'Q', 'W', 'E', 'R'
}


export enum Rarity {
  COMMON = 'COMMON',
  UNCOMMON = 'UNCOMMON',
  RARE = 'RARE',
  EPIC = 'EPIC',
  LEGENDARY = 'LEGENDARY',
  ARTIFACT = 'ARTIFACT'
}

export interface PlanetConfig {
  id: string;
  position: Vector3;
  size: number;
  color: number;
  groundColor: number;
  name: string;
  biome: BiomeType;
  atmosphereColor: number;
  temperature: number;
  gravity: number;
  sunColor: number;
  moonColor: number;
  resources?: string[];
  hostileLevel?: number;
  forgeAvailable?: boolean;
  artisan?: string;
  defaultMapId?: string;
  defaultFaction?: string;
}

export enum Rank {
  SOLDIER = 'SOLDIER',
  VETERAN = 'VETERAN',
  OFFICER = 'OFFICER',
  COMMANDER = 'COMMANDER',
  GENERAL = 'GENERAL',
  PROPHET = 'PROPHET'
}

export type CraftCategory = 'WEAPON' | 'ARMOR' | 'ITEM' | 'VEHICLE' | 'GADGET' | 'STRUCTURE';

export interface ResourceDef {
  id: string;
  name: string;
  rarity: string;
  description: string;
  planetId: string;
  biome: BiomeType;
  icon?: string;
  dropRate: number;
}

export interface CraftableItem {
  id: string;
  name: string;
  category: CraftCategory;
  rarity: Rarity | string;
  faction: Faction | 'NEUTRAL';
  planetId: string;
  minRank?: Rank;
  minLevel: number;
  cost: { resourceId: string; amount: number }[];
  craftTime: number;
  description: string;
  icon?: string;
  stats?: {
    damage?: number;
    armor?: number;
    hp?: number;
    speed?: number;
    special?: { [key: string]: any };
  };
}

export interface CraftProgress {
  itemId: string;
  startTime: number;
  duration: number;
  completed: boolean;
}

export interface CraftStation {
  id: string;
  type: CraftCategory;
  level: number;
  efficiency: number;
}

export interface Merchant {
  id: string;
  name: string;
  faction: Faction | 'NEUTRAL';
  planetId: string;
  position: { x: number; y: number; z: number };
  type: 'EXCHANGER' | 'SHOP' | 'APOTHECARY';
  inventory: {
    itemId: string;
    stock: number;
    price: number;
    currency: CurrencyType;
    maxStock: number;
    restockRate?: number;
  }[];
  exchangeFee?: number;
  factionDiscount?: number;
}

export interface RPIdentity {
  firstName: string;
  lastName: string;
  age: number;
  backstory: string;
  createdAt: number;
}

export interface MonsterDef {
  id: string;
  name: string;
  biome: BiomeType;
  hp: number;
  armor: number;
  speed: number;
  aggressiveness: number;
  scale: number;
  color: string;
}

export interface BossAbility {
  name: string;
  type: 'AOE' | 'SINGLE_TARGET' | 'PROJECTILE' | 'SPAWN_MINIONS';
  damage?: number;
  damageOverTime?: { dps: number; duration: number };
  effect?: string;
  effectDuration?: number;
  cooldown: number;
  range?: number;
  area?: number;
  telegraphTime?: number;
}

export interface BossDef extends MonsterDef {
  type: 'BOSS';
  abilities: BossAbility[];
  recommendedGroup: { minPlayers: number; minLevel: number };
  spawnConditions: {
    zone: string[];
    requiresGroup: boolean;
    minPlayers?: number;
    minLevel?: number;
  };
  lootTable: { itemId: string; chance: number; minAmount: number; maxAmount: number }[];
  phaseThresholds?: number[];
}


export interface MonsterEntity {
  id: string;
  monsterDef: MonsterDef;
  position: Vector3;
  velocity: Vector3;
  rotation: number;
  currentState: AIState;
  mesh?: any;
  stats: Stats;
  aiModelType?: 'AGGRESSIVE' | 'TACTICAL' | 'DEFENSIVE' | 'STRATEGIC';
  lastAIUpdate?: number;
  targetPosition?: Vector3;
}

export interface BossEntity extends MonsterEntity {
  bossDef: BossDef;
  lastAIUpdate: number;
  aiModelType: 'AGGRESSIVE' | 'TACTICAL' | 'DEFENSIVE';
  currentPhase: number;
  abilityCooldowns: Map<string, number>;
  lastAbilityTime: Map<string, number>;
  spawnedMinions: string[];
}

export interface GlobalSettings {
  keys: KeyBindings;
  audio: AudioSettings;
  world: WorldSettings;
  video: VideoSettings;
  cameraSensitivity: number;
}

export interface KeyBindings {
  moveForward: string;
  moveBackward: string;
  moveLeft: string;
  moveRight: string;
  jump: string;
  sprint: string;
  toggleView: string;
  interact: string;
  menu: string;
}

export interface AudioSettings {
  masterVolume: number;
  worldVolume: number;
  characterVolume: number;
  effectsVolume: number;
  customTracks: string[];
}

export interface VideoSettings {
  graphicsQuality: GraphicsQuality;
  textureQuality: TextureQuality;
  renderDistance: number;
  shadowsEnabled: boolean;
  specialEffectsEnabled: boolean;
  antiAliasing: AntiAliasing;
  maxFPS: MaxFPS;
  displayMode: DisplayMode;
  resolution?: string;
}

export type GraphicsQuality = 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';
export type TextureQuality = 'LOW' | 'MEDIUM' | 'HIGH' | 'ULTRA';
export type AntiAliasing = 0 | 2 | 4 | 8;
export type MaxFPS = 30 | 60 | 120 | 144 | 240 | -1;
export type DisplayMode = 'FULLSCREEN' | 'WINDOWED' | 'BORDERLESS';

export interface WorldSettings {
  ambienceEnabled: boolean;
  dynamicAnimations: boolean;
  windIntensity: number;
  fogDensity: number;
  brightness: number;
  realismMode: boolean;
}

export interface AnimationRequest {
  animationId?: string;
  target?: string;
  loop?: boolean;
  speed?: number;
  faction?: string;
  role?: string;
  style?: string;
  status?: 'IDLE' | 'GENERATING' | 'IMPORTING' | 'READY';
}

export interface CameraProfile {
  distance: number;
  height: number;
  fov: number;
  minPolarAngle: number;
  maxPolarAngle: number;
  collisionOffset: number;
}

export interface PotionEffect {
  type: 'HEAL' | 'BUFF' | 'ANTI_POISON' | 'POISON' | 'REGEN' | 'SPEED';
  value?: number;
  duration: number;
  immediate: boolean;
  cooldown: number;
}

export interface GameItem {
  id: string;
  name: string;
  type: 'ARMOR' | 'WEAPON' | 'CONSUMABLE' | 'POTION' | 'GADGET' | 'MATERIAL' | 'QUEST';
  rarity: Rarity | string;
  price: number;
  currency: CurrencyType;
  description: string;
  icon?: string;
  stackable: boolean;
  maxStack: number;
  effect?: PotionEffect | any;
}

export interface WindowPositions {
  playerIdentity?: { x: number; y: number };
  hud?: { x: number; y: number };
  radar?: { x: number; y: number };
}

export interface SelectionState {
  item: any;
  type: EntityType;
  position: Vector3;
  data?: any;
  active?: boolean;
  screenPos?: { x: number; y: number };
  objectUuid?: string;
}

export interface PlayerKill {
  killerId: string;
  victimId: string;
  timestamp: number;
  zoneType: ZoneType;
  justified: boolean;
  lootDropped: InventoryItem[];
}
