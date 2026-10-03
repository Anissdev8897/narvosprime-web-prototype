import { BossDef, BossEntity, BossAbility, Faction, Vector3, BiomeType, Rarity } from '../types';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// Service de gestion des boss
export class BossService {
  private static instance: BossService;
  private bossDefs: Map<string, BossDef> = new Map();
  private activeBosses: Map<string, BossEntity> = new Map();

  private constructor() {
    this.initializeBosses();
  }

  public static getInstance(): BossService {
    if (!BossService.instance) {
      BossService.instance = new BossService();
    }
    return BossService.instance;
  }

  private initializeBosses(): void {
    // Colosse-Champignon
    const colosseChampi: BossDef = {
      id: 'colosse_champi',
      name: 'Colosse-Champignon',
      biome: BiomeType.FUNGAL,
      hp: 250000,
      armor: 800,
      speed: 0.02,
      aggressiveness: 0.2,
      scale: 6.0,
      color: '#581c87',
      type: 'BOSS',
      abilities: [
        {
          name: 'rayon_toxic',
          type: 'AOE',
          damageOverTime: { dps: 0.25, duration: 10 },
          effect: 'POISON',
          effectDuration: 10,
          cooldown: 15,
          range: 20,
          area: 8
        },
        {
          name: 'coup_de_champi',
          type: 'SINGLE_TARGET',
          damage: 500,
          effect: 'IMMOBILIZE',
          effectDuration: 10,
          cooldown: 20,
          range: 5
        },
        {
          name: 'spawn_minions',
          type: 'SPAWN_MINIONS',
          cooldown: 30
        }
      ],
      recommendedGroup: {
        minPlayers: 5,
        minLevel: 40
      },
      spawnConditions: {
        zone: ['grotte_profonde', 'cavernes_lumineuses'],
        requiresGroup: true,
        minPlayers: 5,
        minLevel: 40
      },
      lootTable: [
        { itemId: 'spore_core', chance: 0.005, minAmount: 1, maxAmount: 1 },
        { itemId: 'fungal_hide', chance: 0.12, minAmount: 2, maxAmount: 5 },
        { itemId: 'champi_coeur', chance: 0.02, minAmount: 1, maxAmount: 1 }
      ],
      phaseThresholds: [0.75, 0.5, 0.25] // Phases à 75%, 50%, 25% HP
    };

    // Spores-Racines Rampantes
    const sporesRacines: BossDef = {
      id: 'spores_racines',
      name: 'Spores-Racines Rampantes',
      biome: BiomeType.FUNGAL,
      hp: 120000,
      armor: 400,
      speed: 0.15,
      aggressiveness: 0.6,
      scale: 3.0,
      color: '#4c1d95',
      type: 'BOSS',
      abilities: [
        {
          name: 'griffes_empoisonnees',
          type: 'SINGLE_TARGET',
          damage: 50,
          effect: 'IMMOBILIZE',
          effectDuration: 3,
          cooldown: 8,
          range: 3
        },
        {
          name: 'boule_toxique',
          type: 'PROJECTILE',
          damage: 20,
          effect: 'PARALYZE',
          effectDuration: 20,
          cooldown: 12,
          telegraphTime: 2,
          range: 15
        }
      ],
      recommendedGroup: {
        minPlayers: 3,
        minLevel: 30
      },
      spawnConditions: {
        zone: ['cavernes_humides', 'zones_racinaires'],
        requiresGroup: false,
        minLevel: 30
      },
      lootTable: [
        { itemId: 'spore_rare', chance: 0.15, minAmount: 1, maxAmount: 3 },
        { itemId: 'fibre_racinaire', chance: 0.25, minAmount: 2, maxAmount: 4 }
      ]
    };

    // Serpent_Sentinel
    const serpentSentinel: BossDef = {
      id: 'serpent_sentinel',
      name: 'Serpent_Sentinel',
      biome: BiomeType.DESERT,
      hp: 150000,
      armor: 600,
      speed: 0.2,
      aggressiveness: 0.7,
      scale: 4.0,
      color: '#92400e',
      type: 'BOSS',
      abilities: [
        {
          name: 'coups_rapides',
          type: 'SINGLE_TARGET',
          damage: 80,
          effect: 'POISON',
          effectDuration: 5,
          cooldown: 5,
          range: 4
        },
        {
          name: 'balayage_aire',
          type: 'AOE',
          damage: 60,
          cooldown: 10,
          range: 12,
          area: 6
        },
        {
          name: 'alerte_renforts',
          type: 'SPAWN_MINIONS',
          cooldown: 45
        }
      ],
      recommendedGroup: {
        minPlayers: 4,
        minLevel: 35
      },
      spawnConditions: {
        zone: ['zones_garde', 'ruines_anciennes'],
        requiresGroup: false,
        minLevel: 35
      },
      lootTable: [
        { itemId: 'ecailles_resistantes', chance: 0.1, minAmount: 3, maxAmount: 6 },
        { itemId: 'venin_concentre', chance: 0.05, minAmount: 1, maxAmount: 2 }
      ]
    };

    // Megalarmure
    const megalarmure: BossDef = {
      id: 'megalarmure',
      name: 'Megalarmure',
      biome: BiomeType.DESERT,
      hp: 300000,
      armor: 1200,
      speed: 0.05,
      aggressiveness: 0.3,
      scale: 5.0,
      color: '#78350f',
      type: 'BOSS',
      abilities: [
        {
          name: 'boulets',
          type: 'PROJECTILE',
          damage: 150,
          cooldown: 8,
          telegraphTime: 1.5,
          range: 20
        },
        {
          name: 'champ_force',
          type: 'AOE',
          damage: 100,
          cooldown: 15,
          range: 10,
          area: 8
        },
        {
          name: 'charge_lourde',
          type: 'SINGLE_TARGET',
          damage: 300,
          cooldown: 25,
          range: 8
        }
      ],
      recommendedGroup: {
        minPlayers: 5,
        minLevel: 45
      },
      spawnConditions: {
        zone: ['forteresse_abandonnee', 'usine_ruinee'],
        requiresGroup: true,
        minPlayers: 4,
        minLevel: 45
      },
      lootTable: [
        { itemId: 'plate_mecha', chance: 0.03, minAmount: 1, maxAmount: 3 },
        { itemId: 'composant_mecanique', chance: 0.15, minAmount: 2, maxAmount: 5 }
      ],
      phaseThresholds: [0.5] // Point faible exposé à 50% HP
    };

    // Crapaud Désertique Toxique
    const crapaudDesertique: BossDef = {
      id: 'crapaud_desertique',
      name: 'Crapaud Désertique Toxique',
      biome: BiomeType.DESERT,
      hp: 180000,
      armor: 500,
      speed: 0.08,
      aggressiveness: 0.4,
      scale: 4.5,
      color: '#3f6212',
      type: 'BOSS',
      abilities: [
        {
          name: 'sauts_massifs',
          type: 'AOE',
          damage: 120,
          cooldown: 12,
          range: 15,
          area: 5
        },
        {
          name: 'crocs_corrosifs',
          type: 'SINGLE_TARGET',
          damage: 90,
          effect: 'POISON',
          effectDuration: 8,
          cooldown: 6,
          range: 3
        },
        {
          name: 'vomissements_toxiques',
          type: 'AOE',
          damage: 70,
          damageOverTime: { dps: 0.15, duration: 12 },
          effect: 'POISON',
          effectDuration: 12,
          cooldown: 20,
          range: 8,
          area: 6
        }
      ],
      recommendedGroup: {
        minPlayers: 4,
        minLevel: 38
      },
      spawnConditions: {
        zone: ['dunes_profondes', 'oasis_cachee'],
        requiresGroup: false,
        minLevel: 38
      },
      lootTable: [
        { itemId: 'peau_crapaud', chance: 0.08, minAmount: 2, maxAmount: 4 },
        { itemId: 'glande_toxique', chance: 0.12, minAmount: 1, maxAmount: 2 }
      ]
    };

    // Scorpion à Deux Têtes
    const scorpionDeuxTetes: BossDef = {
      id: 'scorpion_deux_tetes',
      name: 'Scorpion à Deux Têtes',
      biome: BiomeType.DESERT,
      hp: 200000,
      armor: 700,
      speed: 0.12,
      aggressiveness: 0.8,
      scale: 4.0,
      color: '#78350f',
      type: 'BOSS',
      abilities: [
        {
          name: 'piqures_doubles',
          type: 'SINGLE_TARGET',
          damage: 100,
          effect: 'POISON',
          effectDuration: 15,
          cooldown: 7,
          range: 4
        },
        {
          name: 'queue_rotation',
          type: 'AOE',
          damage: 80,
          effect: 'POISON',
          effectDuration: 10,
          cooldown: 10,
          range: 8,
          area: 6
        },
        {
          name: 'stingers_toxiques',
          type: 'PROJECTILE',
          damage: 60,
          effect: 'POISON',
          effectDuration: 20,
          cooldown: 8,
          telegraphTime: 1,
          range: 12
        }
      ],
      recommendedGroup: {
        minPlayers: 5,
        minLevel: 42
      },
      spawnConditions: {
        zone: ['cavernes_scorpion', 'ruines_enfouies'],
        requiresGroup: true,
        minPlayers: 4,
        minLevel: 42
      },
      lootTable: [
        { itemId: 'carapace_scorpion_titan', chance: 0.2, minAmount: 1, maxAmount: 2 },
        { itemId: 'venin_bioplasma', chance: 0.12, minAmount: 1, maxAmount: 3 }
      ]
    };

    // Enregistrer tous les boss
    this.bossDefs.set('colosse_champi', colosseChampi);
    this.bossDefs.set('spores_racines', sporesRacines);
    this.bossDefs.set('serpent_sentinel', serpentSentinel);
    this.bossDefs.set('megalarmure', megalarmure);
    this.bossDefs.set('crapaud_desertique', crapaudDesertique);
    this.bossDefs.set('scorpion_deux_tetes', scorpionDeuxTetes);
  }

  // Obtenir un boss par ID
  public getBossDef(bossId: string): BossDef | null {
    return this.bossDefs.get(bossId) || null;
  }

  // Obtenir tous les boss
  public getAllBosses(): BossDef[] {
    return Array.from(this.bossDefs.values());
  }

  // Obtenir les boss par biome
  public getBossesByBiome(biome: BiomeType): BossDef[] {
    return Array.from(this.bossDefs.values()).filter(boss => boss.biome === biome);
  }

  // Vérifier si les conditions de spawn sont remplies
  public canSpawnBoss(
    bossId: string,
    zone: string,
    playerCount: number,
    minLevel: number
  ): { can: boolean; reason?: string } {
    const boss = this.getBossDef(bossId);
    if (!boss) return { can: false, reason: 'Boss introuvable' };

    const conditions = boss.spawnConditions;

    // Vérifier la zone
    if (!conditions.zone.includes(zone)) {
      return { can: false, reason: 'Zone incorrecte' };
    }

    // Vérifier le niveau
    if (conditions.minLevel && minLevel < conditions.minLevel) {
      return { can: false, reason: `Niveau ${conditions.minLevel} requis` };
    }

    // Vérifier le groupe
    if (conditions.requiresGroup) {
      if (conditions.minPlayers && playerCount < conditions.minPlayers) {
        return { can: false, reason: `${conditions.minPlayers} joueurs minimum requis` };
      }
    }

    return { can: true };
  }

  // Créer une entité boss
  public createBossEntity(bossId: string, position: Vector3): BossEntity | null {
    const bossDef = this.getBossDef(bossId);
    if (!bossDef) return null;

    const bossEntity: BossEntity = {
      id: `boss_${bossId}_${Date.now()}`,
      bossDef,
      monsterDef: bossDef,
      position,
      velocity: { x: 0, y: 0, z: 0 },
      rotation: 0,
      currentState: 'IDLE' as any,
      lastAIUpdate: Date.now(),
      stats: {
        hp: bossDef.hp,
        maxHp: bossDef.hp,
        armor: bossDef.armor,
        maxArmor: bossDef.armor,
        oxygen: 0,
        maxOxygen: 0,
        ap: 6,
        maxAp: 6,
        mp: 3,
        maxMp: 3,
        range: 0
      },
      aiModelType: 'AGGRESSIVE',
      currentPhase: 0,
      abilityCooldowns: new Map(),
      lastAbilityTime: new Map(),
      spawnedMinions: []
    };

    // Initialiser les cooldowns
    bossDef.abilities.forEach(ability => {
      bossEntity.abilityCooldowns.set(ability.name, 0);
      bossEntity.lastAbilityTime.set(ability.name, 0);
    });

    this.activeBosses.set(bossEntity.id, bossEntity);
    return bossEntity;
  }

  // Obtenir les boss actifs
  public getActiveBosses(): BossEntity[] {
    return Array.from(this.activeBosses.values());
  }

  // Retirer un boss actif
  public removeBoss(bossId: string): void {
    this.activeBosses.delete(bossId);
  }

  // Générer le loot d'un boss
  public generateBossLoot(bossId: string): { itemId: string; amount: number }[] {
    const boss = this.getBossDef(bossId);
    if (!boss) return [];

    const loot: { itemId: string; amount: number }[] = [];

    boss.lootTable.forEach(drop => {
      if (Math.random() < drop.chance) {
        const amount = Math.floor(
          Math.random() * (drop.maxAmount - (drop.minAmount || 1) + 1) + (drop.minAmount || 1)
        );
        loot.push({ itemId: drop.itemId, amount });
      }
    });

    return loot;
  }
}

export const bossService = BossService.getInstance();

