import { GameInstance, NetworkMessageType, NetworkMessage } from '../../types/network';
import { INetworkService } from './INetworkService';

/**
 * Service de gestion des instances de jeu
 */
export class InstanceService {
  private static instance: InstanceService;
  private currentInstance: GameInstance | null = null;
  private availableInstances: Map<string, GameInstance> = new Map();
  private networkService: INetworkService | null = null;

  private constructor() {}

  public static getInstance(): InstanceService {
    if (!InstanceService.instance) {
      InstanceService.instance = new InstanceService();
    }
    return InstanceService.instance;
  }

  // Initialiser avec le service réseau
  public initialize(networkService: INetworkService): void {
    this.networkService = networkService;
    
    networkService.onMessage((message) => {
      switch (message.type) {
        case NetworkMessageType.INSTANCE_UPDATE:
          this.handleInstanceUpdate(message);
          break;
      }
    });
  }

  // Rejoindre une instance
  public async joinInstance(instanceId: string, password?: string): Promise<boolean> {
    if (!this.networkService) {
      return false;
    }

    const instance = this.availableInstances.get(instanceId);
    if (!instance) {
      return false;
    }

    // Vérifier le mot de passe si nécessaire
    if (instance.isPrivate && instance.password !== password) {
      return false;
    }

    // Vérifier la capacité
    if (instance.currentPlayers >= instance.maxPlayers) {
      return false;
    }

    // Rejoindre via le service réseau
    const success = await this.networkService.joinInstance(instanceId);
    if (success) {
      this.currentInstance = instance;
    }

    return success;
  }

  // Quitter l'instance actuelle
  public leaveInstance(): void {
    if (this.networkService) {
      this.networkService.leaveInstance();
    }
    this.currentInstance = null;
  }

  // Obtenir l'instance actuelle
  public getCurrentInstance(): GameInstance | null {
    return this.currentInstance;
  }

  // Obtenir les instances disponibles
  public getAvailableInstances(): GameInstance[] {
    return Array.from(this.availableInstances.values());
  }

  // Mettre à jour une instance
  private handleInstanceUpdate(message: NetworkMessage): void {
    const instance = message.data as GameInstance;
    this.availableInstances.set(instance.instanceId, instance);
    
    if (this.currentInstance?.instanceId === instance.instanceId) {
      this.currentInstance = instance;
    }
  }

  // Créer une nouvelle instance (côté serveur)
  public createInstance(
    instanceId: string,
    planetId: string,
    maxPlayers: number,
    isPrivate: boolean = false,
    password?: string
  ): GameInstance {
    const instance: GameInstance = {
      instanceId,
      planetId,
      maxPlayers,
      currentPlayers: 0,
      players: [],
      isPrivate,
      password,
      createdAt: Date.now()
    };

    this.availableInstances.set(instanceId, instance);
    return instance;
  }
}

export const instanceService = InstanceService.getInstance();

