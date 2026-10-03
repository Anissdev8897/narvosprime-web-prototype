import { InventoryItem, Faction } from '../types';

export interface BankAccount {
  playerId: string;
  faction: Faction;
  items: InventoryItem[];
  maxCapacity: number;
}

export class BankService {
  private static instance: BankService;
  private accounts: Map<string, BankAccount> = new Map();
  private readonly MAX_CAPACITY = 400;

  private constructor() {}

  public static getInstance(): BankService {
    if (!BankService.instance) {
      BankService.instance = new BankService();
    }
    return BankService.instance;
  }

  // Obtenir ou créer un compte bancaire
  public getAccount(playerId: string, faction: Faction): BankAccount {
    if (!this.accounts.has(playerId)) {
      this.accounts.set(playerId, {
        playerId,
        faction,
        items: [],
        maxCapacity: this.MAX_CAPACITY
      });
    }
    return this.accounts.get(playerId)!;
  }

  // Déposer des objets
  public depositItems(
    playerId: string,
    faction: Faction,
    items: InventoryItem[]
  ): { success: boolean; deposited: InventoryItem[]; remaining: InventoryItem[]; reason?: string } {
    const account = this.getAccount(playerId, faction);
    
    // Vérifier la capacité
    const currentItemCount = account.items.reduce((sum, item) => sum + item.count, 0);
    const itemsToDepositCount = items.reduce((sum, item) => sum + item.count, 0);
    
    if (currentItemCount + itemsToDepositCount > account.maxCapacity) {
      const availableSpace = account.maxCapacity - currentItemCount;
      const deposited: InventoryItem[] = [];
      const remaining: InventoryItem[] = [];
      let spaceUsed = 0;

      for (const item of items) {
        if (spaceUsed + item.count <= availableSpace) {
          deposited.push({ ...item });
          spaceUsed += item.count;
        } else {
          const canDeposit = availableSpace - spaceUsed;
          if (canDeposit > 0) {
            deposited.push({ id: item.id, count: canDeposit });
            remaining.push({ id: item.id, count: item.count - canDeposit });
          } else {
            remaining.push({ ...item });
          }
          spaceUsed = availableSpace;
        }
      }

      return {
        success: deposited.length > 0,
        deposited,
        remaining,
        reason: deposited.length < items.length ? 'Capacité bancaire insuffisante' : undefined
      };
    }

    // Fusionner les items existants
    const newItems = [...account.items];
    items.forEach(item => {
      const existing = newItems.find(i => i.id === item.id);
      if (existing) {
        existing.count += item.count;
      } else {
        newItems.push({ ...item });
      }
    });

    account.items = newItems;

    return {
      success: true,
      deposited: items,
      remaining: []
    };
  }

  // Retirer des objets
  public withdrawItems(
    playerId: string,
    faction: Faction,
    itemIds: { id: string; count: number }[]
  ): { success: boolean; withdrawn: InventoryItem[]; reason?: string } {
    const account = this.getAccount(playerId, faction);
    const withdrawn: InventoryItem[] = [];

    for (const request of itemIds) {
      const item = account.items.find(i => i.id === request.id);
      if (!item) {
        return {
          success: false,
          withdrawn,
          reason: `Item ${request.id} non trouvé dans la banque`
        };
      }

      if (item.count < request.count) {
        return {
          success: false,
          withdrawn,
          reason: `Quantité insuffisante pour ${request.id}`
        };
      }

      item.count -= request.count;
      if (item.count === 0) {
        account.items = account.items.filter(i => i.id !== request.id);
      }

      withdrawn.push({ id: request.id, count: request.count });
    }

    return {
      success: true,
      withdrawn
    };
  }

  // Obtenir tous les objets de la banque
  public getItems(playerId: string, faction: Faction): InventoryItem[] {
    const account = this.getAccount(playerId, faction);
    return [...account.items];
  }

  // Obtenir la capacité utilisée
  public getUsedCapacity(playerId: string, faction: Faction): number {
    const account = this.getAccount(playerId, faction);
    return account.items.reduce((sum, item) => sum + item.count, 0);
  }

  // Obtenir la capacité disponible
  public getAvailableCapacity(playerId: string, faction: Faction): number {
    const account = this.getAccount(playerId, faction);
    return account.maxCapacity - this.getUsedCapacity(playerId, faction);
  }

  // Vérifier si la banque est pleine
  public isFull(playerId: string, faction: Faction): boolean {
    return this.getAvailableCapacity(playerId, faction) === 0;
  }
}

export const bankService = BankService.getInstance();

