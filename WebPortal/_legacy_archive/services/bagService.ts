import { InventoryItem } from '../types';

export interface Bag {
  id: string;
  name: string;
  slots: number;
  price: number;
  currency: string;
}

export class BagService {
  private static instance: BagService;
  private baseInventorySlots = 20;
  private maxBags = 5;
  private bags: Bag[] = [];

  private constructor() {
    // Initialiser les types de sacs disponibles
    this.bags = [
      {
        id: 'bag_basic',
        name: 'Sac de Base',
        slots: 2,
        price: 10,
        currency: 'local'
      },
      {
        id: 'bag_medium',
        name: 'Sac Moyen',
        slots: 4,
        price: 50,
        currency: 'local'
      },
      {
        id: 'bag_large',
        name: 'Sac Large',
        slots: 6,
        price: 150,
        currency: 'local'
      },
      {
        id: 'bag_premium',
        name: 'Sac Premium',
        slots: 10,
        price: 500,
        currency: 'local'
      },
      {
        id: 'bag_elite',
        name: 'Sac d\'Élite',
        slots: 15,
        price: 2000,
        currency: 'local'
      }
    ];
  }

  public static getInstance(): BagService {
    if (!BagService.instance) {
      BagService.instance = new BagService();
    }
    return BagService.instance;
  }

  // Obtenir tous les sacs disponibles
  public getAvailableBags(): Bag[] {
    return this.bags;
  }

  // Obtenir un sac par ID
  public getBag(bagId: string): Bag | undefined {
    return this.bags.find(b => b.id === bagId);
  }

  // Calculer les slots d'inventaire totaux
  public calculateTotalSlots(bagsCount: number, bagsOwned: string[]): number {
    let totalSlots = this.baseInventorySlots;
    
    // Ajouter les slots des sacs possédés
    bagsOwned.forEach(bagId => {
      const bag = this.getBag(bagId);
      if (bag) {
        totalSlots += bag.slots;
      }
    });

    return totalSlots;
  }

  // Vérifier si on peut acheter un sac
  public canBuyBag(
    bagId: string,
    currentBagsCount: number,
    playerCurrency: number
  ): { canBuy: boolean; reason?: string } {
    if (currentBagsCount >= this.maxBags) {
      return { canBuy: false, reason: 'Nombre maximum de sacs atteint (5)' };
    }

    const bag = this.getBag(bagId);
    if (!bag) {
      return { canBuy: false, reason: 'Sac introuvable' };
    }

    if (playerCurrency < bag.price) {
      return { canBuy: false, reason: 'Monnaie insuffisante' };
    }

    return { canBuy: true };
  }

  // Acheter un sac
  public buyBag(
    bagId: string,
    currentBagsCount: number,
    currentBagsOwned: string[],
    playerCurrency: number
  ): { success: boolean; newCurrency: number; newBagsOwned: string[]; newTotalSlots: number; reason?: string } {
    const check = this.canBuyBag(bagId, currentBagsCount, playerCurrency);
    
    if (!check.canBuy) {
      return {
        success: false,
        newCurrency: playerCurrency,
        newBagsOwned: currentBagsOwned,
        newTotalSlots: this.calculateTotalSlots(currentBagsCount, currentBagsOwned),
        reason: check.reason
      };
    }

    const bag = this.getBag(bagId);
    if (!bag) {
      return {
        success: false,
        newCurrency: playerCurrency,
        newBagsOwned: currentBagsOwned,
        newTotalSlots: this.calculateTotalSlots(currentBagsCount, currentBagsOwned),
        reason: 'Sac introuvable'
      };
    }

    const newBagsOwned = [...currentBagsOwned, bagId];
    const newCurrency = playerCurrency - bag.price;
    const newTotalSlots = this.calculateTotalSlots(currentBagsCount + 1, newBagsOwned);

    return {
      success: true,
      newCurrency,
      newBagsOwned,
      newTotalSlots
    };
  }

  // Obtenir le nombre de slots de base
  public getBaseSlots(): number {
    return this.baseInventorySlots;
  }

  // Obtenir le maximum de sacs
  public getMaxBags(): number {
    return this.maxBags;
  }
}

export const bagService = BagService.getInstance();

