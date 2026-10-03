// ══════════════════════════════════════════════════════════════════════════════
// ui/hud/mapService.ts — Service de gestion de la carte (SPECS §3)
//
// Singleton. Gère l'initialisation de la carte, le système de zones/biomes,
// la découverte progressive (fog of war) et la persistance localStorage.
// ══════════════════════════════════════════════════════════════════════════════

import type { Vector3, SceneMode } from "../../../types";
import type { MapData, MapZone, BiomeType } from "./hudTypes";

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

  /** Initialise la carte pour une planète/scène donnée. */
  public initializeMap(_planetId: string | null, _sceneMode: SceneMode): void {
    const zones = this.generateZones(_planetId, _sceneMode);
    this.mapData = {
      zones,
      discoveredAreas: new Set(),
      playerHistory: [],
    };
  }

  /** Met à jour la découverte selon la position du joueur. */
  public updateDiscovery(_playerPosition: Vector3): void {
    // TODO: implémenter la détection de proximité avec les zones
  }

  /** Retourne les données de la carte. */
  public getMapData(): MapData | null {
    return this.mapData;
  }

  /** Génère les zones pour une planète donnée. */
  private generateZones(
    _planetId: string | null,
    _sceneMode: SceneMode
  ): MapZone[] {
    // TODO: génération adaptée à chaque planète/biome
    return [];
  }

  /** Vérifie si une position est dans le rayon de découverte d'une zone. */
  private isInRadius(
    _position: Vector3,
    _bounds: { min: Vector3; max: Vector3 },
    _radius: number
  ): boolean {
    return false;
  }

  /** Charge les zones découvertes depuis localStorage. */
  private loadDiscoveredAreas(_planetId: string | null): Set<string> {
    return new Set();
  }

  /** Sauvegarde les zones découvertes dans localStorage. */
  private saveDiscoveredAreas(): void {
    // TODO
  }

  /** Réinitialise les données de la carte. */
  public reset(): void {
    this.mapData = null;
  }
}

/** Instance réexportée pour usage direct. */
export const mapService = MapService.getInstance();
