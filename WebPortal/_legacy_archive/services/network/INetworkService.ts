import { NetworkMessage, ConnectionState, NetworkConfig, NetworkStats, OnlinePlayer, GameInstance } from '../../types/network';

/**
 * Interface abstraite pour les services réseau
 * Permet de changer facilement d'implémentation (WebSocket, WebRTC, Serveur dédié)
 */
export interface INetworkService {
  // Connexion
  connect(config: NetworkConfig): Promise<boolean>;
  disconnect(): void;
  getConnectionState(): ConnectionState;
  
  // Messages
  send(message: NetworkMessage): boolean;
  onMessage(callback: (message: NetworkMessage) => void): void;
  onConnect(callback: () => void): void;
  onDisconnect(callback: () => void): void;
  onError(callback: (error: Error) => void): void;
  
  // Joueurs
  getOnlinePlayers(): OnlinePlayer[];
  getPlayerByUid(uid: string): OnlinePlayer | null;
  
  // Instances
  joinInstance(instanceId: string): Promise<boolean>;
  leaveInstance(): void;
  getCurrentInstance(): GameInstance | null;
  
  // Statistiques
  getStats(): NetworkStats;
  
  // Validation
  validateMessage(message: NetworkMessage): boolean;
}

