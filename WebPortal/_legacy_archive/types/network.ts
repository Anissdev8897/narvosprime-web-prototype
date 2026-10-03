import { PlayerEntity, Faction, InventoryItem, Vector3, PlayerStatus, EntityType } from '../types';

// Réexporter INetworkService depuis le service
export type { INetworkService } from '../services/network/INetworkService';

// Mode de jeu
export enum GameMode {
  SOLO = 'SOLO',
  MULTIPLAYER = 'MULTIPLAYER'
}

// Type de connexion réseau
export enum NetworkType {
  WEBSOCKET = 'WEBSOCKET',
  WEBRTC = 'WEBRTC',
  DEDICATED_SERVER = 'DEDICATED_SERVER',
  NONE = 'NONE' // Mode solo
}

// État de connexion
export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR'
}

// Types de messages réseau
export enum NetworkMessageType {
  // Connexion
  CONNECT = 'CONNECT',
  DISCONNECT = 'DISCONNECT',
  PING = 'PING',
  PONG = 'PONG',
  
  // Joueurs
  PLAYER_JOIN = 'PLAYER_JOIN',
  PLAYER_LEAVE = 'PLAYER_LEAVE',
  PLAYER_UPDATE = 'PLAYER_UPDATE',
  PLAYER_SPAWN = 'PLAYER_SPAWN',
  PLAYER_DEATH = 'PLAYER_DEATH',
  
  // Synchronisation
  POSITION_UPDATE = 'POSITION_UPDATE',
  ANIMATION_UPDATE = 'ANIMATION_UPDATE',
  INVENTORY_UPDATE = 'INVENTORY_UPDATE',
  STATS_UPDATE = 'STATS_UPDATE',
  COMBAT_UPDATE = 'COMBAT_UPDATE',
  
  // Chat
  CHAT_MESSAGE = 'CHAT_MESSAGE',
  CHAT_SYSTEM = 'CHAT_SYSTEM',
  
  // Instances
  INSTANCE_JOIN = 'INSTANCE_JOIN',
  INSTANCE_LEAVE = 'INSTANCE_LEAVE',
  INSTANCE_UPDATE = 'INSTANCE_UPDATE',
  
  // Validation
  VALIDATION_REQUEST = 'VALIDATION_REQUEST',
  VALIDATION_RESPONSE = 'VALIDATION_RESPONSE',
  
  // Événements
  EVENT_TRIGGER = 'EVENT_TRIGGER',
  EVENT_BROADCAST = 'EVENT_BROADCAST'
}

// Message réseau de base
export interface NetworkMessage {
  type: NetworkMessageType;
  timestamp: number;
  senderId?: string;
  targetId?: string;
  data: any;
  checksum?: string; // Pour validation anti-triche
}

// Données de joueur en ligne
export interface OnlinePlayer {
  uid: string;
  playerId: string;
  username: string;
  faction: Faction;
  position: Vector3;
  rotation: number;
  pitch: number;
  stats: {
    hp: number;
    maxHp: number;
    armor: number;
    maxArmor: number;
  };
  level: number;
  status: PlayerStatus;
  entityType: EntityType;
  isDead: boolean;
  lastUpdate: number;
  ping?: number;
}

// Données de synchronisation
export interface PositionSync {
  uid: string;
  position: Vector3;
  velocity: Vector3;
  rotation: number;
  pitch: number;
  timestamp: number;
}

export interface AnimationSync {
  uid: string;
  animationName: string;
  isPlaying: boolean;
  time: number;
  timestamp: number;
}

export interface InventorySync {
  uid: string;
  inventory: InventoryItem[];
  maxSlots: number;
  timestamp: number;
}

export interface CombatSync {
  uid: string;
  targetUid?: string;
  damage: number;
  attackType: string;
  timestamp: number;
}

// Instance de jeu
export interface GameInstance {
  instanceId: string;
  planetId: string;
  maxPlayers: number;
  currentPlayers: number;
  players: string[]; // UIDs
  isPrivate: boolean;
  password?: string;
  createdAt: number;
}

// Message de chat
export interface ChatMessage {
  uid: string;
  username: string;
  message: string;
  channel: ChatChannel;
  timestamp: number;
  faction?: Faction;
}

export enum ChatChannel {
  GLOBAL = 'GLOBAL',
  FACTION = 'FACTION',
  LOCAL = 'LOCAL',
  PARTY = 'PARTY',
  WHISPER = 'WHISPER',
  SYSTEM = 'SYSTEM'
}

// Validation et permissions
export interface ValidationRequest {
  action: string;
  data: any;
  timestamp: number;
  checksum: string;
}

export interface ValidationResponse {
  valid: boolean;
  reason?: string;
  correctedData?: any;
}

// Configuration réseau
export interface NetworkConfig {
  type: NetworkType;
  serverUrl?: string;
  port?: number;
  reconnectAttempts: number;
  reconnectDelay: number;
  pingInterval: number;
  syncInterval: number;
  enableValidation: boolean;
  enableEncryption: boolean;
}

// Statistiques réseau
export interface NetworkStats {
  ping: number;
  packetLoss: number;
  bytesSent: number;
  bytesReceived: number;
  messagesSent: number;
  messagesReceived: number;
  lastUpdate: number;
}

