import { Vector3, Faction, BiomeType } from '../types';
import { PlanetConfig } from '../types';

/**
 * Service de gestion des zones de sécurité et d'XP
 */
export interface SafeZone {
  id: string;
  center: Vector3;
  radius: number;
  faction: Faction;
  planetId: string;
  type: 'SPAWN' | 'VILLAGE' | 'BASE';
}

export interface XPZone {
  id: string;
  center: Vector3;
  radius: number;
  minLevel: number;
  maxLevel: number;
  planetId: string;
  biome?: BiomeType;
  mobDensity: number; // Nombre de mobs par unité de surface
  allowedMobTypes: string[]; // IDs des types de mobs autorisés
}

export interface BossZone {
  id: string;
  center: Vector3;
  radius: number;
  planetId: string;
  bossId: string;
  accessType: 'CAVE' | 'DEEP' | 'DANGEROUS';
  minLevel: number;
  requiresGroup: boolean;
  minPlayers?: number;
}

export class ZoneService {
  private static instance: ZoneService;
  private safeZones: Map<string, SafeZone> = new Map();
  private xpZones: Map<string, XPZone> = new Map();
  private bossZones: Map<string, BossZone> = new Map();

  private constructor() {
    this.initializeZones();
  }

  public static getInstance(): ZoneService {
    if (!ZoneService.instance) {
      ZoneService.instance = new ZoneService();
    }
    return ZoneService.instance;
  }

  /**
   * Initialiser les zones pour chaque planète
   */
  private initializeZones(): void {
    // AQUARYS (Humans)
    this.createSafeZone('aquarys_spawn', { x: 0, y: 5, z: 0 }, 150, Faction.HUMAN, 'aquarys', 'SPAWN');
    this.createSafeZone('aquarys_village', { x: 50, y: 5, z: 50 }, 100, Faction.HUMAN, 'aquarys', 'VILLAGE');
    
    // MYCELION (Aliens)
    this.createSafeZone('mycelion_spawn', { x: 0, y: 5, z: 0 }, 150, Faction.ALIEN, 'mycelion', 'SPAWN');
    this.createSafeZone('mycelion_village', { x: -50, y: 5, z: -50 }, 100, Faction.ALIEN, 'mycelion', 'VILLAGE');
    
    // DRAELKARA (Mercenaries)
    this.createSafeZone('draelkara_spawn', { x: 0, y: 5, z: 0 }, 150, Faction.MERCENARY, 'draelkara', 'SPAWN');
    this.createSafeZone('draelkara_village', { x: 0, y: 5, z: 50 }, 100, Faction.MERCENARY, 'draelkara', 'VILLAGE');

    // Zones XP pour AQUARYS
    this.createXPZone('aquarys_xp_1_5', { x: 200, y: 5, z: 200 }, 100, 1, 5, 'aquarys', BiomeType.OCEAN, 0.3, ['weak_aquatic']);
    this.createXPZone('aquarys_xp_5_10', { x: 400, y: 5, z: 400 }, 120, 5, 10, 'aquarys', BiomeType.OCEAN, 0.5, ['medium_aquatic']);
    this.createXPZone('aquarys_xp_10_plus', { x: 600, y: 5, z: 600 }, 150, 10, 50, 'aquarys', BiomeType.OCEAN, 0.7, ['strong_aquatic', 'rare_aquatic']);

    // Zones XP pour MYCELION
    this.createXPZone('mycelion_xp_1_5', { x: -200, y: 5, z: -200 }, 100, 1, 5, 'mycelion', BiomeType.FUNGAL, 0.3, ['weak_fungal']);
    this.createXPZone('mycelion_xp_5_10', { x: -400, y: 5, z: -400 }, 120, 5, 10, 'mycelion', BiomeType.FUNGAL, 0.5, ['medium_fungal']);
    this.createXPZone('mycelion_xp_10_plus', { x: -600, y: 5, z: -600 }, 150, 10, 50, 'mycelion', BiomeType.FUNGAL, 0.7, ['strong_fungal', 'rare_fungal']);

    // Zones XP pour DRAELKARA
    this.createXPZone('draelkara_xp_1_5', { x: 200, y: 5, z: -200 }, 100, 1, 5, 'draelkara', BiomeType.DESERT, 0.3, ['weak_desert']);
    this.createXPZone('draelkara_xp_5_10', { x: 400, y: 5, z: -400 }, 120, 5, 10, 'draelkara', BiomeType.DESERT, 0.5, ['medium_desert']);
    this.createXPZone('draelkara_xp_10_plus', { x: 600, y: 5, z: -600 }, 150, 10, 50, 'draelkara', BiomeType.DESERT, 0.7, ['strong_desert', 'rare_desert']);

    // Zones de boss
    this.createBossZone('aquarys_boss_1', { x: -300, y: -100, z: -300 }, 30, 'aquarys', 'cybernetic_megalodon', 'DEEP', 40, true, 5);
    this.createBossZone('aquarys_boss_2', { x: 400, y: -150, z: 400 }, 40, 'aquarys', 'electric_depths_leviathan', 'DEEP', 45, true, 5);
    
    this.createBossZone('mycelion_boss_1', { x: -200, y: 5, z: -200 }, 25, 'mycelion', 'colosse_champi', 'CAVE', 40, true, 5);
    this.createBossZone('mycelion_boss_2', { x: -210, y: 5, z: -210 }, 30, 'mycelion', 'spores_racines_rampantes', 'CAVE', 45, true, 5);
    
    this.createBossZone('draelkara_boss_1', { x: -250, y: -10, z: -250 }, 20, 'draelkara', 'crapaud_desertique', 'CAVE', 40, true, 5);
    this.createBossZone('draelkara_boss_2', { x: 300, y: -15, z: 300 }, 25, 'draelkara', 'scorpion_deux_tetes', 'CAVE', 45, true, 5);
  }

  /**
   * Créer une zone de sécurité
   */
  private createSafeZone(
    id: string,
    center: Vector3,
    radius: number,
    faction: Faction,
    planetId: string,
    type: 'SPAWN' | 'VILLAGE' | 'BASE'
  ): void {
    this.safeZones.set(id, {
      id,
      center,
      radius,
      faction,
      planetId,
      type
    });
  }

  /**
   * Créer une zone d'XP
   */
  private createXPZone(
    id: string,
    center: Vector3,
    radius: number,
    minLevel: number,
    maxLevel: number,
    planetId: string,
    biome: BiomeType,
    mobDensity: number,
    allowedMobTypes: string[]
  ): void {
    this.xpZones.set(id, {
      id,
      center,
      radius,
      minLevel,
      maxLevel,
      planetId,
      biome,
      mobDensity,
      allowedMobTypes
    });
  }

  /**
   * Créer une zone de boss
   */
  private createBossZone(
    id: string,
    center: Vector3,
    radius: number,
    planetId: string,
    bossId: string,
    accessType: 'CAVE' | 'DEEP' | 'DANGEROUS',
    minLevel: number,
    requiresGroup: boolean,
    minPlayers?: number
  ): void {
    this.bossZones.set(id, {
      id,
      center,
      radius,
      planetId,
      bossId,
      accessType,
      minLevel,
      requiresGroup,
      minPlayers
    });
  }

  /**
   * Vérifier si une position est dans une zone de sécurité
   */
  public isInSafeZone(position: Vector3, planetId: string): boolean {
    for (const zone of this.safeZones.values()) {
      if (zone.planetId !== planetId) continue;
      
      const distance = Math.sqrt(
        Math.pow(position.x - zone.center.x, 2) +
        Math.pow(position.y - zone.center.y, 2) +
        Math.pow(position.z - zone.center.z, 2)
      );
      
      if (distance <= zone.radius) {
        return true;
      }
    }
    return false;
  }

  /**
   * Obtenir la zone d'XP appropriée pour un niveau
   */
  public getXPZoneForLevel(level: number, planetId: string): XPZone | null {
    for (const zone of this.xpZones.values()) {
      if (zone.planetId !== planetId) continue;
      if (level >= zone.minLevel && level <= zone.maxLevel) {
        return zone;
      }
    }
    return null;
  }

  /**
   * Obtenir toutes les zones d'XP d'une planète
   */
  public getXPZonesForPlanet(planetId: string): XPZone[] {
    return Array.from(this.xpZones.values()).filter(z => z.planetId === planetId);
  }

  /**
   * Obtenir les zones de boss d'une planète
   */
  public getBossZonesForPlanet(planetId: string): BossZone[] {
    return Array.from(this.bossZones.values()).filter(z => z.planetId === planetId);
  }

  /**
   * Vérifier si une position est dans une zone de boss
   */
  public isInBossZone(position: Vector3, planetId: string): BossZone | null {
    for (const zone of this.bossZones.values()) {
      if (zone.planetId !== planetId) continue;
      
      const distance = Math.sqrt(
        Math.pow(position.x - zone.center.x, 2) +
        Math.pow(position.y - zone.center.y, 2) +
        Math.pow(position.z - zone.center.z, 2)
      );
      
      if (distance <= zone.radius) {
        return zone;
      }
    }
    return null;
  }

  /**
   * Obtenir une position de spawn sécurisée pour un mob
   */
  public getSafeMobSpawnPosition(planetId: string, xpZone: XPZone): Vector3 | null {
    // Générer des positions aléatoires dans la zone XP jusqu'à en trouver une hors des zones de sécurité
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * xpZone.radius;
      const position: Vector3 = {
        x: xpZone.center.x + Math.cos(angle) * distance,
        y: xpZone.center.y,
        z: xpZone.center.z + Math.sin(angle) * distance
      };
      
      if (!this.isInSafeZone(position, planetId)) {
        return position;
      }
    }
    return null;
  }

  /**
   * Obtenir les zones de sécurité d'une planète
   */
  public getSafeZonesForPlanet(planetId: string): SafeZone[] {
    return Array.from(this.safeZones.values()).filter(z => z.planetId === planetId);
  }
}

export const zoneService = ZoneService.getInstance();

