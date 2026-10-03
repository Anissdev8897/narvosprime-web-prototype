
class NetworkService {
    private socket: WebSocket | null = null;
    private isConnected: boolean = false;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 10;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    // Callbacks
    private onPacketReceived: ((data: string) => void) | null = null;

    constructor() { }

    public connect(url: string = 'ws://localhost:8082/ws'): void {
        console.log(`[NetworkService] Connecting to Gateway: ${url}`);

        // Nettoyer tout timer de reconnexion précédent
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        try {
            this.socket = new WebSocket(url);

            this.socket.onopen = () => {
                console.log(`[NetworkService] WebSocket Connected!`);
                this.isConnected = true;
                this.reconnectAttempts = 0; // Reset on successful connection
            };

            this.socket.onclose = () => {
                console.log(`[NetworkService] WebSocket Disconnected.`);
                this.isConnected = false;

                // Reconnexion avec backoff exponentiel et limite de tentatives
                if (this.reconnectAttempts < this.maxReconnectAttempts) {
                    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // max 30s
                    this.reconnectAttempts++;
                    console.log(`[NetworkService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                    this.reconnectTimer = setTimeout(() => this.connect(url), delay);
                } else {
                    console.error(`[NetworkService] Max reconnect attempts reached (${this.maxReconnectAttempts}). Giving up.`);
                }
            };

            this.socket.onmessage = (event) => {
                if (this.onPacketReceived) {
                    this.onPacketReceived(event.data);
                }
            };

            this.socket.onerror = (err: any) => {
                console.error(`[NetworkService] WebSocket Error:`, err);
            };
        } catch (e) {
            console.error(`[NetworkService] Failed to create WebSocket:`, e);
        }
    }

    public disconnect(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.isConnected = false;
    }

    public send(packet: string): void {
        if (this.socket && this.isConnected && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(packet);
        } else {
            console.warn(`[NetworkService] Cannot send packet, not connected.`);
        }
    }

    public setPacketHandler(handler: (data: string) => void) {
        this.onPacketReceived = handler;
    }
}

export const networkService = new NetworkService();
