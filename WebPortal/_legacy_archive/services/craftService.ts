import { 
  ResourceDef, 
  CraftableItem, 
  Faction, 
  Rank, 
  Rarity, 
  BiomeType,
  CraftProgress,
  CraftStation,
  PlanetConfig
} from '../types';

// Service de gestion du craft
export class CraftService {
  private static instance: CraftService;
  private resources: Map<string, ResourceDef> = new Map();
  private craftables: Map<string, CraftableItem> = new Map();
  private craftProgress: Map<string, CraftProgress> = new Map();
  private playerInventory: Map<string, number> = new Map();
  private craftStations: Map<string, CraftStation> = new Map();

  private constructor() {
    this.initializeResources();
    this.initializeCraftables();
  }

  public static getInstance(): CraftService {
    if (!CraftService.instance) {
      CraftService.instance = new CraftService();
    }
    return CraftService.instance;
  }

  // Initialisation des ressources par planète
  private initializeResources(): void {
    // AQUARYS - Ressources Océan
    const aquarysResources: ResourceDef[] = [
      {
        id: 'cristal_aqua_lumina',
        name: 'Cristal Aqua-Lumina',
        rarity: 'RARE',
        description: 'Cristal bioluminescent qui émet une énergie bleutée',
        planetId: 'aquarys',
        biome: BiomeType.OCEAN,
        icon: '/image_craft_shop/_shop_AKARLYS_/cristal_aqua.png',
        dropRate: 0.15
      },
      {
        id: 'algue_titanite',
        name: 'Algue Titanite',
        rarity: 'COMMON',
        description: 'Fibre résistante pour armures aquatiques',
        planetId: 'aquarys',
        biome: BiomeType.OCEAN,
        icon: '/image_craft_shop/_shop_AKARLYS_/algue_titanite.png',
        dropRate: 0.4
      },
      {
        id: 'coquille_leviathan',
        name: 'Coquille de Léviathan',
        rarity: 'LEGENDARY',
        description: 'Matériau ultra-dur pour boucliers',
        planetId: 'aquarys',
        biome: BiomeType.OCEAN,
        icon: '/image_craft_shop/_shop_AKARLYS_/coquille_leviathan.png',
        dropRate: 0.05
      },
      {
        id: 'perle_hydro_ionique',
        name: 'Perle Hydro-Ionique',
        rarity: 'EPIC',
        description: 'Catalyseur pour armes énergétiques',
        planetId: 'aquarys',
        biome: BiomeType.OCEAN,
        icon: '/image_craft_shop/_shop_AKARLYS_/perle_hydro.png',
        dropRate: 0.1
      },
      {
        id: 'essence_abyssale',
        name: 'Essence Abyssale',
        rarity: 'RARE',
        description: 'Drop des créatures des profondeurs',
        planetId: 'aquarys',
        biome: BiomeType.OCEAN,
        icon: '/image_craft_shop/_shop_AKARLYS_/essence_abyssale.png',
        dropRate: 0.2
      }
    ];

    // DÉSERTICA - Ressources Désert
    const deserticaResources: ResourceDef[] = [
      {
        id: 'sable_pyro_cristallin',
        name: 'Sable Pyro-Cristallin',
        rarity: 'COMMON',
        description: 'Sable utilisé pour munitions et lasers',
        planetId: 'draelkara',
        biome: BiomeType.DESERT,
        icon: '/image_craft_shop/shop_MEZALAYIS_/sable_pyro.png',
        dropRate: 0.5
      },
      {
        id: 'carapace_scorpion_titan',
        name: 'Carapace de Scorpion Titan',
        rarity: 'RARE',
        description: 'Armure terrestre résistante',
        planetId: 'draelkara',
        biome: BiomeType.DESERT,
        icon: '/image_craft_shop/shop_MEZALAYIS_/carapace_scorpion.png',
        dropRate: 0.2
      },
      {
        id: 'venin_bioplasma',
        name: 'Venin Bioplasma',
        rarity: 'EPIC',
        description: 'Poison pour armes',
        planetId: 'draelkara',
        biome: BiomeType.DESERT,
        icon: '/image_craft_shop/shop_MEZALAYIS_/venin_bioplasma.png',
        dropRate: 0.12
      },
      {
        id: 'os_leopard_roc_alpha',
        name: 'Os de Lézard Roc-Alpha',
        rarity: 'RARE',
        description: 'Matériel solide pour armes lourdes',
        planetId: 'draelkara',
        biome: BiomeType.DESERT,
        icon: '/image_craft_shop/shop_MEZALAYIS_/os_lezard.png',
        dropRate: 0.18
      },
      {
        id: 'fragment_solaire',
        name: 'Fragment Solaire',
        rarity: 'LEGENDARY',
        description: 'Énergie thermique brute',
        planetId: 'draelkara',
        biome: BiomeType.DESERT,
        icon: '/image_craft_shop/shop_MEZALAYIS_/fragment_solaire.png',
        dropRate: 0.08
      }
    ];

    // FUNGARIA - Ressources Forêt
    const fungariaResources: ResourceDef[] = [
      {
        id: 'spore_lumineuse',
        name: 'Spore-Lumineuse',
        rarity: 'COMMON',
        description: 'Énergie organique',
        planetId: 'mycelion',
        biome: BiomeType.FUNGAL,
        icon: '/image_craft_shop/_shop_ZAYAN _/spore_lumineuse.png',
        dropRate: 0.45
      },
      {
        id: 'tronc_fungus_titan',
        name: 'Tronc Fungus-Titan',
        rarity: 'UNCOMMON',
        description: 'Matériau léger flexible',
        planetId: 'mycelion',
        biome: BiomeType.FUNGAL,
        icon: '/image_craft_shop/_shop_ZAYAN _/tronc_fungus.png',
        dropRate: 0.3
      },
      {
        id: 'glande_myco_toxique',
        name: 'Glande Myco-Toxique',
        rarity: 'RARE',
        description: 'Poison corrosif',
        planetId: 'mycelion',
        biome: BiomeType.FUNGAL,
        icon: '/image_craft_shop/_shop_ZAYAN _/glande_myco.png',
        dropRate: 0.2
      },
      {
        id: 'ecorce_bioluminescente',
        name: 'Écorce Bioluminescente',
        rarity: 'UNCOMMON',
        description: 'Élément pour équipements camouflés',
        planetId: 'mycelion',
        biome: BiomeType.FUNGAL,
        icon: '/image_craft_shop/_shop_ZAYAN _/ecorce_bio.png',
        dropRate: 0.25
      },
      {
        id: 'element_myco_cerebral',
        name: 'Élément Myco-Cérébral',
        rarity: 'ARTIFACT',
        description: 'Composant d\'IA organique',
        planetId: 'mycelion',
        biome: BiomeType.FUNGAL,
        icon: '/image_craft_shop/_shop_ZAYAN _/element_myco.png',
        dropRate: 0.03
      }
    ];

    [...aquarysResources, ...deserticaResources, ...fungariaResources].forEach(resource => {
      this.resources.set(resource.id, resource);
    });
  }

  // Initialisation des objets craftables
  private initializeCraftables(): void {
    // AQUARYS - Objets craftables
    const aquarysItems: CraftableItem[] = [
      {
        id: 'armure_hydro_sentinel',
        name: 'Armure Hydro-Sentinel',
        category: 'ARMOR',
        rarity: 'EPIC',
        faction: Faction.HUMAN,
        planetId: 'aquarys',
        minRank: Rank.OFFICER,
        minLevel: 15,
        cost: [
          { resourceId: 'algue_titanite', amount: 10 },
          { resourceId: 'cristal_aqua_lumina', amount: 3 },
          { resourceId: 'essence_abyssale', amount: 5 }
        ],
        craftTime: 8,
        description: 'Armure avec bonus respiration + résistance eau',
        icon: '/image_craft_shop/_shop_AKARLYS_/sentinel_sky.png', // Utiliser l'image disponible
        stats: {
          armor: 150,
          hp: 200,
          special: { waterResistance: 50, oxygenBonus: 30 }
        }
      },
      {
        id: 'lame_marea_blade',
        name: 'Lame Marea-Blade',
        category: 'WEAPON',
        rarity: 'RARE',
        faction: Faction.HUMAN,
        planetId: 'aquarys',
        minRank: Rank.VETERAN,
        minLevel: 10,
        cost: [
          { resourceId: 'cristal_aqua_lumina', amount: 5 },
          { resourceId: 'perle_hydro_ionique', amount: 2 }
        ],
        craftTime: 5,
        description: 'Épée fluide énergisée',
        icon: '/image_craft_shop/_shop_AKARLYS_/fusil_dassaut.png', // Utiliser l'image disponible
        stats: {
          damage: 75,
          special: { energyDamage: 25 }
        }
      },
      {
        id: 'harpon_electro_ionique',
        name: 'Harpon Électro-Ionique',
        category: 'WEAPON',
        rarity: 'EPIC',
        faction: Faction.HUMAN,
        planetId: 'aquarys',
        minRank: Rank.OFFICER,
        minLevel: 12,
        cost: [
          { resourceId: 'perle_hydro_ionique', amount: 4 },
          { resourceId: 'essence_abyssale', amount: 3 }
        ],
        craftTime: 7,
        description: 'Arme à distance sous-marine',
        icon: '/image_craft_shop/_shop_AKARLYS_/sniper.png', // Utiliser l'image disponible
        stats: {
          damage: 90,
          special: { range: 50, electricDamage: 30 }
        }
      },
      {
        id: 'propulseur_sous_marin',
        name: 'Propulseur Sous-Marin',
        category: 'GADGET',
        rarity: 'RARE',
        faction: 'NEUTRAL',
        planetId: 'aquarys',
        minLevel: 8,
        cost: [
          { resourceId: 'algue_titanite', amount: 8 },
          { resourceId: 'cristal_aqua_lumina', amount: 2 }
        ],
        craftTime: 6,
        description: 'Vitesse accrue dans l\'eau',
        icon: '/image_craft_shop/_shop_AKARLYS_/vehicule_terrestre.png', // Utiliser l'image disponible
        stats: {
          speed: 50,
          special: { swimSpeed: 100 }
        }
      },
      {
        id: 'bouclier_abyssal',
        name: 'Bouclier Abyssal',
        category: 'ARMOR',
        rarity: 'LEGENDARY',
        faction: Faction.HUMAN,
        planetId: 'aquarys',
        minRank: Rank.COMMANDER,
        minLevel: 20,
        cost: [
          { resourceId: 'coquille_leviathan', amount: 1 },
          { resourceId: 'cristal_aqua_lumina', amount: 10 },
          { resourceId: 'essence_abyssale', amount: 8 }
        ],
        craftTime: 15,
        description: 'Bouclier à base de Coquille de Léviathan',
        icon: '/image_craft_shop/_shop_AKARLYS_/vehicule_terreste_tank.png', // Utiliser l'image disponible
        stats: {
          armor: 300,
          hp: 100,
          special: { blockChance: 40, waterResistance: 80 }
        }
      }
    ];

    // DÉSERTICA - Objets craftables
    const deserticaItems: CraftableItem[] = [
      {
        id: 'armure_sun_warden',
        name: 'Armure Sun-Warden',
        category: 'ARMOR',
        rarity: 'EPIC',
        faction: Faction.MERCENARY,
        planetId: 'draelkara',
        minRank: Rank.OFFICER,
        minLevel: 15,
        cost: [
          { resourceId: 'carapace_scorpion_titan', amount: 8 },
          { resourceId: 'fragment_solaire', amount: 2 }
        ],
        craftTime: 10,
        description: 'Protection chaleur + résistance toxines',
        icon: '/image_craft_shop/shop_MEZALAYIS_/vehicule_bugi.png', // Utiliser l'image disponible
        stats: {
          armor: 180,
          hp: 180,
          special: { heatResistance: 60, toxinResistance: 40 }
        }
      },
      {
        id: 'canon_thermique_solarburst',
        name: 'Canon Thermique SolarBurst',
        category: 'WEAPON',
        rarity: 'LEGENDARY',
        faction: Faction.MERCENARY,
        planetId: 'draelkara',
        minRank: Rank.COMMANDER,
        minLevel: 18,
        cost: [
          { resourceId: 'fragment_solaire', amount: 3 },
          { resourceId: 'sable_pyro_cristallin', amount: 15 },
          { resourceId: 'os_leopard_roc_alpha', amount: 5 }
        ],
        craftTime: 12,
        description: 'Canon thermique puissant',
        icon: '/image_craft_shop/shop_MEZALAYIS_/fusill_dassaut.png', // Utiliser l'image disponible
        stats: {
          damage: 120,
          special: { fireDamage: 50, areaDamage: 30 }
        }
      },
      {
        id: 'lame_chiton_renforcee',
        name: 'Lame Chiton Renforcée',
        category: 'WEAPON',
        rarity: 'RARE',
        faction: Faction.MERCENARY,
        planetId: 'draelkara',
        minRank: Rank.VETERAN,
        minLevel: 10,
        cost: [
          { resourceId: 'carapace_scorpion_titan', amount: 4 },
          { resourceId: 'os_leopard_roc_alpha', amount: 3 }
        ],
        craftTime: 6,
        description: 'Lame renforcée',
        icon: '/image_craft_shop/shop_MEZALAYIS_/epe_sanglante.png', // Utiliser l'image disponible
        stats: {
          damage: 80,
          special: { armorPenetration: 20 }
        }
      },
      {
        id: 'grenades_venin_plasma',
        name: 'Grenades Venin-Plasma',
        category: 'WEAPON',
        rarity: 'EPIC',
        faction: Faction.MERCENARY,
        planetId: 'draelkara',
        minRank: Rank.OFFICER,
        minLevel: 12,
        cost: [
          { resourceId: 'venin_bioplasma', amount: 5 },
          { resourceId: 'sable_pyro_cristallin', amount: 8 }
        ],
        craftTime: 7,
        description: 'Grenades toxiques',
        icon: '/image_craft_shop/shop_MEZALAYIS_/pistollet.png', // Utiliser l'image disponible
        stats: {
          damage: 60,
          special: { poisonDamage: 40, areaDamage: 25 }
        }
      },
      {
        id: 'moto_desert_hover',
        name: 'Moto-Desert Hover',
        category: 'VEHICLE',
        rarity: 'EPIC',
        faction: Faction.MERCENARY,
        planetId: 'draelkara',
        minRank: Rank.OFFICER,
        minLevel: 14,
        cost: [
          { resourceId: 'fragment_solaire', amount: 2 },
          { resourceId: 'carapace_scorpion_titan', amount: 6 },
          { resourceId: 'sable_pyro_cristallin', amount: 12 }
        ],
        craftTime: 10,
        description: 'Module craft véhicule désertique',
        icon: '/image_craft_shop/shop_MEZALAYIS_/vehicule_aerien.png', // Utiliser l'image disponible
        stats: {
          speed: 100,
          hp: 300,
          special: { sandSpeed: 150 }
        }
      }
    ];

    // FUNGARIA - Objets craftables
    const fungariaItems: CraftableItem[] = [
      {
        id: 'armure_myco_specter',
        name: 'Armure Myco-Specter',
        category: 'ARMOR',
        rarity: 'EPIC',
        faction: Faction.ALIEN,
        planetId: 'mycelion',
        minRank: Rank.OFFICER,
        minLevel: 15,
        cost: [
          { resourceId: 'tronc_fungus_titan', amount: 10 },
          { resourceId: 'ecorce_bioluminescente', amount: 5 }
        ],
        craftTime: 9,
        description: 'Camouflage + silence',
        icon: '/image_craft_shop/_shop_ZAYAN _/Nocturnal_Soar.png', // Utiliser l'image disponible
        stats: {
          armor: 140,
          hp: 160,
          special: { stealth: 70, silence: 50 }
        }
      },
      {
        id: 'arc_organique_fungal_bow',
        name: 'Arc Organique Fungal-Bow',
        category: 'WEAPON',
        rarity: 'RARE',
        faction: Faction.ALIEN,
        planetId: 'mycelion',
        minRank: Rank.VETERAN,
        minLevel: 10,
        cost: [
          { resourceId: 'tronc_fungus_titan', amount: 6 },
          { resourceId: 'spore_lumineuse', amount: 8 }
        ],
        craftTime: 6,
        description: 'Munitions spore-explosives',
        icon: '/image_craft_shop/_shop_ZAYAN _/Khouya.png', // Utiliser l'image disponible
        stats: {
          damage: 70,
          special: { sporeDamage: 30, explosive: 1 }
        }
      },
      {
        id: 'lance_spores_toxiques',
        name: 'Lance-Spores Toxiques',
        category: 'WEAPON',
        rarity: 'EPIC',
        faction: Faction.ALIEN,
        planetId: 'mycelion',
        minRank: Rank.OFFICER,
        minLevel: 13,
        cost: [
          { resourceId: 'glande_myco_toxique', amount: 6 },
          { resourceId: 'spore_lumineuse', amount: 10 }
        ],
        craftTime: 8,
        description: 'Lanceur de spores toxiques',
        icon: '/image_craft_shop/_shop_ZAYAN _/Mashibhoomm.png', // Utiliser l'image disponible
        stats: {
          damage: 85,
          special: { poisonDamage: 50, areaDamage: 20 }
        }
      },
      {
        id: 'drone_myco_vivant',
        name: 'Drone Myco-Vivant',
        category: 'GADGET',
        rarity: 'LEGENDARY',
        faction: Faction.ALIEN,
        planetId: 'mycelion',
        minRank: Rank.COMMANDER,
        minLevel: 20,
        cost: [
          { resourceId: 'element_myco_cerebral', amount: 1 },
          { resourceId: 'tronc_fungus_titan', amount: 8 },
          { resourceId: 'ecorce_bioluminescente', amount: 6 }
        ],
        craftTime: 15,
        description: 'Drone organique intelligent',
        icon: '/image_craft_shop/_shop_ZAYAN _/araigné_vehicule.png', // Utiliser l'image disponible
        stats: {
          hp: 150,
          special: { aiAssist: 100, scouting: 80 }
        }
      },
      {
        id: 'cape_bioluminescente',
        name: 'Cape Bioluminescente',
        category: 'ARMOR',
        rarity: 'RARE',
        faction: Faction.ALIEN,
        planetId: 'mycelion',
        minRank: Rank.VETERAN,
        minLevel: 11,
        cost: [
          { resourceId: 'ecorce_bioluminescente', amount: 8 },
          { resourceId: 'spore_lumineuse', amount: 5 }
        ],
        craftTime: 5,
        description: 'Cape avec effet lumineux',
        icon: '/image_craft_shop/_shop_ZAYAN _/Zanaboum.png', // Utiliser l'image disponible
        stats: {
          armor: 60,
          special: { lightEmission: 100, stealth: 30 }
        }
      }
    ];

    // Crafts exclusifs par faction (HUB)
    const factionExclusiveItems: CraftableItem[] = [
      // HUMANS (AKARLYS)
      {
        id: 'fusil_hydra_mk4',
        name: 'Fusil Hydra-MK4',
        category: 'WEAPON',
        rarity: 'LEGENDARY',
        faction: Faction.HUMAN,
        planetId: 'hub', // Disponible au HUB
        minRank: Rank.GENERAL,
        minLevel: 25,
        cost: [
          { resourceId: 'cristal_aqua_lumina', amount: 10 },
          { resourceId: 'fragment_solaire', amount: 5 }
        ],
        craftTime: 15,
        description: 'Fusil d\'élite humain',
        icon: '/image_craft_shop/_shop_AKARLYS_/fusil_hydra.png',
        stats: {
          damage: 150,
          special: { multiShot: 3, accuracy: 95 }
        }
      },
      {
        id: 'armure_tactique_cerulean',
        name: 'Armure Tactique Cerulean',
        category: 'ARMOR',
        rarity: 'LEGENDARY',
        faction: Faction.HUMAN,
        planetId: 'hub',
        minRank: Rank.GENERAL,
        minLevel: 25,
        cost: [
          { resourceId: 'algue_titanite', amount: 15 },
          { resourceId: 'carapace_scorpion_titan', amount: 10 }
        ],
        craftTime: 18,
        description: 'Armure tactique d\'élite',
        icon: '/image_craft_shop/_shop_AKARLYS_/armure_cerulean.png',
        stats: {
          armor: 250,
          hp: 300,
          special: { allResistance: 40 }
        }
      },
      {
        id: 'bouclier_energetique_bluecore',
        name: 'Bouclier Énergétique BlueCore',
        category: 'ARMOR',
        rarity: 'ARTIFACT',
        faction: Faction.HUMAN,
        planetId: 'hub',
        minRank: Rank.GENERAL,
        minLevel: 30,
        cost: [
          { resourceId: 'perle_hydro_ionique', amount: 10 },
          { resourceId: 'fragment_solaire', amount: 8 },
          { resourceId: 'element_myco_cerebral', amount: 2 }
        ],
        craftTime: 20,
        description: 'Bouclier énergétique avancé',
        icon: '/image_craft_shop/_shop_AKARLYS_/bouclier_bluecore.png',
        stats: {
          armor: 400,
          hp: 200,
          special: { energyShield: 100, recharge: 50 }
        }
      },
      // ALIENS (ZAYAN)
      {
        id: 'gantelet_bio_plasmatique',
        name: 'Gantelet Bio-Plasmatique',
        category: 'WEAPON',
        rarity: 'LEGENDARY',
        faction: Faction.ALIEN,
        planetId: 'hub',
        minRank: Rank.PROPHET,
        minLevel: 25,
        cost: [
          { resourceId: 'essence_abyssale', amount: 10 },
          { resourceId: 'glande_myco_toxique', amount: 8 }
        ],
        craftTime: 15,
        description: 'Gantelet vivant',
        icon: '/image_craft_shop/_shop_ZAYAN _/gantelet_bio.png',
        stats: {
          damage: 140,
          special: { bioDamage: 60, lifesteal: 20 }
        }
      },
      {
        id: 'armure_nervure_alpha',
        name: 'Armure Nervure-Alpha',
        category: 'ARMOR',
        rarity: 'LEGENDARY',
        faction: Faction.ALIEN,
        planetId: 'hub',
        minRank: Rank.PROPHET,
        minLevel: 25,
        cost: [
          { resourceId: 'tronc_fungus_titan', amount: 15 },
          { resourceId: 'algue_titanite', amount: 10 }
        ],
        craftTime: 18,
        description: 'Armure organique vivante',
        icon: '/image_craft_shop/_shop_ZAYAN _/armure_nervure.png',
        stats: {
          armor: 220,
          hp: 350,
          special: { regeneration: 5, bioResistance: 50 }
        }
      },
      {
        id: 'lance_essence_violacee',
        name: 'Lance-Essence Violacée',
        category: 'WEAPON',
        rarity: 'ARTIFACT',
        faction: Faction.ALIEN,
        planetId: 'hub',
        minRank: Rank.PROPHET,
        minLevel: 30,
        cost: [
          { resourceId: 'element_myco_cerebral', amount: 3 },
          { resourceId: 'essence_abyssale', amount: 12 },
          { resourceId: 'glande_myco_toxique', amount: 10 }
        ],
        craftTime: 20,
        description: 'Lance organique puissante',
        icon: '/image_craft_shop/_shop_ZAYAN _/lance_essence.png',
        stats: {
          damage: 180,
          special: { bioDamage: 80, areaDamage: 40 }
        }
      },
      // MERCENAIRES (MEZALAYIS)
      {
        id: 'arme_hybride_cross_forge_09',
        name: 'Arme Hybride Cross-Forge 09',
        category: 'WEAPON',
        rarity: 'LEGENDARY',
        faction: Faction.MERCENARY,
        planetId: 'hub',
        minRank: Rank.GENERAL,
        minLevel: 25,
        cost: [
          { resourceId: 'sable_pyro_cristallin', amount: 15 },
          { resourceId: 'spore_lumineuse', amount: 10 },
          { resourceId: 'cristal_aqua_lumina', amount: 8 }
        ],
        craftTime: 15,
        description: 'Arme hybride alien/humain',
        icon: '/image_craft_shop/shop_MEZALAYIS_/cross_forge.png',
        stats: {
          damage: 160,
          special: { hybridDamage: 70, versatility: 80 }
        }
      },
      {
        id: 'armure_yellow_viper',
        name: 'Armure Yellow Viper',
        category: 'ARMOR',
        rarity: 'LEGENDARY',
        faction: Faction.MERCENARY,
        planetId: 'hub',
        minRank: Rank.GENERAL,
        minLevel: 25,
        cost: [
          { resourceId: 'carapace_scorpion_titan', amount: 12 },
          { resourceId: 'tronc_fungus_titan', amount: 10 }
        ],
        craftTime: 18,
        description: 'Armure de mercenaire d\'élite',
        icon: '/image_craft_shop/shop_MEZALAYIS_/armure_viper.png',
        stats: {
          armor: 240,
          hp: 280,
          special: { adaptability: 60, allResistance: 30 }
        }
      },
      {
        id: 'grenades_improvisées_ion_scrap',
        name: 'Grenades Improvisées Ion-Scrap',
        category: 'WEAPON',
        rarity: 'EPIC',
        faction: Faction.MERCENARY,
        planetId: 'hub',
        minRank: Rank.OFFICER,
        minLevel: 20,
        cost: [
          { resourceId: 'sable_pyro_cristallin', amount: 10 },
          { resourceId: 'spore_lumineuse', amount: 8 }
        ],
        craftTime: 8,
        description: 'Grenades improvisées',
        icon: '/image_craft_shop/shop_MEZALAYIS_/grenades_ion.png',
        stats: {
          damage: 100,
          special: { areaDamage: 50, chaos: 40 }
        }
      }
    ];

    [...aquarysItems, ...deserticaItems, ...fungariaItems, ...factionExclusiveItems].forEach(item => {
      this.craftables.set(item.id, item);
    });
  }

  // Obtenir toutes les ressources d'une planète
  public getResourcesByPlanet(planetId: string): ResourceDef[] {
    return Array.from(this.resources.values()).filter(r => r.planetId === planetId);
  }

  // Obtenir tous les objets craftables
  public getCraftablesByPlanet(planetId: string, faction: Faction, rank: Rank, level: number): CraftableItem[] {
    return Array.from(this.craftables.values()).filter(item => {
      if (item.planetId !== planetId && item.planetId !== 'hub') return false;
      if (item.faction !== 'NEUTRAL' && item.faction !== faction) return false;
      if (item.minRank && this.compareRanks(rank, item.minRank) < 0) return false;
      if (item.minLevel > level) return false;
      return true;
    });
  }

  // Comparer les rangs
  private compareRanks(rank1: Rank, rank2: Rank): number {
    const rankOrder = [Rank.SOLDIER, Rank.VETERAN, Rank.OFFICER, Rank.COMMANDER, Rank.GENERAL, Rank.PROPHET];
    const index1 = rankOrder.indexOf(rank1);
    const index2 = rankOrder.indexOf(rank2);
    return index1 - index2;
  }

  // Vérifier si le joueur peut crafter un objet
  public canCraft(itemId: string, inventory: Map<string, number>, rank: Rank, level: number): { can: boolean; reason?: string } {
    const item = this.craftables.get(itemId);
    if (!item) return { can: false, reason: 'Item introuvable' };

    if (item.minRank && this.compareRanks(rank, item.minRank) < 0) {
      return { can: false, reason: `Rang ${item.minRank} requis` };
    }

    if (item.minLevel > level) {
      return { can: false, reason: `Niveau ${item.minLevel} requis` };
    }

    for (const cost of item.cost) {
      const available = inventory.get(cost.resourceId) || 0;
      if (available < cost.amount) {
        return { can: false, reason: `Ressource ${cost.resourceId} insuffisante` };
      }
    }

    return { can: true };
  }

  // Démarrer un craft
  public startCraft(itemId: string, inventory: Map<string, number>, rank: Rank, level: number): { success: boolean; progressId?: string; reason?: string } {
    const check = this.canCraft(itemId, inventory, rank, level);
    if (!check.can) {
      return { success: false, reason: check.reason };
    }

    const item = this.craftables.get(itemId);
    if (!item) return { success: false, reason: 'Item introuvable' };

    // Consommer les ressources
    for (const cost of item.cost) {
      const current = inventory.get(cost.resourceId) || 0;
      inventory.set(cost.resourceId, current - cost.amount);
    }

    // Créer le progrès de craft
    const progressId = `craft_${Date.now()}_${Math.random()}`;
    const progress: CraftProgress = {
      itemId,
      startTime: Date.now(),
      duration: item.craftTime * 1000,
      completed: false
    };

    this.craftProgress.set(progressId, progress);
    return { success: true, progressId };
  }

  // Vérifier les crafts en cours
  public checkCraftProgress(): { completed: string[]; inProgress: CraftProgress[] } {
    const completed: string[] = [];
    const inProgress: CraftProgress[] = [];

    this.craftProgress.forEach((progress, id) => {
      if (progress.completed) {
        completed.push(id);
      } else {
        const elapsed = Date.now() - progress.startTime;
        if (elapsed >= progress.duration) {
          progress.completed = true;
          completed.push(id);
        } else {
          inProgress.push(progress);
        }
      }
    });

    // Nettoyer les crafts complétés
    completed.forEach(id => this.craftProgress.delete(id));

    return { completed, inProgress };
  }

  // Obtenir un objet crafté
  public getCraftedItem(progressId: string): CraftableItem | null {
    const progress = this.craftProgress.get(progressId);
    if (!progress || !progress.completed) return null;
    return this.craftables.get(progress.itemId) || null;
  }

  // Obtenir toutes les ressources
  public getAllResources(): ResourceDef[] {
    return Array.from(this.resources.values());
  }

  // Obtenir tous les objets craftables
  public getAllCraftables(): CraftableItem[] {
    return Array.from(this.craftables.values());
  }
}

export const craftService = CraftService.getInstance();

