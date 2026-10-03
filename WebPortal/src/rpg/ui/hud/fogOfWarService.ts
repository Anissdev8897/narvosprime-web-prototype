// ══════════════════════════════════════════════════════════════════════════════
// ui/hud/fogOfWarService.ts — Service de brouillard de guerre (SPECS §3.2)
//
// Singleton. Gère la découverte pixel-par-pixel du fog of war avec un rayon
// de 50 mètres autour du joueur. Persistance via localStorage.
// ══════════════════════════════════════════════════════════════════════════════

import type { Vector3 } from "../../../types";

export class FogOfWarService {
  private static instance: FogOfWarService;
  private discoveryRadius = 50;
  private discoveredPixels: Set<string> = new Set(); // Format: "x,z"

  public static getInstance(): FogOfWarService {
    if (!FogOfWarService.instance) {
      FogOfWarService.instance = new FogOfWarService();
    }
    return FogOfWarService.instance;
  }

  /** Découvre une zone autour d'une position donnée. */
  public discoverArea(
    _position: Vector3,
    _mapBounds: { min: Vector3; max: Vector3 }
  ): void {
    // TODO: itérer sur tous les pixels dans discoveryRadius
  }

  /** Vérifie si une position est découverte. */
  public isDiscovered(_x: number, _z: number): boolean {
    return false;
  }

  /** Retourne le pourcentage de découverte de la carte. */
  public getDiscoveryPercentage(
    _mapBounds: { min: Vector3; max: Vector3 }
  ): number {
    return 0;
  }

  /** Sauvegarde les pixels découverts dans localStorage. */
  public saveDiscoveredPixels(_planetId: string | null): void {
    // TODO
  }

  /** Charge les pixels découverts depuis localStorage. */
  public loadDiscoveredPixels(_planetId: string | null): void {
    // TODO
  }

  /** Réinitialise complètement le fog of war. */
  public reset(): void {
    this.discoveredPixels.clear();
  }
}

/** Instance réexportée pour usage direct. */
export const fogOfWarService = FogOfWarService.getInstance();
