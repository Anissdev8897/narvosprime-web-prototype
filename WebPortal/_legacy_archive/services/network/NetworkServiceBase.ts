import { INetworkService } from './INetworkService';
import { NetworkMessage, ConnectionState, NetworkConfig, NetworkStats, OnlinePlayer, GameInstance, NetworkMessageType } from '../../types/network';

/**
 * Classe de base pour les services réseau
 * Implémente la logique commune (validation, statistiques, gestion des callbacks)
 */
export abstract class NetworkServiceBase implements INetworkService {
  protected connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  protected config: NetworkConfig | null = null;
  protected onlinePlayers: Map<string, OnlinePlayer> = new Map();
  protected currentInstance: GameInstance | null = null;
  protected stats: NetworkStats = {
    ping: 0,
    packetLoss: 0,
    bytesSent: 0,
    bytesReceived: 0,
    messagesSent: 0,
    messagesReceived: 0,
    lastUpdate: Date.now()
  };

  // Callbacks
  private messageCallbacks: ((message: NetworkMessage) => void)[] = [];
  private connectCallbacks: (() => void)[] = [];
  private disconnectCallbacks: (() => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];

  // Méthodes abstraites à implémenter par les sous-classes
  protected abstract doConnect(): Promise<boolean>;
  protected abstract doDisconnect(): void;
  protected abstract doSend(message: NetworkMessage): boolean;
  protected abstract setupListeners(): void;

  // Connexion
  public async connect(config: NetworkConfig): Promise<boolean> {
    this.config = config;
    this.connectionState = ConnectionState.CONNECTING;
    
    try {
      const success = await this.doConnect();
      if (success) {
        this.connectionState = ConnectionState.CONNECTED;
        this.setupListeners();
        this.connectCallbacks.forEach(cb => cb());
        return true;
      } else {
        this.connectionState = ConnectionState.ERROR;
        return false;
      }
    } catch (error) {
      this.connectionState = ConnectionState.ERROR;
      this.errorCallbacks.forEach(cb => cb(error as Error));
      return false;
    }
  }

  public disconnect(): void {
    this.doDisconnect();
    this.connectionState = ConnectionState.DISCONNECTED;
    this.onlinePlayers.clear();
    this.currentInstance = null;
    this.disconnectCallbacks.forEach(cb => cb());
  }

  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  // Messages
  public send(message: NetworkMessage): boolean {
    if (this.connectionState !== ConnectionState.CONNECTED) {
      return false;
    }

    // Ajouter timestamp si absent
    if (!message.timestamp) {
      message.timestamp = Date.now();
    }

    // Générer checksum si validation activée
    if (this.config?.enableValidation) {
      message.checksum = this.generateChecksum(message);
    }

    const success = this.doSend(message);
    if (success) {
      this.stats.messagesSent++;
      this.stats.bytesSent += JSON.stringify(message).length;
    }
    return success;
  }

  public onMessage(callback: (message: NetworkMessage) => void): void {
    this.messageCallbacks.push(callback);
  }

  public onConnect(callback: () => void): void {
    this.connectCallbacks.push(callback);
  }

  public onDisconnect(callback: () => void): void {
    this.disconnectCallbacks.push(callback);
  }

  public onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  // Méthode protégée pour notifier les callbacks de message
  protected notifyMessage(message: NetworkMessage): void {
    if (this.validateMessage(message)) {
      this.stats.messagesReceived++;
      this.stats.bytesReceived += JSON.stringify(message).length;
      this.messageCallbacks.forEach(cb => cb(message));
    }
  }

  // Joueurs
  public getOnlinePlayers(): OnlinePlayer[] {
    return Array.from(this.onlinePlayers.values());
  }

  public getPlayerByUid(uid: string): OnlinePlayer | null {
    return this.onlinePlayers.get(uid) || null;
  }

  protected updatePlayer(player: OnlinePlayer): void {
    this.onlinePlayers.set(player.uid, player);
  }

  protected removePlayer(uid: string): void {
    this.onlinePlayers.delete(uid);
  }

  // Instances
  public async joinInstance(instanceId: string): Promise<boolean> {
    // À implémenter selon le type de réseau
    return true;
  }

  public leaveInstance(): void {
    this.currentInstance = null;
  }

  public getCurrentInstance(): GameInstance | null {
    return this.currentInstance;
  }

  // Statistiques
  public getStats(): NetworkStats {
    this.stats.lastUpdate = Date.now();
    return { ...this.stats };
  }

  // Validation
  public validateMessage(message: NetworkMessage): boolean {
    if (!this.config?.enableValidation) {
      return true;
    }

    if (!message.checksum) {
      return false;
    }

    const expectedChecksum = this.generateChecksum(message);
    return message.checksum === expectedChecksum;
  }

  // Génération de checksum simple (à améliorer avec crypto en production)
  protected generateChecksum(message: NetworkMessage): string {
    const data = JSON.stringify({
      type: message.type,
      timestamp: message.timestamp,
      data: message.data
    });
    
    // Hash simple (à remplacer par SHA-256 en production)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }
}

