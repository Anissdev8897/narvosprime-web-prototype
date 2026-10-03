import { ValidationRequest, ValidationResponse } from '../../types/network';
import { PlayerEntity, InventoryItem } from '../../types';

/**
 * Service de validation et anti-triche
 * Valide les actions des joueurs côté serveur
 */
export class ValidationService {
  private static instance: ValidationService;
  private playerStates: Map<string, PlayerEntity> = new Map();
  private validationRules: Map<string, (data: any) => ValidationResponse> = new Map();

  private constructor() {
    this.setupValidationRules();
  }

  public static getInstance(): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService();
    }
    return ValidationService.instance;
  }

  // Configurer les règles de validation
  private setupValidationRules(): void {
    // Validation de position
    this.validationRules.set('MOVE', (data) => {
      const { uid, newPosition, oldPosition, maxSpeed, timeDelta } = data;
      const distance = Math.sqrt(
        Math.pow(newPosition.x - oldPosition.x, 2) +
        Math.pow(newPosition.y - oldPosition.y, 2) +
        Math.pow(newPosition.z - oldPosition.z, 2)
      );
      const maxDistance = maxSpeed * (timeDelta / 1000);

      if (distance > maxDistance * 1.5) {
        return {
          valid: false,
          reason: 'Mouvement trop rapide',
          correctedData: { position: oldPosition }
        };
      }

      return { valid: true };
    });

    // Validation d'inventaire
    this.validationRules.set('INVENTORY_UPDATE', (data) => {
      const { uid, newInventory, maxSlots } = data;
      const totalItems = newInventory.reduce((sum: number, item: InventoryItem) => sum + item.count, 0);

      if (totalItems > maxSlots) {
        return {
          valid: false,
          reason: 'Inventaire dépasse la capacité',
          correctedData: { inventory: this.correctInventory(newInventory, maxSlots) }
        };
      }

      return { valid: true };
    });

    // Validation de combat
    this.validationRules.set('COMBAT', (data) => {
      const { uid, damage, maxDamage } = data;

      if (damage > maxDamage) {
        return {
          valid: false,
          reason: 'Dégâts anormalement élevés',
          correctedData: { damage: maxDamage }
        };
      }

      return { valid: true };
    });
  }

  // Valider une action
  public validate(request: ValidationRequest): ValidationResponse {
    const rule = this.validationRules.get(request.action);
    if (!rule) {
      return { valid: true }; // Pas de règle = autorisé par défaut
    }

    return rule(request.data);
  }

  // Corriger un inventaire
  private correctInventory(inventory: InventoryItem[], maxSlots: number): InventoryItem[] {
    const corrected: InventoryItem[] = [];
    let total = 0;

    for (const item of inventory) {
      if (total + item.count <= maxSlots) {
        corrected.push({ ...item });
        total += item.count;
      } else {
        const remaining = maxSlots - total;
        if (remaining > 0) {
          corrected.push({ id: item.id, count: remaining });
        }
        break;
      }
    }

    return corrected;
  }

  // Enregistrer l'état d'un joueur
  public setPlayerState(uid: string, state: PlayerEntity): void {
    this.playerStates.set(uid, { ...state });
  }

  // Obtenir l'état d'un joueur
  public getPlayerState(uid: string): PlayerEntity | null {
    return this.playerStates.get(uid) || null;
  }
}

export const validationService = ValidationService.getInstance();

