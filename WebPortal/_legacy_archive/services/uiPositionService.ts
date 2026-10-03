/**
 * Service de sauvegarde des positions des éléments UI
 */
export interface UIPositions {
  radar: { x: number; y: number };
  dataCenter: { x: number; y: number };
  statsHUD: { x: number; y: number };
  actionButtons: { x: number; y: number };
  inspector: { x: number; y: number };
  hierarchy: { x: number; y: number };
}

const STORAGE_KEY = 'narvos_ui_positions';

export class UIPositionService {
  private static instance: UIPositionService;

  public static getInstance(): UIPositionService {
    if (!UIPositionService.instance) {
      UIPositionService.instance = new UIPositionService();
    }
    return UIPositionService.instance;
  }

  /**
   * Sauvegarder les positions UI
   */
  public savePositions(positions: UIPositions): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
      console.log('✅ Positions UI sauvegardées');
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde des positions UI:', error);
    }
  }

  /**
   * Charger les positions UI
   */
  public loadPositions(): UIPositions | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return null;
      const positions = JSON.parse(data) as UIPositions;
      console.log('✅ Positions UI chargées');
      return positions;
    } catch (error) {
      console.error('❌ Erreur lors du chargement des positions UI:', error);
      return null;
    }
  }

  /**
   * Obtenir les positions par défaut
   */
  public getDefaultPositions(): UIPositions {
    return {
      radar: { x: 32, y: 32 },
      dataCenter: { x: 32, y: 0 },
      statsHUD: { x: 0, y: 0 },
      actionButtons: { x: 0, y: 0 },
      inspector: { x: 0, y: 0 },
      hierarchy: { x: 0, y: 0 }
    };
  }
}

export const uiPositionService = UIPositionService.getInstance();

