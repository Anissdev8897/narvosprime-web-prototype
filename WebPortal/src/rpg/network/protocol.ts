// ══════════════════════════════════════════════════════════════════════════════
// network/protocol.ts — Protocole de réplication multijoueur (MessagePack)
//
// Architecture :
//   Le protocole est conçu pour MessagePack (compact, binaire) mais utilise
//   une interface Codec pluggable — le codec JSON sert de fallback/test, le
//   codec MessagePack sera activé quand msgpackr sera installé.
//
// Philosophie (inspirée Iris/UE) :
//   • Le serveur est l'autorité absolue (anti-triche)
//   • Le client envoie des INTENTIONS, pas des résultats
//   • La réplication est delta-compressed : on n'envoie que ce qui a changé
//   • Priorité : les entités proches du joueur sont synchronisées en premier
//   • StateSync périodique (full state) + delta events (changements)
// ══════════════════════════════════════════════════════════════════════════════

// ── Types de messages du protocole ──────────────────────────────────────────

/** Catégorie de paquet pour le routage serveur. */
export enum PacketCategory {
  System     = "system",      // ping, pong, auth, disconnect
  Input      = "input",       // intentions joueur (déplacement, action)
  Replication = "replication", // sync d'état (full + delta)
  Entity     = "entity",       // spawn, destroy, update entité
  Chat       = "chat",         // messages chat
  Admin      = "admin",        // commandes admin
}

/** Sous-types pour chaque catégorie. */
export enum PacketSubType {
  // System
  Ping             = "ping",
  Pong             = "pong",
  AuthRequest      = "auth:request",
  AuthResponse     = "auth:response",
  Disconnect       = "disconnect",
  Error            = "error",

  // Input
  PlayerInput      = "input:player",
  InputAck         = "input:ack",

  // Replication
  FullStateSync    = "repl:full_sync",
  DeltaUpdate      = "repl:delta",
  PriorityUpdate   = "repl:priority",
  Subscribe        = "repl:subscribe",
  Unsubscribe      = "repl:unsubscribe",

  // Entity
  EntitySpawn      = "entity:spawn",
  EntityDestroy    = "entity:destroy",
  EntityUpdate     = "entity:update",
  EntityInterp     = "entity:interp", // données d'interpolation

  // Chat
  ChatSay          = "chat:say",
  ChatBroadcast    = "chat:broadcast",
  ChatWhisper      = "chat:whisper",
}

// ── Structure de paquet unifiée ─────────────────────────────────────────────

/**
 * En-tête commun à TOUS les paquets du protocole.
 * Le payload (data) est typé par le couple category + subType.
 */
export interface PacketHeader {
  /** Identifiant unique du paquet (pour dédoublonnage / réordre). */
  seq: number;
  /** Timestamp d'émission (ms). */
  ts: number;
  /** Catégorie principale (routage). */
  cat: PacketCategory;
  /** Sous-type (action spécifique). */
  sub: PacketSubType;
  /** Token d'authentification (optionnel, mis par le serveur). */
  token?: string;
  /** ID de la session de jeu. */
  sessionId?: string;
  /** Priorité du paquet (0=critique, 255=basse). */
  priority?: number;
}

/** Paquet générique du protocole. */
export interface Packet<T = unknown> {
  header: PacketHeader;
  data: T;
}

// ── Payloads spécifiques ────────────────────────────────────────────────────

/** Système : ping / pong */
export interface PingPayload {
  clientTs: number;   // timestamp client au moment du ping
}

export interface PongPayload {
  clientTs: number;   // timestamp client du ping correspondant
  serverTs: number;   // timestamp serveur au moment du pong
}

/** Authentification */
export interface AuthRequestPayload {
  username: string;
  password: string;
  clientVersion: string;
}

export interface AuthResponsePayload {
  success: boolean;
  playerId?: string;
  token?: string;
  reason?: string;
}

/** Intention du joueur (prédiction côté client, autorité côté serveur). */
export interface PlayerInputPayload {
  inputSeq: number;           // numéro de séquence pour réconciliation
  moveDir: [number, number];  // direction de mouvement (x, z) normalisée
  yaw: number;
  pitch: number;
  buttons: number;            // bitfield : 1=attaque, 2=saut, 4=courir, 8=accroupi…
  timestamp: number;          // temps client
}

/** Paquet d'entrée acquitté par le serveur (réconciliation). */
export interface InputAckPayload {
  inputSeq: number;           // dernier inputSeq traité par le serveur
  serverTick: number;         // tick serveur courant
  correction?: EntityState;   // correction de l'état si désaccord
}

/** État complet d'une entité (full sync). */
export interface EntityState {
  entityId: string;
  pos: [number, number, number];
  rot: [number, number, number, number]; // quaternion
  vel: [number, number, number];
  health: number;
  state: string;   // "idle" | "run" | "jump" | "attack" | "dead"...
  animState: string;
  extra?: Record<string, unknown>;
}

/** Sync complète de l'état d'un groupe d'entités. */
export interface FullStateSyncPayload {
  tick: number;
  serverTime: number;
  entities: EntityState[];
  players: PlayerStatePayload[];
}

/** Delta : seuls les champs qui ont changé sont envoyés. */
export interface EntityDelta {
  entityId: string;
  changed: Partial<EntityState>;
}

export interface DeltaUpdatePayload {
  tick: number;
  baseSeq: number;            // seq de la full sync de référence
  deltas: EntityDelta[];
}

/** Mise à jour à priorité (entités proches d'abord). */
export interface PriorityUpdatePayload {
  tick: number;
  updates: Array<{
    entityId: string;
    dist: number;             // distance au joueur
    changed: Partial<EntityState>;
  }>;
}

/** État d'un autre joueur (pour interpolation). */
export interface PlayerStatePayload {
  playerId: string;
  name: string;
  pos: [number, number, number];
  rotY: number;
  state: string;
}

/** Spawn d'une entité (créée par le serveur). */
export interface EntitySpawnPayload {
  entityId: string;
  entityType: string;
  pos: [number, number, number];
  rot: [number, number, number, number];
  ownerId?: string;
  props?: Record<string, unknown>;
}

/** Destruction d'une entité. */
export interface EntityDestroyPayload {
  entityId: string;
  reason?: string;
}

/** Chat */
export interface ChatPayload {
  from: string;
  text: string;
  channel: string;   // "say" | "global" | "whisper" | "party"
  targetId?: string; // pour whisper
}

// ── Codec : abstraction de sérialisation (MessagePack / JSON) ───────────────

/**
 * Interface Codec — permet de switcher entre JSON (dev/test) et MessagePack (prod).
 *
 * MessagePack est le format cible :
 *   • Encodage binaire compact (≈30% plus petit que JSON)
 *   • Support natif des binaires, nombres, maps
 *   • Parsing plus rapide que JSON
 *
 * JSON sert de fallback pour le développement et les tests unitaires.
 */
export interface Codec {
  /** Encode un paquet en Uint8Array (MessagePack) ou string (JSON). */
  encode<T>(packet: Packet<T>): Uint8Array | string;
  /** Décode un message brut en paquet typé. */
  decode<T>(raw: Uint8Array | string | ArrayBuffer): Packet<T>;
  /** Nom du codec (utile pour le debug). */
  readonly name: string;
}

/**
 * Codec JSON (fallback / développement).
 * Produit des strings lisibles, pratique pour le debug.
 */
export const JsonCodec: Codec = {
  name: "json",
  encode<T>(packet: Packet<T>): string {
    return JSON.stringify(packet);
  },
  decode<T>(raw: Uint8Array | string | ArrayBuffer): Packet<T> {
    const str = typeof raw === "string"
      ? raw
      : new TextDecoder().decode(raw);
    return JSON.parse(str) as Packet<T>;
  },
};

/**
 * Codec MessagePack (production) — stub.
 *
 * NE PAS APPELER TANT QUE msgpackr N'EST PAS INSTALLÉ.
 * Pour activer :
 *   npm install msgpackr
 *   puis décommenter l'import et les lignes encode/decode ci-dessous.
 *
 * Voir msgpackr : https://www.npmjs.com/package/msgpackr
 * Encodage binaire compact, ~2-5x plus rapide que JSON, 30-50% plus petit.
 */
export const MsgPackCodec: Codec = {
  name: "msgpack",
  encode<T>(_packet: Packet<T>): Uint8Array {
    // TODO: Remplacer par msgpackr.encode(packet) quand msgpackr sera installé
    throw new Error(
      "[protocol] MsgPackCodec: msgpackr not installed. " +
      "Run `npm install msgpackr` and update encode/decode impl."
    );
  },
  decode<T>(_raw: Uint8Array | string | ArrayBuffer): Packet<T> {
    throw new Error(
      "[protocol] MsgPackCodec: msgpackr not installed. " +
      "Run `npm install msgpackr` and update encode/decode impl."
    );
  },
};

// ── Compteur de séquence (thread-safe dans un contexte mono-thread JS) ───────

let _seqCounter = 0;

/** Génère un seq number incrémental pour les paquets. */
export function nextSeq(): number {
  return ++_seqCounter;
}

/** Crée un en-tête de paquet avec les champs obligatoires pré-remplis. */
export function createHeader(
  cat: PacketCategory,
  sub: PacketSubType,
  opts?: { token?: string; sessionId?: string; priority?: number },
): PacketHeader {
  return {
    seq: nextSeq(),
    ts: performance.now(),
    cat,
    sub,
    token: opts?.token,
    sessionId: opts?.sessionId,
    priority: opts?.priority ?? 128,
  };
}

/** Crée un paquet prêt à envoyer. */
export function createPacket<T>(
  cat: PacketCategory,
  sub: PacketSubType,
  data: T,
  opts?: { token?: string; sessionId?: string; priority?: number },
): Packet<T> {
  return { header: createHeader(cat, sub, opts), data };
}
