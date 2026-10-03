import { Faction } from '../types';

/**
 * Codes couleurs par faction pour le nouveau HUD
 */
export interface FactionColors {
  health: string;
  armor: string;
  primary: string;
  accent: string;
  glow: string;
}

/**
 * Service de gestion des couleurs HUD par faction
 */
export class HUDService {
  private static instance: HUDService;

  public static getInstance(): HUDService {
    if (!HUDService.instance) {
      HUDService.instance = new HUDService();
    }
    return HUDService.instance;
  }

  /**
   * Obtenir les couleurs selon la faction
   */
  public getFactionColors(faction: Faction): FactionColors {
    switch (faction) {
      case Faction.HUMAN: // AKARLYS
        return {
          health: '#ef4444',      // Rouge
          armor: '#3b82f6',       // Bleu
          primary: '#3b82f6',     // Bleu primaire
          accent: '#60a5fa',      // Bleu clair
          glow: 'rgba(59, 130, 246, 0.5)' // Glow bleu
        };
      
      case Faction.ALIEN: // ZAYAN
        return {
          health: '#a855f7',      // Violet
          armor: '#22c55e',       // Vert
          primary: '#a855f7',    // Violet primaire
          accent: '#c084fc',      // Violet clair
          glow: 'rgba(168, 85, 247, 0.5)' // Glow violet
        };
      
      case Faction.MERCENARY: // MEZALAYIS
        return {
          health: '#eab308',      // Jaune
          armor: '#f97316',       // Orange
          primary: '#eab308',     // Jaune primaire
          accent: '#fbbf24',      // Jaune clair
          glow: 'rgba(234, 179, 8, 0.5)' // Glow jaune
        };
      
      default: // NEUTRAL ou autres
        return {
          health: '#ffffff',      // Blanc
          armor: '#94a3b8',       // Gris
          primary: '#94a3b8',    // Gris primaire
          accent: '#cbd5e1',      // Gris clair
          glow: 'rgba(148, 163, 184, 0.3)' // Glow gris
        };
    }
  }

  /**
   * Obtenir le nom de la faction
   */
  public getFactionName(faction: Faction): string {
    switch (faction) {
      case Faction.HUMAN:
        return 'AKARLYS';
      case Faction.ALIEN:
        return 'ZAYAN';
      case Faction.MERCENARY:
        return 'MEZALAYIS';
      default:
        return 'NEUTRAL';
    }
  }
}

export const hudService = HUDService.getInstance();

