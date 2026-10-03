import { EntityType, PlanetConfig, GlobalSettings, BiomeType, MonsterDef, Faction, CameraProfile, Spell, Rank, Equipment, PlayerClass, SpriteConfig, GameServer, ServerType, Rarity } from './types';

export const SERVERS_DB: GameServer[] = [
  {
    id: 'heroic_1',
    name: 'NevarosGardarock',
    type: ServerType.HEROIC,
    description: 'Serveur Héroïque : Mort définitive, PvP actif partout, XP x2 sur les monstres.',
    status: 'ONLINE',
    population: 'MEDIUM',
    xpRate: 2
  },
  {
    id: 'normal_1',
    name: 'WorldNevaros',
    type: ServerType.NORMAL,
    description: 'Serveur Normal : Pas de mort définitive, taux d\'expérience standard.',
    status: 'ONLINE',
    population: 'HIGH',
    xpRate: 1
  }
];

export const SCREEN_WIDTH = window.innerWidth;
export const SCREEN_HEIGHT = window.innerHeight;

export const FACTION_COLORS = {
  [Faction.HUMAN]: '#39C5BB', // Cyan Akarlys
  [Faction.ALIEN]: '#A8FF00', // Vert Zayan
  [Faction.MERCENARY]: '#FFD700', // Or Mezalayis
  [Faction.HOSTILE]: '#FF003C', // Rouge
  [Faction.NEUTRAL]: '#FFFFFF', // Blanc
};

// --- STATS DE BASE STYLE DOFUS ---
export const BASE_PLAYER_STATS = {
  hp: 100,
  maxHp: 100,
  armor: 0,
  maxArmor: 0,
  ap: 6,
  maxAp: 6,
  mp: 3,
  maxMp: 3,
  range: 0,
  oxygen: 100,
  maxOxygen: 100
};

export const DEFAULT_SPRITE_CONFIG: SpriteConfig = {
  texturePath: '/textures/sprites/pressure_manipulator_albedo.png',
  maskPath: '/textures/sprites/pressure_manipulator_mask.png',
  frameWidth: 256,
  frameHeight: 256,
  totalFrames: 4,
  rows: 8,
  cols: 4,
  frameRate: 8,
  isDirectional: true,
  aspectRatio: 1.0 // Style Dofus standard (Unité carrée)
};

// --- LES 10 CLASSES DE NARVOS PRIME ---
export interface ClassData {
  name: string;
  faction: Faction; // Faction d'origine (lore)
  description: string;
  difficulty: number; // 1-3 étoiles
  archetype: 'TANK' | 'DPS' | 'SUPPORT' | 'ASSASSIN';
  baseStats: any;
  starterSpells: string[];
  spriteConfig: SpriteConfig;
  icon: string;
}

export const CLASSES_DB: Record<PlayerClass, ClassData> = {
  [PlayerClass.PRESSURE_MANIPULATOR]: {
    name: 'Rempart',
    faction: Faction.HUMAN,
    difficulty: 2,
    archetype: 'TANK',
    description: 'Les Remparts sont les gardiens des cités sous-marines d\'Aquarys. Ils utilisent des boucliers énergétiques massifs pour compresser l\'espace autour d\'eux.',
    baseStats: { ...BASE_PLAYER_STATS, hp: 150, maxHp: 150, armor: 100, maxArmor: 100 },
    starterSpells: ['compression_sphere', 'aqua_bolt'],
    spriteConfig: {
      ...DEFAULT_SPRITE_CONFIG,
      malePath: '/textures/sprites/pressure_manipulator_male_albedo.png',
      femalePath: '/textures/sprites/pressure_manipulator_female_albedo.png',
      maleMask: '/textures/sprites/pressure_manipulator_male_mask.png',
      femaleMask: '/textures/sprites/pressure_manipulator_female_mask.png'
    },
    icon: '🛡️'
  },
  [PlayerClass.BIO_SCOUT]: {
    name: 'Éclaireur',
    faction: Faction.HUMAN,
    difficulty: 1,
    archetype: 'SUPPORT',
    description: 'Spécialisés dans la bioluminescence, ils guident et soignent leurs alliés dans les profondeurs les plus sombres.',
    baseStats: { ...BASE_PLAYER_STATS, mp: 4, maxMp: 4, range: 2 },
    starterSpells: ['restoration_flash', 'hydro_shield'],
    spriteConfig: {
      ...DEFAULT_SPRITE_CONFIG,
      malePath: '/textures/sprites/bio_scout_male_albedo.png',
      femalePath: '/textures/sprites/bio_scout_female_albedo.png',
      maleMask: '/textures/sprites/bio_scout_male_mask.png',
      femaleMask: '/textures/sprites/bio_scout_female_mask.png'
    },
    icon: '💡'
  },
  [PlayerClass.CURRENT_BREAKER]: {
    name: 'Briseur de Courant',
    faction: Faction.HUMAN,
    difficulty: 3,
    archetype: 'DPS',
    description: 'Maîtres de la vélocité aquatique, ils utilisent les flux pour paralyser leurs ennemis avec une précision chirurgicale.',
    baseStats: { ...BASE_PLAYER_STATS, mp: 5, maxMp: 5 },
    starterSpells: ['hydro_kinetic_wake', 'aqua_bolt'],
    spriteConfig: {
      ...DEFAULT_SPRITE_CONFIG,
      malePath: '/textures/sprites/current_breaker_male_albedo.png',
      femalePath: '/textures/sprites/current_breaker_female_albedo.png',
      maleMask: '/textures/sprites/current_breaker_male_mask.png',
      femaleMask: '/textures/sprites/current_breaker_female_mask.png'
    },
    icon: '⚡'
  },
  [PlayerClass.AQUARYS_SHADOW]: {
    name: 'Ombre d\'Aquarys',
    faction: Faction.HUMAN,
    difficulty: 3,
    archetype: 'ASSASSIN',
    description: 'Discrets comme le courant, ils frappent sans laisser de trace avant de s\'évanouir dans les abysses.',
    baseStats: { ...BASE_PLAYER_STATS, mp: 6, maxMp: 6 },
    starterSpells: ['abyssal_strike', 'hydro_shield'],
    spriteConfig: {
      ...DEFAULT_SPRITE_CONFIG,
      malePath: '/textures/sprites/aquarys_shadow_male_albedo.png',
      femalePath: '/textures/sprites/aquarys_shadow_female_albedo.png',
      maleMask: '/textures/sprites/aquarys_shadow_male_mask.png',
      femaleMask: '/textures/sprites/aquarys_shadow_female_mask.png'
    },
    icon: '👤'
  },
  [PlayerClass.PARASITE_SOWER]: {
    name: 'Semeur',
    faction: Faction.ALIEN,
    difficulty: 2,
    archetype: 'DPS',
    description: 'Les Semeurs corrompent la biomasse ennemie en injectant des parasites organiques qui dévorent l\'hôte de l\'intérieur.',
    baseStats: { ...BASE_PLAYER_STATS, range: 3 },
    starterSpells: ['infestation', 'fungal_spore'],
    spriteConfig: {
      ...DEFAULT_SPRITE_CONFIG,
      malePath: '/textures/sprites/parasite_sower_male_albedo.png',
      femalePath: '/textures/sprites/parasite_sower_female_albedo.png',
      maleMask: '/textures/sprites/parasite_sower_male_mask.png',
      femaleMask: '/textures/sprites/parasite_sower_female_mask.png'
    },
    icon: '🍄'
  },
  [PlayerClass.CANOPY_PROPHET]: {
    name: 'Prophète',
    faction: Faction.ALIEN,
    difficulty: 3,
    archetype: 'SUPPORT',
    description: 'Ils communiquent avec le Grand Mycélium pour lier les consciences et partager les flux vitaux entre alliés.',
    baseStats: { ...BASE_PLAYER_STATS, hp: 120, maxHp: 120, ap: 7, maxAp: 7 },
    starterSpells: ['nervous_symbiosis', 'bio_regen'],
    spriteConfig: {
      ...DEFAULT_SPRITE_CONFIG,
      malePath: '/textures/sprites/canopy_prophet_male_albedo.png',
      femalePath: '/textures/sprites/canopy_prophet_female_albedo.png',
      maleMask: '/textures/sprites/canopy_prophet_male_mask.png',
      femaleMask: '/textures/sprites/canopy_prophet_female_mask.png'
    },
    icon: '🌿'
  },
  [PlayerClass.MYCELIUM_HOST]: {
    name: 'Hôte du Mycélium',
    faction: Faction.ALIEN,
    difficulty: 2,
    archetype: 'TANK',
    description: 'Fusionnés avec des structures fongiques lourdes, ils peuvent s\'enraciner pour encaisser des dégâts incommensurables.',
    baseStats: { ...BASE_PLAYER_STATS, hp: 200, maxHp: 200, armor: 50, maxArmor: 50 },
    starterSpells: ['transplantation', 'mycelium_trap'],
    spriteConfig: {
      ...DEFAULT_SPRITE_CONFIG,
      malePath: '/textures/sprites/mycelium_host_male_albedo.png',
      femalePath: '/textures/sprites/mycelium_host_female_albedo.png',
      maleMask: '/textures/sprites/mycelium_host_male_mask.png',
      femaleMask: '/textures/sprites/mycelium_host_female_mask.png'
    },
    icon: '🌑'
  },
  [PlayerClass.VENOM_STALKER]: {
    name: 'Traqueur Vénéneux',
    faction: Faction.ALIEN,
    difficulty: 2,
    archetype: 'ASSASSIN',
    description: 'Prédateurs nés de Mycelion, ils utilisent des toxines naturelles pour paralyser et achever leurs proies.',
    baseStats: { ...BASE_PLAYER_STATS, mp: 5, maxMp: 5 },
    starterSpells: ['toxic_dart', 'fungal_spore'],
    spriteConfig: {
      ...DEFAULT_SPRITE_CONFIG,
      malePath: '/textures/sprites/venom_stalker_male_albedo.png',
      femalePath: '/textures/sprites/venom_stalker_female_albedo.png',
      maleMask: '/textures/sprites/venom_stalker_male_mask.png',
      femaleMask: '/textures/sprites/venom_stalker_female_mask.png'
    },
    icon: '🦂'
  },
  [PlayerClass.PYRO_ALCHEMIST]: {
    name: 'Alchimiste',
    faction: Faction.MERCENARY,
    difficulty: 2,
    archetype: 'DPS',
    description: 'Ils transmutent le sable riche en minéraux en éclats de verre en fusion pour carboniser de vastes zones.',
    baseStats: { ...BASE_PLAYER_STATS, range: 4 },
    starterSpells: ['glass_storm', 'scrap_shot'],
    spriteConfig: {
      ...DEFAULT_SPRITE_CONFIG,
      malePath: '/textures/sprites/pyro_alchemist_male_albedo.png',
      femalePath: '/textures/sprites/pyro_alchemist_female_albedo.png',
      maleMask: '/textures/sprites/pyro_alchemist_male_mask.png',
      femaleMask: '/textures/sprites/pyro_alchemist_female_mask.png'
    },
    icon: '🔥'
  },
  [PlayerClass.FLUX_SCAVENGER]: {
    name: 'Charognard de Flux',
    faction: Faction.MERCENARY,
    difficulty: 1,
    archetype: 'SUPPORT',
    description: 'Ingénieurs de l\'improvisation, ils recyclent l\'énergie résiduelle des combats pour ravitailler leur équipe.',
    baseStats: { ...BASE_PLAYER_STATS, mp: 4, maxMp: 4, ap: 7, maxAp: 7 },
    starterSpells: ['combat_recycling', 'sand_cloak'],
    spriteConfig: {
      ...DEFAULT_SPRITE_CONFIG,
      malePath: '/textures/sprites/flux_scavenger_male_albedo.png',
      femalePath: '/textures/sprites/flux_scavenger_female_albedo.png',
      maleMask: '/textures/sprites/flux_scavenger_male_mask.png',
      femaleMask: '/textures/sprites/flux_scavenger_female_mask.png'
    },
    icon: '⚙️'
  },
  [PlayerClass.DESERT_MIRAGE]: {
    name: 'Mirage',
    faction: Faction.MERCENARY,
    difficulty: 3,
    archetype: 'ASSASSIN',
    description: 'Leurs combinaisons de distorsion thermique leur permettent de créer des reflets trompeurs tout en frappant dans l\'ombre.',
    baseStats: { ...BASE_PLAYER_STATS, mp: 6, maxMp: 6 },
    starterSpells: ['thermal_distortion', 'scrap_shot'],
    spriteConfig: {
      ...DEFAULT_SPRITE_CONFIG,
      malePath: '/textures/sprites/desert_mirage_male_albedo.png',
      femalePath: '/textures/sprites/desert_mirage_female_albedo.png',
      maleMask: '/textures/sprites/desert_mirage_male_mask.png',
      femaleMask: '/textures/sprites/desert_mirage_female_mask.png'
    },
    icon: '🌪️'
  },
  [PlayerClass.DUST_JUGGERNAUT]: {
    name: 'Juggernaut',
    faction: Faction.MERCENARY,
    difficulty: 2,
    archetype: 'TANK',
    description: 'Alimentés par la magnétite, ils attirent les débris métalliques pour se forger une seconde peau impénétrable.',
    baseStats: { ...BASE_PLAYER_STATS, hp: 250, maxHp: 250, armor: 150, maxArmor: 150, mp: 2, maxMp: 2 },
    starterSpells: ['magnetite_plating', 'sand_cloak'],
    spriteConfig: {
      ...DEFAULT_SPRITE_CONFIG,
      malePath: '/textures/sprites/dust_juggernaut_male_albedo.png',
      femalePath: '/textures/sprites/dust_juggernaut_female_albedo.png',
      maleMask: '/textures/sprites/dust_juggernaut_male_mask.png',
      femaleMask: '/textures/sprites/dust_juggernaut_female_mask.png'
    },
    icon: '🦾'
  }
};

// --- SORTS DÉTAILLÉS ---
export const SPELLS_DB: Record<string, Spell> = {
  // AKARLYS
  'compression_sphere': { id: 'compression_sphere', name: 'Sphère de Compression', description: 'Ralentit les projectiles de 80% et inflige des dégâts continus.', apCost: 4, minRange: 0, maxRange: 4, damage: 10, type: 'DEFENSIVE', faction: Faction.HUMAN, aoe: 3 },
  'restoration_flash': { id: 'restoration_flash', name: 'Flash de Restauration', description: 'Aveugle les ennemis et soigne les alliés instantanément.', apCost: 3, minRange: 1, maxRange: 6, damage: 0, type: 'DEFENSIVE', faction: Faction.HUMAN, aoe: 2 },
  'hydro_kinetic_wake': { id: 'hydro_kinetic_wake', name: 'Sillage Hydro-Cinétique', description: 'Laisse une traînée électrifiée paralysante derrière soi.', apCost: 3, minRange: 0, maxRange: 0, damage: 15, type: 'OFFENSIVE', faction: Faction.HUMAN },
  'aqua_bolt': { id: 'aqua_bolt', name: 'Aqua Bolt', description: 'Éclair d\'énergie aquatique.', apCost: 3, minRange: 1, maxRange: 6, damage: 15, type: 'OFFENSIVE', faction: Faction.HUMAN },
  'hydro_shield': { id: 'hydro_shield', name: 'Bouclier Hydro', description: 'Protection plasma-aquatique.', apCost: 2, minRange: 0, maxRange: 0, damage: 0, type: 'DEFENSIVE', faction: Faction.HUMAN },

  // ZAYAN
  'infestation': { id: 'infestation', name: 'Infestation', description: 'Lance une spore qui libère des créatures à la mort de la cible.', apCost: 5, minRange: 1, maxRange: 5, damage: 25, type: 'OFFENSIVE', faction: Faction.ALIEN },
  'nervous_symbiosis': { id: 'nervous_symbiosis', name: 'Symbiose Nerveuse', description: 'Transfère 50% des dégâts d\'un allié vers soi.', apCost: 3, minRange: 1, maxRange: 7, damage: 0, type: 'DEFENSIVE', faction: Faction.ALIEN },
  'transplantation': { id: 'transplantation', name: 'Transplantation', description: 'S\'enterre et ressort sous un ennemi pour l\'immobiliser.', apCost: 4, minRange: 1, maxRange: 4, damage: 20, type: 'OFFENSIVE', faction: Faction.ALIEN },
  'fungal_spore': { id: 'fungal_spore', name: 'Spore Putride', description: 'Dégâts fongiques en zone.', apCost: 4, minRange: 1, maxRange: 4, damage: 20, type: 'OFFENSIVE', faction: Faction.ALIEN, aoe: 1 },
  'bio_regen': { id: 'bio_regen', name: 'Bio-Régénération', description: 'Soin cellulaire accéléré.', apCost: 2, minRange: 0, maxRange: 0, damage: 0, type: 'DEFENSIVE', faction: Faction.ALIEN },
  'mycelium_trap': { id: 'mycelium_trap', name: 'Piège Mycélien', description: 'Pose un piège invisible qui immobilise et empoisonne la cible.', apCost: 3, minRange: 1, maxRange: 5, damage: 10, type: 'UTILITY', faction: Faction.ALIEN, aoe: 1 },

  // MEZALAYIS
  'glass_storm': { id: 'glass_storm', name: 'Tempête de Verre', description: 'Le sable environnant devient des éclats de verre brûlants.', apCost: 5, minRange: 1, maxRange: 5, damage: 30, type: 'OFFENSIVE', faction: Faction.MERCENARY, aoe: 4 },
  'combat_recycling': { id: 'combat_recycling', name: 'Recyclage de Combat', description: 'Génère une caisse de munitions ou un kit de soin sur un cadavre.', apCost: 2, minRange: 1, maxRange: 3, damage: 0, type: 'UTILITY', faction: Faction.MERCENARY },
  'thermal_distortion': { id: 'thermal_distortion', name: 'Distorsion Thermique', description: 'Crée deux clones thermiques et devient invisible.', apCost: 4, minRange: 0, maxRange: 0, damage: 0, type: 'UTILITY', faction: Faction.MERCENARY },
  'magnetite_plating': { id: 'magnetite_plating', name: 'Blindage de Magnétite', description: 'Attire les débris pour tripler ses PV temporairement.', apCost: 3, minRange: 0, maxRange: 0, damage: 0, type: 'DEFENSIVE', faction: Faction.MERCENARY },
  'scrap_shot': { id: 'scrap_shot', name: 'Tir de Ferraille', description: 'Tir puissant de récupération.', apCost: 4, minRange: 1, maxRange: 5, damage: 25, type: 'OFFENSIVE', faction: Faction.MERCENARY },
  'sand_cloak': { id: 'sand_cloak', name: 'Cape de Sable', description: 'Augmente l\'esquive.', apCost: 2, minRange: 0, maxRange: 0, damage: 0, type: 'DEFENSIVE', faction: Faction.MERCENARY },

  // NEW SPELLS
  'abyssal_strike': { id: 'abyssal_strike', name: 'Frappe Abyssale', description: 'Une attaque rapide qui inflige des dégâts critiques par derrière.', apCost: 4, minRange: 1, maxRange: 1, damage: 35, type: 'OFFENSIVE', faction: Faction.HUMAN },
  'toxic_dart': { id: 'toxic_dart', name: 'Dard Toxique', description: 'Injecte un poison lent mais mortel.', apCost: 3, minRange: 1, maxRange: 4, damage: 15, type: 'OFFENSIVE', faction: Faction.ALIEN },
};
// --- MONSTRES ---
export const MONSTER_DB: Record<string, MonsterDef> = {
  'bouftou': { id: 'bouftou', name: 'Bouftou', biome: BiomeType.HUB, hp: 60, armor: 10, speed: 0.08, aggressiveness: 0.8, scale: 1.5, color: '#ffffff' },
  'tofu': { id: 'tofu', name: 'Tofu', biome: BiomeType.FUNGAL, hp: 30, armor: 0, speed: 0.15, aggressiveness: 0.3, scale: 1.0, color: '#fbbf24' },
  'piou_rouge': { id: 'piou_rouge', name: 'Piou Rouge', biome: BiomeType.HUB, hp: 20, armor: 0, speed: 0.1, aggressiveness: 0.2, scale: 0.8, color: '#ef4444' },
  'bouftou_royal': { id: 'bouftou_royal', name: 'Bouftou Royal', biome: BiomeType.HUB, hp: 1200, armor: 100, speed: 0.1, aggressiveness: 1.0, scale: 2.5, color: '#ffffff' },
  'colossus_mushroom': { id: 'colossus_mushroom', name: 'Colosse Champignon', biome: BiomeType.FUNGAL, hp: 500, armor: 50, speed: 0.05, aggressiveness: 0.8, scale: 2.5, color: '#7c3aed' }
};

// --- EQUIPEMENTS ET OBJETS ---
export const ITEMS_DB: Record<string, Equipment> = {
  'rusty_blade': {
    id: 'rusty_blade',
    name: 'Lame Rouillée',
    slot: 'WEAPON',
    rarity: Rarity.COMMON,
    statsBonus: { hp: 0, range: 0 }
  },
  'hydro_breather': {
    id: 'hydro_breather',
    name: 'Respirateur Hydro',
    slot: 'HEAD',
    rarity: Rarity.RARE,
    statsBonus: { hp: 20 }
  },
  'mercenary_cape': {
    id: 'mercenary_cape',
    name: 'Cape de Mercenaire',
    slot: 'CAPE',
    rarity: Rarity.COMMON,
    statsBonus: { armor: 10 }
  }
};

export const INITIAL_SPAWN_POS = { x: 0, y: 1, z: 0 };

// --- ANIMATIONS D'ENVIRONNEMENT ---
export const ENVIRONMENT_ANIMS: Record<string, { name: string; duration: number }[]> = {
  'tree': [
    { name: 'sway', duration: 3000 },
    { name: 'idle', duration: 1000 }
  ],
  'grass': [
    { name: 'wave', duration: 2000 }
  ],
  'water': [
    { name: 'ripple', duration: 1500 }
  ],
  'crystal': [
    { name: 'glow', duration: 2500 },
    { name: 'pulse', duration: 1800 }
  ],
  'mushroom': [
    { name: 'bioluminescence', duration: 4000 },
    { name: 'spore_release', duration: 5000 }
  ]
};

// --- PRESETS D'ANIMATION ---
export const ANIMATION_PRESETS: Record<string, { name: string; speed: number; loop: boolean }> = {
  'idle': { name: 'Idle', speed: 1.0, loop: true },
  'walk': { name: 'Walk', speed: 1.0, loop: true },
  'run': { name: 'Run', speed: 1.5, loop: true },
  'attack': { name: 'Attack', speed: 1.2, loop: false },
  'cast': { name: 'Cast Spell', speed: 1.0, loop: false },
  'hit': { name: 'Hit Reaction', speed: 1.0, loop: false },
  'death': { name: 'Death', speed: 0.8, loop: false },
  'victory': { name: 'Victory', speed: 1.0, loop: false }
};

export const PLANETS: PlanetConfig[] = [
  { id: 'aquarys', position: { x: -2000, y: 0, z: -2000 }, size: 400, color: 0x0ea5e9, groundColor: 0x0284c7, name: 'AQUARYS', biome: BiomeType.OCEAN, atmosphereColor: 0x0ea5e9, temperature: 18, gravity: 9.8, sunColor: 0xe0f2fe, moonColor: 0xbae6fd, resources: [], defaultMapId: 'ville_arkarlys', defaultFaction: 'AQUARYS' },
  { id: 'mycelion', position: { x: -500, y: 800, z: 3000 }, size: 280, color: 0x7c3aed, groundColor: 0x581c87, name: 'MYCELION', biome: BiomeType.FUNGAL, atmosphereColor: 0xc084fc, temperature: 22, gravity: 8.2, sunColor: 0xa855f7, moonColor: 0x4ade80, resources: [], defaultMapId: 'FUNGARIA_VILLE_01', defaultFaction: 'FUNGARIA' },
  { id: 'desertica', position: { x: 5000, y: 0, z: -1000 }, size: 600, color: 0xf59e0b, groundColor: 0xb45309, name: 'DÉSERTICA', biome: BiomeType.DESERT, atmosphereColor: 0xfde68a, temperature: 52, gravity: 12.5, sunColor: 0xf97316, moonColor: 0xfef3c7, resources: [], defaultMapId: 'DÉSERTICA_VILLE_01', defaultFaction: 'DÉSERTICA' },
  { id: 'station', position: { x: 0, y: 5000, z: 0 }, size: 300, color: 0x334155, groundColor: 0x1e293b, name: 'STATION SPATIALE', biome: BiomeType.HUB, atmosphereColor: 0x020617, temperature: 21, gravity: 0.8, sunColor: 0xffffff, moonColor: 0x94a3b8, resources: [], defaultMapId: 'Station_Spatiale_VILLE_01', defaultFaction: 'Station_Spatiale' },
];

export const DEFAULT_SETTINGS: GlobalSettings = {
  keys: { moveForward: 'w', moveBackward: 's', moveLeft: 'a', moveRight: 'd', jump: ' ', sprint: 'shift', toggleView: 'v', interact: 'e', menu: 'escape' },
  audio: { masterVolume: 0.8, worldVolume: 0.6, characterVolume: 0.7, effectsVolume: 0.5, customTracks: [] },
  world: { ambienceEnabled: true, dynamicAnimations: true, windIntensity: 0.2, fogDensity: 0.0001, brightness: 1.2, realismMode: false },
  video: { graphicsQuality: 'HIGH', textureQuality: 'HIGH', renderDistance: 100, shadowsEnabled: true, specialEffectsEnabled: true, antiAliasing: 4, maxFPS: 60, displayMode: 'WINDOWED' },
  cameraSensitivity: 0.002
};

export const CAMERA_PROFILES: Record<string, CameraProfile> = {
  HUB: { distance: 15, height: 8, fov: 40, minPolarAngle: 0.2, maxPolarAngle: Math.PI / 2 - 0.1, collisionOffset: 0.5 },
  TACTICAL_ISO: { distance: 60, height: 100, fov: 35, minPolarAngle: Math.PI / 3.5, maxPolarAngle: Math.PI / 3.5, collisionOffset: 1.0 },
  // 🎮 DOFUS_2D: Caméra orthographique fixe pour rendu 2D authentique
  DOFUS_2D: { distance: 200, height: 200, fov: 35, minPolarAngle: Math.PI / 4, maxPolarAngle: Math.PI / 4, collisionOffset: 0 }
};

export const ENTITY_CONFIG = {
  [EntityType.HOLOGRAM]: { color: 0x88ccff, speed: 0.15, size: 1, label: 'ÂME NEUVE', baseStats: { ...BASE_PLAYER_STATS } },
  [EntityType.HUMANOID]: { color: 0x3b82f6, speed: 0.12, size: 1, label: 'AKARLYS-SOLDIER', baseStats: { ...BASE_PLAYER_STATS } },
  [EntityType.ALIEN]: { color: 0xa855f7, speed: 0.15, size: 1.2, label: 'ZAYAN-BIO', baseStats: { ...BASE_PLAYER_STATS } },
  [EntityType.MONSTER]: { color: 0xffffff, speed: 0.08, size: 1, label: 'CRÉATURE', baseStats: { ...BASE_PLAYER_STATS } },
  [EntityType.NPC]: { color: 0xcccccc, speed: 0, size: 1, label: 'CITOYEN', baseStats: { ...BASE_PLAYER_STATS } }
};
