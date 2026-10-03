/**
 * CombatNetworkService.ts - Couche reseau pour le combat multi-joueurs.
 *
 * Sprint 6 (stub) : interface canonique pour synchroniser les actions de combat
 * (move, cast, end_turn) avec le GameServer WebSocket. Pour l'instant, les
 * appels sont silencieusement no-op si la connexion n'est pas etablie.
 *
 * A connecter au Sprint 7 : remplacer le stub par un vrai client WebSocket
 * qui envoie/recoit des messages JSON conformes au protocole NARVOS.
 *
 * Usage cote GameWorld3D :
 *   import { combatNetwork } from '../services/CombatNetworkService';
 *   combatNetwork.sendAction({ type: 'move', entityId: 'player', data: { path } });
 *   combatNetwork.subscribe((evt) => { ... applique l'action recue ... });
 */

export type CombatActionKind = 'move' | 'cast' | 'end_turn' | 'spawn' | 'damage' | 'death';

export interface CombatAction {
  type: CombatActionKind;
  entityId: string;
  data: any;
  origin?: 'local' | 'remote';
  timestamp?: number;
}

type Listener = (action: CombatAction) => void;

class CombatNetworkServiceImpl {
  private ws: WebSocket | null = null;
  private url: string | null = null;
  private listeners: Set<Listener> = new Set();
  private connected = false;
  private autoReconnect = false;
  private reconnectTimer: any = null;

  /**
   * Connecte au GameServer (par defaut ws://127.0.0.1:8082/combat).
   * Aucune connexion etablie automatiquement — il faut appeler connect()
   * explicitement (ex: depuis GameWorld3D quand on entre en combat multi-joueurs).
   */
  connect(url: string = 'ws://127.0.0.1:8082/combat'): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (this.ws && this.connected) { resolve(); return; }
        this.url = url;
        this.ws = new WebSocket(url);
        this.ws.onopen = () => {
          this.connected = true;
          // eslint-disable-next-line no-console
          console.log('[CombatNetwork] connected to', url);
          resolve();
        };
        this.ws.onmessage = (msg) => {
          try {
            const evt = JSON.parse(msg.data);
            // Le serveur emet 'COMBAT_REMOTE_ACTION' avec { fromPlayerId, action, timestamp }
            if (evt.type === 'COMBAT_REMOTE_ACTION' && evt.action) {
              const action: CombatAction = {
                ...evt.action,
                origin: 'remote',
                timestamp: evt.timestamp || Date.now(),
              };
              this.listeners.forEach((l) => l(action));
            }
          } catch (e) { /* ignore malformed */ }
        };
        this.ws.onerror = (e) => { console.warn('[CombatNetwork] error', e); };
        this.ws.onclose = () => {
          this.connected = false;
          if (this.autoReconnect) {
            this.reconnectTimer = setTimeout(() => this.connect(this.url!), 3000);
          }
          reject(new Error('socket closed'));
        };
      } catch (e) { reject(e); }
    });
  }

  disconnect() {
    this.autoReconnect = false;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) {
      try { this.ws.close(); } catch (_) { /* */ }
    }
    this.ws = null;
    this.connected = false;
  }

  /** Envoie une action au serveur (ignore silencieusement si pas connecte). */
  sendAction(action: Omit<CombatAction, 'origin' | 'timestamp'>) {
    if (!this.ws || !this.connected) return;
    try {
      // Sprint 9 : utiliser le packet type du serveur (BROADCAST_COMBAT_ACTION)
      this.ws.send(JSON.stringify({
        type: 'BROADCAST_COMBAT_ACTION',
        data: { ...action, origin: 'local', timestamp: Date.now() },
      }));
    } catch (_) { /* */ }
  }

  /** S'abonne aux actions recues du serveur. Retourne un unsubscribe. */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  isConnected() { return this.connected; }
  setAutoReconnect(v: boolean) { this.autoReconnect = v; }
}

/** Singleton expose globalement. */
export const combatNetwork = new CombatNetworkServiceImpl();

// Egalement attache au window.narvosLauncher.combatNetwork pour usage debug
try {
  const w = window as any;
  if (w && !w.narvosLauncher?.combatNetwork) {
    w.narvosLauncher = w.narvosLauncher || {};
    w.narvosLauncher.combatNetwork = combatNetwork;
  }
} catch (_) { /* SSR safe */ }
