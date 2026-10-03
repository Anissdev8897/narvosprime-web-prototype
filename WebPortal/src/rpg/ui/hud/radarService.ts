// ══════════════════════════════════════════════════════════════════════════════
// ui/hud/radarService.ts — Service de détection radar (SPECS §2)
//
// Singleton. Détecte les entités dans un rayon de 5 mètres autour du joueur,
// détermine leur type (joueur, monstre, PNJ, véhicule, objet, ressource,
// structure) et leur état de mouvement.
// ══════════════════════════════════════════════════════════════════════════════

import type { Vector3, Faction } from "../../../types";
import type { RadarEntity, RadarEntityType } from "./hudTypes";

export class RadarService {
  private static instance: RadarService;
  private detectionRange = 5; // 5 mètres

  public static getInstance(): RadarService {
    if (!RadarService.instance) {
      RadarService.instance = new RadarService();
    }
    return RadarService.instance;
  }

  /** Modifie le rayon de détection (par défaut 5m). */
  public setDetectionRange(meters: number): void {
    this.detectionRange = meters;
  }

  /** Retourne le rayon de détection actuel. */
  public getDetectionRange(): number {
    return this.detectionRange;
  }

  /**
   * Détecte toutes les entités dans la zone de surveillance.
   * Stub — l'implémentation complète utilisera le système ECS/Three.js.
   */
  public detectEntities(
    _playerPosition: Vector3,
    _sceneObjects: unknown[]
  ): RadarEntity[] {
    // TODO: implémenter la détection réelle via le monde ECS
    return [];
  }

  /**
   * Détermine si une entité est en mouvement.
   * Stub.
   */
  public isEntityMoving(_lastPos: Vector3, _currentPos: Vector3): boolean {
    return false;
  }

  /**
   * Détermine le type d'une entité à partir de ses métadonnées.
   * Stub.
   */
  public determineEntityType(_userDataType?: string): RadarEntityType {
    return "PROP";
  }
}

/** Instance réexportée pour usage direct. */
export const radarService = RadarService.getInstance();
