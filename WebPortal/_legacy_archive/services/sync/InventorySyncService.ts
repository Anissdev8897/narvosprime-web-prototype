import { InventorySync, OnlinePlayer } from '../../types/network';
import { InventoryItem } from '../../types';

/**
 * Service de synchronisation des inventaires
 * Valide les changements d'inventaire pour éviter la triche
 */
export class InventorySyncService {
  private static instance: InventorySyncService;
  private lastInventoryState: Map<string, InventoryItem[]> = new Map();

  private constructor() {}

  public static getInstance(): InventorySyncService {
    if (!InventorySyncService.instance) {
      InventorySyncService.instance = new InventorySyncService();
    }
    return InventorySyncService.instance;
  }

  // Créer un message de synchronisation d'inventaire
  public createInventorySync(
    uid: string,
    inventory: InventoryItem[],
    maxSlots: number
  ): InventorySync {
    return {
      uid,
      inventory: [...inventory],
      maxSlots,
      timestamp: Date.now()
    };
  }

  // Valider un changement d'inventaire (anti-triche)
  public validateInventoryChange(
    uid: string,
    oldInventory: InventoryItem[],
    newInventory: InventoryItem[],
    maxSlots: number
  ): { valid: boolean; reason?: string; correctedInventory?: InventoryItem[] } {
    // Vérifier le nombre total d'items
    const oldTotal = oldInventory.reduce((sum, item) => sum + item.count, 0);
    const newTotal = newInventory.reduce((sum, item) => sum + item.count, 0);

    // Vérifier la capacité maximale
    if (newTotal > maxSlots) {
      return {
        valid: false,
        reason: 'Inventaire dépasse la capacité maximale',
        correctedInventory: this.correctInventory(newInventory, maxSlots)
      };
    }

    // Vérifier les items négatifs
    const hasNegative = newInventory.some(item => item.count < 0);
    if (hasNegative) {
      return {
        valid: false,
        reason: 'Items avec quantité négative détectés',
        correctedInventory: newInventory.filter(item => item.count > 0)
      };
    }

    // Vérifier les items dupliqués
    const itemIds = new Set(newInventory.map(item => item.id));
    if (itemIds.size !== newInventory.length) {
      return {
        valid: false,
        reason: 'Items dupliqués détectés',
        correctedInventory: this.mergeDuplicateItems(newInventory)
      };
    }

    return { valid: true };
  }

  // Corriger un inventaire qui dépasse la capacité
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

  // Fusionner les items dupliqués
  private mergeDuplicateItems(inventory: InventoryItem[]): InventoryItem[] {
    const merged = new Map<string, number>();

    for (const item of inventory) {
      const current = merged.get(item.id) || 0;
      merged.set(item.id, current + item.count);
    }

    return Array.from(merged.entries()).map(([id, count]) => ({ id, count }));
  }

  // Appliquer une synchronisation d'inventaire reçue
  public applyInventorySync(sync: InventorySync): InventoryItem[] {
    this.lastInventoryState.set(sync.uid, sync.inventory);
    return [...sync.inventory];
  }

  // Obtenir le dernier état d'inventaire connu
  public getLastInventoryState(uid: string): InventoryItem[] | null {
    return this.lastInventoryState.get(uid) || null;
  }
}

export const inventorySyncService = InventorySyncService.getInstance();

