// ══════════════════════════════════════════════════════════════════════════════
// network/NetworkManager.ts — Gestionnaire de connexion réseau
//
// Responsabilités :
//   • Connexion / déconnexion / reconnexion automatique (backoff exponentiel)
//   • Ping / pong pour mesurer la latence
//   • Street du codec (JSON dev / MessagePack prod)
//   • Émission d'événements (connect, disconnect, packet, latency)
//   • File d'attente de paquets en cas de déconnexion
//
// Utilisation :
//   import { networkManager } from "./NetworkManager";
//   networkManager.connect("ws://localhost:8082/ws");
//   networkManager.on("connect", () => { ... });
//   networkManager.send({ header, data });
// ══════════════════════════════════════════════════════════════════════════════

import {
  type Codec,
  type Packet,
  type PacketHeader,
  type PacketCategory,
  type PingPayload,
  type PongPayload,
  JsonCodec,
  PacketSubType,
  createPacket,
  nextSeq,
} from "./protocol";

// ── Types exports ──────────────────────────────────────────────────────────

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

export interface NetworkStats {
  /** État actuel de la connexion. */
  state: ConnectionState;
  /** Latence estimée (ms), basée sur le dernier ping-pong. */
  latencyMs: number;
  /** Dernière latence mesurée (ms). */
  lastPingMs: number;
  /** Nombre de paquets envoyés. */
  packetsSent: number;
  /** Nombre de paquets reçus. */
  packetsReceived: number;
  /** Nombre de bytes reçus. */
  bytesReceived: number;
  /** Nombre de bytes envoyés. */
  bytesSent: number;
  /** Temps écoulé depuis la connexion (ms). */
  uptimeMs: number;
  /** Nombre de tentatives de reconnexion. */
  reconnectAttempts: number;
  /** Timestamp (performance.now) du dernier ping émis. */
  lastPingTs: number;
}

export interface NetworkEvents {
  connect: () => void;
  disconnect: (reason: string) => void;
  reconnect: (attempt: number) => void;
  packet: (packet: Packet<unknown>) => void;
  latency: (ms: number) => void;
  error: (error: Error) => void;
  stateChange: (from: ConnectionState, to: ConnectionState) => void;
}

type Listener<T extends (...args: unknown[]) => void> = T;

// ── Configuration ───────────────────────────────────────────────────────────

export const NETWORK_DEFAULTS = {
  /** URL par défaut du serveur WebSocket. */
  url: "ws://localhost:8082/ws",
  /** Intervalle de ping (ms). */
  pingIntervalMs: 3000,
  /** Timeout de réponse ping (ms) — au-delà, on considère le serveur mort. */
  pingTimeoutMs: 5000,
  /** Délai initial de reconnexion (ms). */
  reconnectBaseMs: 1000,
  /** Délai maximal de reconnexion (ms). */
  reconnectMaxMs: 15000,
  /** Nombre max de tentatives de reconnexion (0 = infini). */
  maxReconnectAttempts: 10,
  /** Taille max de la file d'attente (paquets mis en buffer hors-ligne). */
  maxPendingQueue: 64,
} as const;

// ── NetworkManager ──────────────────────────────────────────────────────────

/**
 * Gestionnaire de connexion réseau.
 *
 * Design :
 *   • Singleton (networkManager) accessible de partout
 *   • Codec pluggable — JSON en dev, MessagePack en prod (via MsgPackCodec)
 *   • Ping automatique pour mesurer la latence
 *   • Reconnexion automatique avec backoff exponentiel + jitter
 *   • File d'attente : les paquets émis hors-ligne sont bufferisés
 *   • Événements typés pour le découplage (ReplicationManager, PredictionManager s'y abonnent)
 */
export class NetworkManager {
  // ── Privé ────────────────────────────────────────────────────────────────
  private _ws: WebSocket | null = null;
  private _codec: Codec;
  private _state: ConnectionState = "disconnected";
  private _url: string = NETWORK_DEFAULTS.url;

  // Statistiques
  private _packetsSent = 0;
  private _packetsReceived = 0;
  private _bytesSent = 0;
  private _bytesReceived = 0;
  private _connectedAt = 0;
  private _lastPingTs = 0;
  private _latencyMs = -1;

  // Reconnexion
  private _reconnectAttempts = 0;
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _shouldReconnect = true;

  // Ping
  private _pingTimer: ReturnType<typeof setInterval> | null = null;
  private _pingTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

  // File d'attente hors-ligne
  private _pendingQueue: Array<{ packet: Packet<unknown>; encoded: Uint8Array | string }> = [];

  // Événements
  private _listeners = new Map<string, Set<Listener<(...args: unknown[]) => void>>>();

  constructor(codec?: Codec) {
    this._codec = codec ?? JsonCodec;
  }

  // ── Propriétés publiques ──────────────────────────────────────────────────

  get state(): ConnectionState { return this._state; }
  get codecName(): string { return this._codec.name; }
  get url(): string { return this._url; }

  get stats(): NetworkStats {
    return {
      state: this._state,
      latencyMs: this._latencyMs,
      lastPingMs: this._latencyMs,
      packetsSent: this._packetsSent,
      packetsReceived: this._packetsReceived,
      bytesReceived: this._bytesReceived,
      bytesSent: this._bytesSent,
      uptimeMs: this._state === "connected" ? performance.now() - this._connectedAt : 0,
      reconnectAttempts: this._reconnectAttempts,
      lastPingTs: this._lastPingTs,
    };
  }

  /** Change le codec en cours de route (utile pour les tests ou le hotswap JSON→MsgPack). */
  setCodec(codec: Codec): void {
    this._codec = codec;
  }

  // ── Connexion / Déconnexion ──────────────────────────────────────────────

  /**
   * Connecte au serveur WebSocket.
   * @param url URL du serveur (défaut: ws://localhost:8082/ws)
   */
  connect(url?: string): void {
    if (this._state === "connecting" || this._state === "connected") {
      console.warn("[NetworkManager] déjà connecté ou en cours de connexion");
      return;
    }

    this._url = url ?? this._url;
    this._setState("connecting");
    this._shouldReconnect = true;

    try {
      this._ws = new WebSocket(this._url);
      this._ws.binaryType = "arraybuffer";

      this._ws.onopen = () => this._onOpen();
      this._ws.onclose = (ev) => this._onClose(ev);
      this._ws.onerror = (ev) => this._onError(ev);
      this._ws.onmessage = (ev) => this._onMessage(ev);
    } catch (err) {
      this._emit("error", err instanceof Error ? err : new Error(String(err)));
      this._setState("disconnected");
    }
  }

  /** Déconnecte proprement. */
  disconnect(): void {
    this._shouldReconnect = false;
    this._clearTimers();
    this._ws?.close(1000, "client disconnect");
    this._ws = null;
    this._setState("disconnected");
    this._reconnectAttempts = 0;
    this._pendingQueue = [];
  }

  // ── Envoi de paquets ──────────────────────────────────────────────────────

  /**
   * Envoie un paquet. Si déconnecté, le paquet est mis en file d'attente.
   * @returns true si le paquet a été envoyé immédiatement, false si mis en file.
   */
  send(packet: Packet<unknown>): boolean {
    const encoded = this._codec.encode(packet);

    if (this._state === "connected" && this._ws?.readyState === WebSocket.OPEN) {
      this._ws.send(encoded);
      this._packetsSent++;
      this._bytesSent += typeof encoded === "string"
        ? new Blob([encoded]).size
        : (encoded as Uint8Array).byteLength;
      return true;
    }

    // Hors-ligne : mettre en file d'attente
    if (this._pendingQueue.length < NETWORK_DEFAULTS.maxPendingQueue) {
      this._pendingQueue.push({ packet, encoded });
    }
    return false;
  }

  /**
   * Envoie un ping pour mesurer la latence.
   * Le serveur devrait répondre avec un pong contenant clientTs + serverTs.
   */
  ping(): void {
    if (this._state !== "connected") return;
    const now = performance.now();
    this._lastPingTs = now;

    const pkt = createPacket<{ clientTs: number }>(
      "system" as unknown as PacketCategory,
      PacketSubType.Ping,
      { clientTs: now },
    );
    this.send(pkt);

    // Timeout : si pas de pong dans le délai, on considère la connexion perdue
    this._pingTimeoutTimer = setTimeout(() => {
      console.warn("[NetworkManager] ping timeout — no pong received");
      this._latencyMs = -1;
      this._emit("latency", -1);
      // Déclencher une reconnexion
      this._ws?.close(4000, "ping timeout");
    }, NETWORK_DEFAULTS.pingTimeoutMs);
  }

  // ── Événements ────────────────────────────────────────────────────────────

  /** S'abonne à un événement réseau. Retourne une fonction de désabonnement. */
  on<K extends keyof NetworkEvents>(event: K, listener: NetworkEvents[K]): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(listener as Listener<(...args: unknown[]) => void>);
    return () => this._listeners.get(event)?.delete(listener as Listener<(...args: unknown[]) => void>);
  }

  /** Se désabonne d'un événement. */
  off<K extends keyof NetworkEvents>(event: K, listener: NetworkEvents[K]): void {
    this._listeners.get(event)?.delete(listener as Listener<(...args: unknown[]) => void>);
  }

  /** Écoute un événement UNE SEULE FOIS. */
  once<K extends keyof NetworkEvents>(event: K, listener: NetworkEvents[K]): void {
    const wrapper = ((...args: unknown[]) => {
      this.off(event, wrapper as NetworkEvents[K]);
      (listener as (...args: unknown[]) => void)(...args);
    }) as NetworkEvents[K];
    this.on(event, wrapper);
  }

  // ── Handlers internes ─────────────────────────────────────────────────────

  private _onOpen(): void {
    console.log(`[NetworkManager] connecté à ${this._url}`);
    this._connectedAt = performance.now();
    this._reconnectAttempts = 0;
    this._setState("connected");

    // Vider la file d'attente
    this._flushPendingQueue();

    // Démarrer le ping périodique
    this._startPing();

    this._emit("connect");
  }

  private _onClose(ev: CloseEvent): void {
    const reason = ev.reason || `code=${ev.code}`;
    console.log(`[NetworkManager] déconnecté: ${reason}`);
    this._clearTimers();
    this._setState("disconnected");

    this._emit("disconnect", reason);

    // Reconnexion automatique
    if (this._shouldReconnect && ev.code !== 1000) {
      this._scheduleReconnect();
    }
  }

  private _onError(ev: Event): void {
    console.error("[NetworkManager] erreur WebSocket:", ev);
    this._emit("error", new Error(`WebSocket error: ${(ev as ErrorEvent).message ?? "inconnu"}`));
  }

  private _onMessage(ev: MessageEvent): void {
    const raw = ev.data as ArrayBuffer | string;
    this._packetsReceived++;
    this._bytesReceived += typeof raw === "string"
      ? new Blob([raw]).size
      : raw.byteLength;

    try {
      const packet = this._codec.decode<unknown>(raw);

      // Intercepter les pongs pour mesurer la latence
      if (
        packet.header.sub === PacketSubType.Pong &&
        typeof (packet.data as PongPayload)?.clientTs === "number"
      ) {
        this._handlePong(packet.data as PongPayload);
      }

      this._emit("packet", packet);
    } catch (err) {
      console.error("[NetworkManager] erreur de décodage:", err);
    }
  }

  // ── Ping / Pong ───────────────────────────────────────────────────────────

  private _handlePong(payload: PongPayload): void {
    if (this._pingTimeoutTimer) {
      clearTimeout(this._pingTimeoutTimer);
      this._pingTimeoutTimer = null;
    }

    const now = performance.now();
    const rtt = now - payload.clientTs;
    this._latencyMs = Math.round(rtt);
    this._emit("latency", this._latencyMs);
  }

  private _startPing(): void {
    this._stopPing();
    this._pingTimer = setInterval(() => this.ping(), NETWORK_DEFAULTS.pingIntervalMs);
  }

  private _stopPing(): void {
    if (this._pingTimer) {
      clearInterval(this._pingTimer);
      this._pingTimer = null;
    }
    if (this._pingTimeoutTimer) {
      clearTimeout(this._pingTimeoutTimer);
      this._pingTimeoutTimer = null;
    }
  }

  // ── Reconnexion ───────────────────────────────────────────────────────────

  private _scheduleReconnect(): void {
    if (!this._shouldReconnect) return;
    if (
      NETWORK_DEFAULTS.maxReconnectAttempts > 0 &&
      this._reconnectAttempts >= NETWORK_DEFAULTS.maxReconnectAttempts
    ) {
      console.warn("[NetworkManager] maximum de tentatives de reconnexion atteint");
      return;
    }

    this._reconnectAttempts++;
    const delay = Math.min(
      NETWORK_DEFAULTS.reconnectBaseMs * Math.pow(2, this._reconnectAttempts - 1) +
        Math.random() * 500, // jitter
      NETWORK_DEFAULTS.reconnectMaxMs,
    );

    console.log(`[NetworkManager] reconnexion dans ${Math.round(delay)}ms (tentative ${this._reconnectAttempts})`);
    this._setState("reconnecting");
    this._emit("reconnect", this._reconnectAttempts);

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this.connect(this._url);
    }, delay);
  }

  private _clearTimers(): void {
    this._stopPing();
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  }

  // ── File d'attente ────────────────────────────────────────────────────────

  private _flushPendingQueue(): void {
    if (this._pendingQueue.length === 0) return;

    const queue = this._pendingQueue;
    this._pendingQueue = [];

    for (const { encoded } of queue) {
      if (this._ws?.readyState === WebSocket.OPEN) {
        this._ws.send(encoded);
        this._packetsSent++;
        this._bytesSent += typeof encoded === "string"
          ? new Blob([encoded]).size
          : (encoded as Uint8Array).byteLength;
      }
    }
  }

  // ── État interne ─────────────────────────────────────────────────────────

  private _setState(newState: ConnectionState): void {
    const old = this._state;
    if (old === newState) return;
    this._state = newState;
    this._emit("stateChange", old, newState);
  }

  private _emit(event: string, ...args: unknown[]): void {
    const handlers = this._listeners.get(event);
    if (handlers && handlers.size > 0) {
      // Copier dans un tableau pour éviter les problèmes d'itération Set avec le target ES2022
      const arr = new Array(handlers.size);
      let i = 0;
      handlers.forEach((h) => { arr[i++] = h; });
      for (let j = 0; j < arr.length; j++) {
        try {
          arr[j](...args);
        } catch (err) {
          console.error(`[NetworkManager] erreur dans le handler '${event}':`, err);
        }
      }
    }
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

/** Instance réseau globale de l'application. */
export const networkManager = new NetworkManager();
