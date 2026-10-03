import { OnlinePlayer, NetworkMessageType, NetworkMessage } from '../../types/network';
import { Faction, EntityType, PlayerStatus } from '../../types';
import { INetworkService } from './INetworkService';

/**
 * Service de gestion des joueurs en ligne
 * Centralise la gestion des joueurs connectés
 */
export class PlayerManagerService {
  private static instance: PlayerManagerService;
  private players: Map<string, OnlinePlayer> = new Map();
  private localPlayerUid: string | null = null;
  private networkService: INetworkService | null = null;

  private constructor() {}

  public static getInstance(): PlayerManagerService {
    if (!PlayerManagerService.instance) {
      PlayerManagerService.instance = new PlayerManagerService();
    }
    return PlayerManagerService.instance;
  }

  // Initialiser avec le service réseau
  public initialize(networkService: INetworkService): void {
    this.networkService = networkService;
    
    // Écouter les messages de joueurs
    networkService.onMessage((message) => {
      switch (message.type) {
        case NetworkMessageType.PLAYER_JOIN:
        case NetworkMessageType.PLAYER_UPDATE:
          this.handlePlayerUpdate(message);
          break;
        case NetworkMessageType.PLAYER_LEAVE:
          this.handlePlayerLeave(message);
          break;
      }
    });
  }

  // Définir le joueur local
  public setLocalPlayer(uid: string): void {
    this.localPlayerUid = uid;
  }

  // Obtenir le joueur local
  public getLocalPlayer(): OnlinePlayer | null {
    if (!this.localPlayerUid) return null;
    return this.players.get(this.localPlayerUid) || null;
  }

  // Obtenir tous les joueurs (sauf local)
  public getOtherPlayers(): OnlinePlayer[] {
    return Array.from(this.players.values()).filter(
      p => p.uid !== this.localPlayerUid
    );
  }

  // Obtenir un joueur par UID
  public getPlayer(uid: string): OnlinePlayer | null {
    return this.players.get(uid) || null;
  }

  // Mettre à jour un joueur
  public updatePlayer(player: OnlinePlayer): void {
    this.players.set(player.uid, player);
  }

  // Supprimer un joueur
  public removePlayer(uid: string): void {
    this.players.delete(uid);
  }

  // Obtenir tous les joueurs
  public getAllPlayers(): OnlinePlayer[] {
    return Array.from(this.players.values());
  }

  // Obtenir les joueurs d'une faction
  public getPlayersByFaction(faction: Faction): OnlinePlayer[] {
    return Array.from(this.players.values()).filter(p => p.faction === faction);
  }

  // Gérer la mise à jour d'un joueur
  private handlePlayerUpdate(message: NetworkMessage): void {
    const player = message.data as OnlinePlayer;
    this.updatePlayer(player);
  }

  // Gérer le départ d'un joueur
  private handlePlayerLeave(message: NetworkMessage): void {
    const uid = message.data.uid as string;
    this.removePlayer(uid);
  }

  // Synchroniser le joueur local
  public syncLocalPlayer(
    playerId: string,
    username: string,
    faction: Faction,
    position: { x: number; y: number; z: number },
    rotation: number,
    pitch: number,
    stats: { hp: number; maxHp: number; armor: number; maxArmor: number },
    level: number,
    status: PlayerStatus,
    entityType: EntityType,
    isDead: boolean
  ): void {
    if (!this.localPlayerUid) return;

    const player: OnlinePlayer = {
      uid: this.localPlayerUid,
      playerId,
      username,
      faction,
      position,
      rotation,
      pitch,
      stats,
      level,
      status,
      entityType,
      isDead,
      lastUpdate: Date.now()
    };

    this.updatePlayer(player);

    // Envoyer la mise à jour au serveur
    if (this.networkService) {
      this.networkService.send({
        type: NetworkMessageType.PLAYER_UPDATE,
        timestamp: Date.now(),
        data: player
      });
    }
  }

  // Obtenir le nombre de joueurs en ligne
  public getPlayerCount(): number {
    return this.players.size;
  }
}

export const playerManagerService = PlayerManagerService.getInstance();

