import { PositionSync, OnlinePlayer } from '../../types/network';
import { Vector3 } from '../../types';

/**
 * Service de synchronisation des positions des joueurs
 */
export class PositionSyncService {
  private static instance: PositionSyncService;
  private lastSyncTime: Map<string, number> = new Map();
  private syncInterval: number = 100; // 10 fois par seconde

  private constructor() {}

  public static getInstance(): PositionSyncService {
    if (!PositionSyncService.instance) {
      PositionSyncService.instance = new PositionSyncService();
    }
    return PositionSyncService.instance;
  }

  // Créer un message de synchronisation de position
  public createPositionSync(
    uid: string,
    position: Vector3,
    velocity: Vector3,
    rotation: number,
    pitch: number
  ): PositionSync | null {
    const now = Date.now();
    const lastSync = this.lastSyncTime.get(uid) || 0;

    // Throttle : ne synchroniser que si assez de temps s'est écoulé
    if (now - lastSync < this.syncInterval) {
      return null;
    }

    this.lastSyncTime.set(uid, now);

    return {
      uid,
      position: { ...position },
      velocity: { ...velocity },
      rotation,
      pitch,
      timestamp: now
    };
  }

  // Appliquer une synchronisation de position reçue
  public applyPositionSync(
    sync: PositionSync,
    player: OnlinePlayer,
    interpolation: boolean = true
  ): OnlinePlayer {
    const updatedPlayer = { ...player };

    if (interpolation) {
      // Interpolation pour mouvement fluide
      const timeDelta = Date.now() - sync.timestamp;
      const interpolationFactor = Math.min(timeDelta / this.syncInterval, 1);

      updatedPlayer.position = {
        x: player.position.x + (sync.position.x - player.position.x) * interpolationFactor,
        y: player.position.y + (sync.position.y - player.position.y) * interpolationFactor,
        z: player.position.z + (sync.position.z - player.position.z) * interpolationFactor
      };
    } else {
      updatedPlayer.position = { ...sync.position };
    }

    updatedPlayer.lastUpdate = sync.timestamp;
    return updatedPlayer;
  }

  // Vérifier si une position est valide (anti-triche)
  public validatePosition(
    oldPosition: Vector3,
    newPosition: Vector3,
    maxSpeed: number,
    timeDelta: number
  ): boolean {
    const distance = Math.sqrt(
      Math.pow(newPosition.x - oldPosition.x, 2) +
      Math.pow(newPosition.y - oldPosition.y, 2) +
      Math.pow(newPosition.z - oldPosition.z, 2)
    );

    const maxDistance = maxSpeed * (timeDelta / 1000); // Convertir en m/s
    return distance <= maxDistance * 1.5; // 50% de marge pour la latence
  }

  // Définir l'intervalle de synchronisation
  public setSyncInterval(interval: number): void {
    this.syncInterval = interval;
  }
}

export const positionSyncService = PositionSyncService.getInstance();

