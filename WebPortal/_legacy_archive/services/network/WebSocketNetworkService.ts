import { NetworkServiceBase } from './NetworkServiceBase';
import { NetworkMessage, NetworkConfig, OnlinePlayer, GameInstance, NetworkMessageType, ConnectionState } from '../../types/network';

/**
 * Implémentation WebSocket du service réseau
 * À utiliser pour les connexions client-serveur classiques
 */
export class WebSocketNetworkService extends NetworkServiceBase {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;

  protected async doConnect(): Promise<boolean> {
    if (!this.config?.serverUrl) {
      throw new Error('Server URL is required for WebSocket connection');
    }

    return new Promise((resolve, reject) => {
      try {
        const url = `${this.config.serverUrl}${this.config.port ? `:${this.config.port}` : ''}`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          resolve(true);
        };

        this.ws.onerror = (error) => {
          reject(error);
        };

        this.ws.onclose = () => {
          this.handleReconnect();
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  protected doDisconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  protected doSend(message: NetworkMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  protected setupListeners(): void {
    if (!this.ws) return;

    this.ws.onmessage = (event) => {
      try {
        const message: NetworkMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
  }

  private handleMessage(message: NetworkMessage): void {
    switch (message.type) {
      case NetworkMessageType.PONG:
        this.updatePing(message);
        break;
      case NetworkMessageType.PLAYER_JOIN:
      case NetworkMessageType.PLAYER_UPDATE:
        this.handlePlayerUpdate(message);
        break;
      case NetworkMessageType.PLAYER_LEAVE:
        this.handlePlayerLeave(message);
        break;
      default:
        this.notifyMessage(message);
    }
  }

  private handlePlayerUpdate(message: NetworkMessage): void {
    const player = message.data as OnlinePlayer;
    this.updatePlayer(player);
    this.notifyMessage(message);
  }

  private handlePlayerLeave(message: NetworkMessage): void {
    const uid = message.data.uid as string;
    this.removePlayer(uid);
    this.notifyMessage(message);
  }

  private updatePing(message: NetworkMessage): void {
    const sentTime = message.data.sentTime as number;
    this.stats.ping = Date.now() - sentTime;
  }

  private handleReconnect(): void {
    if (!this.config || this.reconnectAttempts >= this.config.reconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.connect(this.config!);
    }, this.config.reconnectDelay * this.reconnectAttempts);
  }

  // Ping périodique pour maintenir la connexion
  public startPing(): void {
    if (!this.config) return;

    setInterval(() => {
      if (this.getConnectionState() === ConnectionState.CONNECTED) {
        this.send({
          type: NetworkMessageType.PING,
          timestamp: Date.now(),
          data: { sentTime: Date.now() }
        });
      }
    }, this.config.pingInterval);
  }
}

