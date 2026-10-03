import { NetworkServiceBase } from './NetworkServiceBase';
import { NetworkMessage, NetworkConfig, ConnectionState, NetworkMessageType } from '../../types/network';

/**
 * Service réseau pour mode solo
 * Simule un réseau local sans connexion réelle
 * Permet de tester le code multijoueur en mode solo
 */
export class SoloNetworkService extends NetworkServiceBase {
  protected async doConnect(): Promise<boolean> {
    // En mode solo, on simule une connexion instantanée
    return Promise.resolve(true);
  }

  protected doDisconnect(): void {
    // Rien à faire en mode solo
  }

  protected doSend(message: NetworkMessage): boolean {
    // En mode solo, les messages sont traités localement
    // On peut simuler des réponses si nécessaire
    setTimeout(() => {
      // Simuler une réponse locale si nécessaire
      if (message.type === NetworkMessageType.PING) {
        this.notifyMessage({
          type: NetworkMessageType.PONG,
          timestamp: Date.now(),
          data: { sentTime: message.timestamp }
        });
      }
    }, 10);
    return true;
  }

  protected setupListeners(): void {
    // Pas de listeners en mode solo
  }

  public getConnectionState(): ConnectionState {
    return ConnectionState.CONNECTED; // Toujours connecté en solo
  }
}

