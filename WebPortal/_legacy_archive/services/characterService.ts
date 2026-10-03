import { Faction, Rank, CharacterModelConfig, BiomeType, Gender } from '../types';

// Configuration des rangs par faction
export const RANK_CONFIGS = {
  [Faction.HUMAN]: {
    [Rank.SOLDIER]: { name: 'Soldat', minLevel: 1, bonusMultiplier: 1.0, craftUnlock: [], equipmentSlots: 2 },
    [Rank.VETERAN]: { name: 'Vétéran', minLevel: 5, bonusMultiplier: 1.2, craftUnlock: ['lame_marea_blade'], equipmentSlots: 3 },
    [Rank.OFFICER]: { name: 'Officier', minLevel: 10, bonusMultiplier: 1.4, craftUnlock: ['armure_hydro_sentinel', 'harpon_electro_ionique'], equipmentSlots: 4 },
    [Rank.COMMANDER]: { name: 'Commandant', minLevel: 15, bonusMultiplier: 1.6, craftUnlock: ['bouclier_abyssal'], equipmentSlots: 5 },
    [Rank.GENERAL]: { name: 'Général', minLevel: 20, bonusMultiplier: 1.8, craftUnlock: ['fusil_hydra_mk4', 'armure_tactique_cerulean', 'bouclier_energetique_bluecore'], equipmentSlots: 6 }
  },
  [Faction.ALIEN]: {
    [Rank.SOLDIER]: { name: 'Mineur', minLevel: 1, bonusMultiplier: 1.0, craftUnlock: [], equipmentSlots: 2 },
    [Rank.VETERAN]: { name: 'Senior', minLevel: 5, bonusMultiplier: 1.2, craftUnlock: ['arc_organique_fungal_bow', 'cape_bioluminescente'], equipmentSlots: 3 },
    [Rank.OFFICER]: { name: 'Majeur', minLevel: 10, bonusMultiplier: 1.4, craftUnlock: ['armure_myco_specter', 'lance_spores_toxiques'], equipmentSlots: 4 },
    [Rank.COMMANDER]: { name: 'Général', minLevel: 15, bonusMultiplier: 1.6, craftUnlock: ['drone_myco_vivant'], equipmentSlots: 5 },
    [Rank.PROPHET]: { name: 'Prophète', minLevel: 20, bonusMultiplier: 2.0, craftUnlock: ['gantelet_bio_plasmatique', 'armure_nervure_alpha', 'lance_essence_violacee'], equipmentSlots: 6 }
  },
  [Faction.MERCENARY]: {
    [Rank.SOLDIER]: { name: 'Soldat', minLevel: 1, bonusMultiplier: 1.0, craftUnlock: [], equipmentSlots: 2 },
    [Rank.VETERAN]: { name: 'Vétéran', minLevel: 5, bonusMultiplier: 1.2, craftUnlock: ['lame_chiton_renforcee'], equipmentSlots: 3 },
    [Rank.OFFICER]: { name: 'Marchos', minLevel: 10, bonusMultiplier: 1.4, craftUnlock: ['armure_sun_warden', 'grenades_venin_plasma', 'moto_desert_hover'], equipmentSlots: 4 },
    [Rank.COMMANDER]: { name: 'Commandant', minLevel: 15, bonusMultiplier: 1.6, craftUnlock: ['canon_thermique_solarburst'], equipmentSlots: 5 },
    [Rank.GENERAL]: { name: 'Général', minLevel: 20, bonusMultiplier: 1.8, craftUnlock: ['arme_hybride_cross_forge_09', 'armure_yellow_viper', 'grenades_improvisées_ion_scrap'], equipmentSlots: 6 }
  }
};

// Configuration des modèles de personnages par faction et rang
export const CHARACTER_MODELS: CharacterModelConfig[] = [
  // HUMANS (AKARLYS)
  {
    faction: Faction.HUMAN,
    rank: Rank.SOLDIER,
    gender: Gender.MALE,
    modelPath: '/character/soldat_AKARLYS_homme/Animation_Walking_withSkin.fbx',
    texturePath: '/character/soldat_AKARLYS_homme/',
    iconPath: '/image_character/general_AKARLYS.png',
    scale: 1.0
  },
  {
    faction: Faction.HUMAN,
    rank: Rank.SOLDIER,
    gender: Gender.FEMALE,
    modelPath: '/character/soldat_AKARLYS_femme/Animation_Walking_withSkin.fbx',
    texturePath: '/character/soldat_AKARLYS_femme/',
    iconPath: '/image_character/general_AKARLYS.png',
    scale: 0.95
  },
  {
    faction: Faction.HUMAN,
    rank: Rank.OFFICER,
    gender: Gender.MALE,
    modelPath: '/character/general_AKARLYS/Animation_Walking_withSkin.fbx',
    texturePath: '/character/general_AKARLYS/',
    iconPath: '/image_character/general_AKARLYS.png',
    scale: 1.1
  },
  {
    faction: Faction.HUMAN,
    rank: Rank.GENERAL,
    gender: Gender.MALE,
    modelPath: '/character/marechal_AKARLYS/Animation_Walking_withSkin.fbx',
    texturePath: '/character/marechal_AKARLYS/',
    iconPath: '/image_character/marechal_AKARLYS.png',
    scale: 1.15
  },
  // ALIENS (ZAYAN)
  {
    faction: Faction.ALIEN,
    rank: Rank.SOLDIER,
    gender: Gender.MALE,
    modelPath: '/character/ZAYAN_mineur/Animation_Walking_withSkin.fbx',
    texturePath: '/character/ZAYAN_mineur/',
    iconPath: '/image_character/mineur_ZAYAN.png',
    scale: 1.1
  },
  {
    faction: Faction.ALIEN,
    rank: Rank.VETERAN,
    gender: Gender.MALE,
    modelPath: '/character/ZAYAN_senior/Animation_Walking_withSkin.fbx',
    texturePath: '/character/ZAYAN_senior/',
    iconPath: '/image_character/senior_ZAYAN.png',
    scale: 1.15
  },
  {
    faction: Faction.ALIEN,
    rank: Rank.OFFICER,
    gender: Gender.MALE,
    modelPath: '/character/ZAYAN_majeur/Animation_Walking_withSkin.fbx',
    texturePath: '/character/ZAYAN_majeur/',
    iconPath: '/image_character/majeur_ZAYAN.png',
    scale: 1.2
  },
  {
    faction: Faction.ALIEN,
    rank: Rank.COMMANDER,
    gender: Gender.MALE,
    modelPath: '/character/ZAYAN_veteran/Animation_Walking_withSkin.fbx',
    texturePath: '/character/ZAYAN_veteran/',
    iconPath: '/image_character/veteran_ZAYAN.png',
    scale: 1.25
  },
  {
    faction: Faction.ALIEN,
    rank: Rank.PROPHET,
    gender: Gender.MALE,
    modelPath: '/character/prophete_ZAYAN/Animation_Walking_withSkin.fbx',
    texturePath: '/character/prophete_ZAYAN/',
    iconPath: '/image_character/prophet_ZAYAN.png',
    scale: 1.3
  },
  {
    faction: Faction.ALIEN,
    rank: Rank.OFFICER,
    gender: Gender.MALE,
    modelPath: '/character/general_ZAYAN/Animation_Walking_withSkin.fbx',
    texturePath: '/character/general_ZAYAN/',
    iconPath: '/image_character/genral_ZAYAN.png',
    scale: 1.2
  },
  // MERCENAIRES (MEZALAYIS)
  {
    faction: Faction.MERCENARY,
    rank: Rank.SOLDIER,
    gender: Gender.MALE,
    modelPath: '/character/soldat_mercenaire_homme/Animation_Walking_withSkin.fbx',
    texturePath: '/character/soldat_mercenaire_homme/',
    iconPath: '/image_character/general_MEZALAYIS.png',
    scale: 1.0
  },
  {
    faction: Faction.MERCENARY,
    rank: Rank.SOLDIER,
    gender: Gender.FEMALE,
    modelPath: '/character/soldat_mercenaire_femme/Animation_Walking_withSkin.fbx',
    texturePath: '/character/soldat_mercenaire_femme/',
    iconPath: '/image_character/general_MEZALAYIS.png',
    scale: 0.95
  },
  {
    faction: Faction.MERCENARY,
    rank: Rank.OFFICER,
    gender: Gender.MALE,
    modelPath: '/character/Marchos_MEZALAYIS/Animation_Walking_withSkin.fbx',
    texturePath: '/character/Marchos_MEZALAYIS/',
    iconPath: '/image_character/markos_MEZALAYIS.png',
    scale: 1.1
  }
];

// Service de gestion des personnages
export class CharacterService {
  private static instance: CharacterService;

  private constructor() { }

  public static getInstance(): CharacterService {
    if (!CharacterService.instance) {
      CharacterService.instance = new CharacterService();
    }
    return CharacterService.instance;
  }

  // Obtenir la configuration d'un personnage selon faction et rang
  public getCharacterConfig(faction: Faction, rank: Rank, gender?: Gender): CharacterModelConfig | null {
    const configs = CHARACTER_MODELS.filter(c => c.faction === faction && c.rank === rank);

    if (configs.length === 0) {
      // Fallback : prendre le premier disponible pour cette faction
      const fallback = CHARACTER_MODELS.find(c => c.faction === faction);
      return fallback || null;
    }

    if (gender) {
      const gendered = configs.find(c => c.gender === gender);
      if (gendered) return gendered;
    }

    return configs[0];
  }

  // Adapter la taille du personnage selon les dimensions du monde
  public adaptCharacterScale(baseScale: number, worldSize: { x: number; y: number; z: number }): number {
    // Calculer la dimension moyenne du monde
    const avgWorldSize = (worldSize.x + worldSize.y + worldSize.z) / 3;

    // Taille de référence : 100 unités = échelle 1.0
    const referenceSize = 100;

    // Ajuster l'échelle proportionnellement
    // Plus le monde est grand, plus les personnages sont petits (relativement)
    const scaleFactor = referenceSize / Math.max(avgWorldSize, 50); // Minimum 50 pour éviter les échelles trop grandes

    // Limiter l'échelle entre 0.5 et 2.0
    const adjustedScale = Math.max(0.5, Math.min(2.0, baseScale * scaleFactor));

    return adjustedScale;
  }

  // Obtenir le rang suivant
  public getNextRank(currentRank: Rank, faction: Faction): Rank | null {
    const ranks = Object.keys(RANK_CONFIGS[faction]) as Rank[];
    const currentIndex = ranks.indexOf(currentRank);
    if (currentIndex < ranks.length - 1) {
      return ranks[currentIndex + 1];
    }
    return null;
  }

  // Vérifier si le joueur peut monter de rang
  public canRankUp(currentRank: Rank, level: number, faction: Faction): boolean {
    const nextRank = this.getNextRank(currentRank, faction);
    if (!nextRank) return false;

    const rankConfig = RANK_CONFIGS[faction][nextRank];
    return level >= rankConfig.minLevel;
  }

  // Obtenir la configuration d'un rang
  public getRankConfig(faction: Faction, rank: Rank) {
    return RANK_CONFIGS[faction]?.[rank] || null;
  }
}

export const characterService = CharacterService.getInstance();

