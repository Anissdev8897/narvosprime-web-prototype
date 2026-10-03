import { GameMode, NetworkType, NetworkConfig, INetworkService } from '../../types/network';
import { WebSocketNetworkService } from './WebSocketNetworkService';
import { SoloNetworkService } from './SoloNetworkService';
import { playerManagerService } from './PlayerManagerService';
import { chatService } from './ChatService';
import { instanceService } from './InstanceService';

// Lire l'URL du serveur depuis les variables d'environnement Vite
const DEFAULT_SERVER_URL = import.meta.env.VITE_SERVER_URL || 'ws://localhost:8080';

/**
 * Gestionnaire principal du réseau
 * Centralise la création et la gestion du service réseau
 */
export class NetworkManager {
  private static instance: NetworkManager;
  private networkService: INetworkService | null = null;
  private gameMode: GameMode = GameMode.SOLO;
  private config: NetworkConfig | null = null;

  private constructor() {}

  public static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  // Initialiser le réseau selon le mode
  public async initialize(
    gameMode: GameMode,
    networkType: NetworkType = NetworkType.NONE,
    config?: Partial<NetworkConfig>
  ): Promise<boolean> {
    this.gameMode = gameMode;

    // Créer le service réseau approprié
    if (gameMode === GameMode.SOLO || networkType === NetworkType.NONE) {
      this.networkService = new SoloNetworkService();
    } else if (networkType === NetworkType.WEBSOCKET) {
      this.networkService = new WebSocketNetworkService();
    } else {
      // Autres types à implémenter (WebRTC, Serveur dédié)
      this.networkService = new SoloNetworkService();
    }

    // Configuration par défaut
    const defaultConfig: NetworkConfig = {
      type: networkType,
      serverUrl: DEFAULT_SERVER_URL,
      port: 8080,
      reconnectAttempts: 5,
      reconnectDelay: 1000,
      pingInterval: 5000,
      syncInterval: 100,
      enableValidation: true,
      enableEncryption: false,
      ...config
    };

    this.config = defaultConfig;

    // Initialiser les services dépendants
    playerManagerService.initialize(this.networkService);
    chatService.initialize(this.networkService);
    instanceService.initialize(this.networkService);

    // Se connecter si en mode multijoueur
    if (gameMode === GameMode.MULTIPLAYER && networkType !== NetworkType.NONE) {
      return await this.networkService.connect(defaultConfig);
    }

    // En mode solo, simuler une connexion
    return await this.networkService.connect(defaultConfig);
  }

  // Obtenir le service réseau
  public getNetworkService(): INetworkService | null {
    return this.networkService;
  }

  // Obtenir le mode de jeu
  public getGameMode(): GameMode {
    return this.gameMode;
  }

  // Basculer entre solo et multijoueur
  public async switchMode(
    newMode: GameMode,
    networkType?: NetworkType
  ): Promise<boolean> {
    // Déconnecter l'ancien service
    if (this.networkService) {
      this.networkService.disconnect();
    }

    // Réinitialiser avec le nouveau mode
    return await this.initialize(
      newMode,
      networkType || (newMode === GameMode.MULTIPLAYER ? NetworkType.WEBSOCKET : NetworkType.NONE),
      this.config || undefined
    );
  }

  // Déconnecter
  public disconnect(): void {
    if (this.networkService) {
      this.networkService.disconnect();
      this.networkService = null;
    }
  }

  // Vérifier si on est en mode multijoueur
  public isMultiplayer(): boolean {
    return this.gameMode === GameMode.MULTIPLAYER;
  }
}

export const networkManager = NetworkManager.getInstance();

