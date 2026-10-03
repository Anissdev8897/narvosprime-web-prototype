/**
 * 🔌 NARVOS PRIME - CLIENT SOCKET
 * Couche réseau côté client.
 * N'envoie que des INTENTIONS, ne calcule RIEN.
 */

export type PacketType =
    // Auth
    | 'AUTH_LOGIN'
    | 'AUTH_SUCCESS'
    | 'AUTH_FAILED'
    | 'AUTH_LOGOUT'
    // Player State
    | 'REQUEST_STATE'
    | 'PLAYER_STATE'
    | 'REQUEST_CHARACTERS'
    | 'CHARACTERS_LIST'
    | 'CREATE_CHARACTER'
    | 'CHARACTER_CREATED'
    | 'DELETE_CHARACTER'
    | 'DELETE_RESULT'
    | 'REQUEST_MAP_DATA'
    | 'MAP_DATA'
    | 'MAP_STATE'
    // Combat
    | 'START_COMBAT'
    | 'COMBAT_STATE'
    | 'CAST_SPELL'
    | 'SPELL_RESULT'
    | 'MOVE'
    | 'MOVE_RESULT'
    | 'END_TURN'
    | 'COMBAT_END'
    // World
    | 'CHANGE_MAP'
    | 'TELEPORT'
    // Economy
    | 'BUY_ITEM'
    | 'SELL_ITEM'
    | 'USE_ITEM'
    | 'TRADE_REQUEST'
    // Chat
    | 'CHAT_MESSAGE'
    // Assets & Admin
    | 'SAVE_ASSET'
    | 'SAVE_ASSET_RESULT'
    // Errors
    | 'ERROR';

export interface Packet<T = any> {
    type: PacketType;
    token?: string;
    data?: T;
}

export interface SocketConfig {
    url: string;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Event) => void;
}

export class NarvosSocket {
    private ws: WebSocket | null = null;
    private config: SocketConfig;
    private token: string | null = null;
    private handlers: Map<PacketType, ((data: any) => void)[]> = new Map();
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 3;
    private reconnectDelay = 1000;

    constructor(config: SocketConfig) {
        this.config = config;
    }

    /**
     * Connexion au serveur
     */
    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.config.url);

                this.ws.onopen = () => {
                    console.log('[Socket] Connected');
                    this.reconnectAttempts = 0;
                    this.config.onConnect?.();
                    resolve();
                };

                this.ws.onclose = () => {
                    console.log('[Socket] Disconnected');
                    this.config.onDisconnect?.();
                    this.tryReconnect();
                };

                this.ws.onerror = (error) => {
                    console.error('[Socket] Error:', error);
                    this.config.onError?.(error);
                    reject(error);
                };

                this.ws.onmessage = (event) => {
                    try {
                        const packet: Packet = JSON.parse(event.data);
                        this.handlePacket(packet);
                    } catch (e) {
                        console.error('[Socket] Invalid packet:', e);
                    }
                };

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Déconnexion
     */
    disconnect(): void {
        this.maxReconnectAttempts = 0; // Prevent reconnect
        this.ws?.close();
        this.ws = null;
        this.token = null;
    }

    /**
     * Login
     */
    login(username: string, password: string): Promise<{ success: boolean; playerId?: string; token?: string; role?: string }> {
        return new Promise((resolve) => {
            this.once('AUTH_SUCCESS', (data) => {
                this.token = data.token;
                resolve({
                    success: true,
                    playerId: data.playerId,
                    token: data.token,
                    role: data.role || 'USER'
                });
            });

            this.once('AUTH_FAILED', () => {
                resolve({ success: false });
            });

            this.send({ type: 'AUTH_LOGIN', data: { username, password } });
        });
    }

    /**
     * Envoie une intention (pas de calcul, le serveur décide)
     */
    send(packet: Packet): void {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('[Socket] Not connected, cannot send');
            return;
        }

        // Ajoute automatiquement le token
        if (this.token && !packet.token) {
            packet.token = this.token;
        }

        this.ws.send(JSON.stringify(packet));
    }

    /**
     * Demande la liste des personnages
     */
    requestCharacters(): void {
        this.send({ type: 'REQUEST_CHARACTERS' });
    }

    /**
     * Crée un personnage
     */
    createCharacter(data: { name: string, classId: string, gender: string, colors: any, headIndex: number, spriteDataUrl?: string }): void {
        this.send({ type: 'CREATE_CHARACTER', data });
    }

    /**
     * Supprime un personnage
     */
    deleteCharacter(charId: string): void {
        this.send({ type: 'DELETE_CHARACTER', data: { charId } });
    }

    // --- INTENTIONS (ce que le client peut envoyer) ---

    /**
     * Intention de déplacement
     */
    move(targetX: number, targetY: number): void {
        this.send({ type: 'MOVE', data: { x: targetX, y: targetY } });
    }

    /**
     * Intention de lancer un sort
     */
    castSpell(spellId: string, targetX: number, targetY: number): void {
        this.send({ type: 'CAST_SPELL', data: { spellId, x: targetX, y: targetY } });
    }

    /**
     * Fin de tour
     */
    endTurn(): void {
        this.send({ type: 'END_TURN' });
    }

    /**
     * Intention de changer de map
     */
    changeMap(direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'): void {
        this.send({ type: 'CHANGE_MAP', data: { direction } });
    }

    /**
     * Intention d'acheter un item
     */
    buyItem(itemId: string, quantity: number = 1): void {
        this.send({ type: 'BUY_ITEM', data: { itemId, quantity } });
    }

    /**
     * Intention d'utiliser un item
     */
    useItem(itemId: string, slot?: number): void {
        this.send({ type: 'USE_ITEM', data: { itemId, slot } });
    }

    /**
     * Envoie un asset pour sauvegarde sur le serveur
     */
    saveAsset(asset: { type: string, id: string, name: string, base64Content: string, metadata?: any }): Promise<{ success: boolean, url?: string }> {
        return new Promise((resolve) => {
            this.once('SAVE_ASSET_RESULT', (data) => {
                resolve(data);
            });
            this.send({ type: 'SAVE_ASSET', data: asset });
        });
    }

    // --- HANDLERS ---

    /**
     * Écoute un type de paquet
     * @returns Une fonction pour se désabonner
     */
    on(type: PacketType, handler: (data: any) => void): () => void {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, []);
        }
        this.handlers.get(type)!.push(handler);
        return () => this.off(type, handler);
    }

    /**
     * Écoute un paquet une seule fois
     */
    once(type: PacketType, handler: (data: any) => void): void {
        const wrapper = (data: any) => {
            this.off(type, wrapper);
            handler(data);
        };
        this.on(type, wrapper);
    }

    /**
     * Supprime un handler
     */
    off(type: PacketType, handler: (data: any) => void): void {
        const handlers = this.handlers.get(type);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }

    private handlePacket(packet: Packet): void {
        const handlers = this.handlers.get(packet.type);
        if (handlers) {
            for (const handler of handlers) {
                handler(packet.data || packet);
            }
        }

        // Gestion globale des erreurs
        if (packet.type === 'ERROR') {
            console.warn('[Socket] Server error:', packet.data?.message);
        }
    }

    private tryReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('[Socket] Max reconnect attempts reached — serveur hors-ligne');
            this.config.onDisconnect?.();
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;
        console.log(`[Socket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        setTimeout(() => {
            this.connect().catch(() => {
                // Will retry via onclose
            });
        }, delay);
    }
}

// Singleton pour l'application
let socketInstance: NarvosSocket | null = null;

export function getSocket(): NarvosSocket {
    if (!socketInstance) {
        throw new Error('Socket not initialized. Call initSocket() first.');
    }
    return socketInstance;
}

export function initSocket(config: SocketConfig): NarvosSocket {
    socketInstance = new NarvosSocket(config);
    return socketInstance;
}

// Instance globale exportée pour MapRenderer et autres composants
export const socket = initSocket({
    // Le client passe TOUJOURS par la passerelle (jamais Node :8080 directement).
    url: (import.meta as any).env?.VITE_GAME_WS_URL
        || `ws://${window.location.hostname || 'localhost'}:8082/ws`
});