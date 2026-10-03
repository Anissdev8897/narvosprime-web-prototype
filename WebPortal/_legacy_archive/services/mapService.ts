import { Vector3, SceneMode, BiomeType, Faction } from '../types';

/**
 * Zone de la carte
 */
export interface MapZone {
  id: string;
  type: 'BIOME' | 'ALLIANCE_ZONE' | 'POI'; // Point of Interest
  biome?: BiomeType;
  faction?: Faction;
  name: string;
  bounds: {
    min: Vector3;
    max: Vector3;
  };
  discovered: boolean;
}

/**
 * Données complètes de la carte
 */
export interface MapData {
  planetId: string | null;
  sceneMode: SceneMode;
  zones: MapZone[];
  discoveredAreas: Set<string>; // IDs des zones découvertes
  playerHistory: Vector3[]; // Historique des positions pour le fog of war
}

/**
 * Service de gestion de la carte
 */
export class MapService {
  private static instance: MapService;
  private mapData: MapData | null = null;
  private discoveryRadius = 50; // 50 mètres
  
  public static getInstance(): MapService {
    if (!MapService.instance) {
      MapService.instance = new MapService();
    }
    return MapService.instance;
  }
  
  /**
   * Initialiser la carte pour une planète/scène
   */
  public initializeMap(planetId: string | null, sceneMode: SceneMode): void {
    const zones = this.generateZones(planetId, sceneMode);
    const discoveredAreas = this.loadDiscoveredAreas(planetId);
    
    this.mapData = {
      planetId,
      sceneMode,
      zones,
      discoveredAreas,
      playerHistory: []
    };
  }
  
  /**
   * Mettre à jour la découverte selon la position du joueur
   */
  public updateDiscovery(playerPosition: Vector3): void {
    if (!this.mapData) return;
    
    // Ajouter la position à l'historique
    this.mapData.playerHistory.push({ ...playerPosition });
    
    // Limiter l'historique à 1000 points
    if (this.mapData.playerHistory.length > 1000) {
      this.mapData.playerHistory.shift();
    }
    
    // Découvrir les zones dans le rayon
    this.mapData.zones.forEach(zone => {
      if (this.isInRadius(playerPosition, zone.bounds, this.discoveryRadius)) {
        this.mapData!.discoveredAreas.add(zone.id);
        zone.discovered = true;
      }
    });
    
    // Sauvegarder les zones découvertes
    this.saveDiscoveredAreas();
  }
  
  /**
   * Générer les zones pour une planète
   */
  private generateZones(planetId: string | null, sceneMode: SceneMode): MapZone[] {
    const zones: MapZone[] = [];
    
    if (sceneMode === SceneMode.HUB) {
      zones.push({
        id: 'hub_central',
        type: 'BIOME',
        biome: BiomeType.HUB,
        name: 'HUB Central',
        bounds: { min: { x: -50, y: 0, z: -50 }, max: { x: 50, y: 0, z: 50 } },
        discovered: false
      });
      return zones;
    }
    
    if (planetId === 'mycelion') {
      // Forêt tropicale (fongique)
      zones.push({
        id: 'mycelion_forest',
        type: 'BIOME',
        biome: BiomeType.FUNGAL,
        name: 'Forêt Fongique',
        bounds: { min: { x: -500, y: 0, z: -500 }, max: { x: 500, y: 0, z: 500 } },
        discovered: false
      });
    } else if (planetId === 'aquarys') {
      // Océan
      zones.push({
        id: 'aquarys_ocean',
        type: 'BIOME',
        biome: BiomeType.OCEAN,
        name: 'Océan Abyssal',
        bounds: { min: { x: -500, y: -100, z: -500 }, max: { x: 500, y: 0, z: 500 } },
        discovered: false
      });
    } else if (planetId === 'draelkara') {
      // Désert
      zones.push({
        id: 'draelkara_desert',
        type: 'BIOME',
        biome: BiomeType.DESERT,
        name: 'Désert Aride',
        bounds: { min: { x: -500, y: 0, z: -500 }, max: { x: 500, y: 0, z: 500 } },
        discovered: false
      });
    }
    
    return zones;
  }
  
  /**
   * Vérifier si une position est dans le rayon de découverte
   */
  private isInRadius(position: Vector3, bounds: { min: Vector3; max: Vector3 }, radius: number): boolean {
    const centerX = (bounds.min.x + bounds.max.x) / 2;
    const centerZ = (bounds.min.z + bounds.max.z) / 2;
    const distance = Math.sqrt(
      Math.pow(position.x - centerX, 2) +
      Math.pow(position.z - centerZ, 2)
    );
    return distance <= radius;
  }
  
  /**
   * Charger les zones découvertes depuis localStorage
   */
  private loadDiscoveredAreas(planetId: string | null): Set<string> {
    const key = `narvos_map_discovered_${planetId || 'hub'}`;
    const data = localStorage.getItem(key);
    if (data) {
      return new Set(JSON.parse(data));
    }
    return new Set();
  }
  
  /**
   * Sauvegarder les zones découvertes dans localStorage
   */
  private saveDiscoveredAreas(): void {
    if (!this.mapData) return;
    const key = `narvos_map_discovered_${this.mapData.planetId || 'hub'}`;
    localStorage.setItem(key, JSON.stringify(Array.from(this.mapData.discoveredAreas)));
  }
  
  /**
   * Obtenir les données de la carte
   */
  public getMapData(): MapData | null {
    return this.mapData;
  }
}

export const mapService = MapService.getInstance();

