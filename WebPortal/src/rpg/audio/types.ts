// ══════════════════════════════════════════════════════════════════════════════
// audio/types.ts — Types et interfaces partagés de l'architecture audio modulaire
//
// Définit les contrats entre les sous-systèmes : AudioBus, systèmes spécialisés
// (Music, SFX, Ambiance, Voice, Footsteps), spatialisation 3D et audio events.
// ══════════════════════════════════════════════════════════════════════════════

// ── Identifiants de bus de submix ─────────────────────────────────────────────
export type SubmixBusId = 'master' | 'music' | 'sfx' | 'voice' | 'ambient' | 'announce';

// ── Paramètres de volume par bus ──────────────────────────────────────────────
export interface BusVolumes {
  master:   number; // 0–1
  music:    number; // 0–1
  sfx:      number; // 0–1
  voice:    number; // 0–1
  ambient:  number; // 0–1
  announce: number; // 0–1
}

// ── Paramètres de spatialisation 3D ───────────────────────────────────────────
export interface SpatialParams {
  /** Position dans l'espace monde. */
  position: { x: number; y: number; z: number };
  /** Modèle de panoramique HRTF / equalpower. */
  panningModel?: PanningModelType;
  /** Modèle de distance inverse / linear / exponential. */
  distanceModel?: DistanceModelType;
  /** Distance de référence (gain = 1). */
  refDistance?: number;
  /** Distance maximale audible. */
  maxDistance?: number;
  /** Facteur d'atténuation (rolloff). */
  rolloffFactor?: number;
  /** Cône intérieur (angle en deg, 360 = omnidirectionnel). */
  coneInnerAngle?: number;
  /** Cône extérieur. */
  coneOuterAngle?: number;
  /** Gain au-delà du cône extérieur. */
  coneOuterGain?: number;
}

// ── État de l'auditeur (joueur) ──────────────────────────────────────────────
export interface ListenerState {
  position: { x: number; y: number; z: number };
  forward:  { x: number; y: number; z: number };
  up:       { x: number; y: number; z: number };
}

// ── Nœud de graphe audio procédural (MetaSound-like) ─────────────────────────
export type AudioNodeType =
  | 'gain'
  | 'panner'
  | 'biquadFilter'
  | 'convolver'
  | 'delay'
  | 'dynamicsCompressor'
  | 'waveShaper'
  | 'oscillator'
  | 'noise'
  | 'envelope'
  | 'mixer';

export interface AudioGraphNode {
  type: AudioNodeType;
  id: string;
  params?: Record<string, number | string>;
  /** Connexions vers d'autres nœuds (ids). */
  inputs?: string[];
  outputs?: string[];
}

export interface AudioGraphPreset {
  name: string;
  nodes: AudioGraphNode[];
}

// ── Événements audio du jeu ──────────────────────────────────────────────────
export type GameAudioEvent =
  | 'kill'
  | 'death'
  | 'levelUp'
  | 'questAccepted'
  | 'questCompleted'
  | 'bossEngaged'
  | 'bossDefeated'
  | 'mapEnter'
  | 'mapExit'
  | 'damageTaken'
  | 'healReceived'
  | 'itemPickup'
  | 'doorOpen'
  | 'alert'
  | 'footstep'
  | 'jump'
  | 'land'
  | 'swim'
  | 'dive'
  | 'ui_click'
  | 'ui_hover'
  | 'ui_close'
  | 'weather_rain'
  | 'weather_thunder'
  | 'custom';

/** Handler appelé lors d'un événement audio. */
export type AudioEventHandler = (event: GameAudioEvent, payload?: unknown) => void;

// ── Contrat des sous-systèmes audio ──────────────────────────────────────────
export interface IAudioSystem {
  /** Initialise le sous-système (création des nœuds Web Audio, etc.). */
  init(ctx: AudioContext): void;
  /** Met à jour l'état interne (appelé chaque frame si connecté). */
  update?(dt: number): void;
  /** Libère les ressources. */
  dispose(): void;
}

export interface IMusicSystem extends IAudioSystem {
  playTheme(themeId: string): void;
  stop(): void;
  fadeTo(themeId: string, durationMs: number): void;
  setVolume(vol: number): void;
}

export interface ISfxSystem extends IAudioSystem {
  play(key: string, volumeMult?: number): void;
  playAt(key: string, position: { x: number; y: number; z: number }, volumeMult?: number): void;
  preload(keys: string[]): void;
  setVolume(vol: number): void;
}

export interface IAmbianceSystem extends IAudioSystem {
  playMapAmbiance(mapId: string): void;
  stop(): void;
  setVolume(vol: number): void;
}

export interface IVoiceSystem extends IAudioSystem {
  play(url: string, spatial?: SpatialParams): void;
  announce(file: string, priority?: number): void;
  setVolume(vol: number): void;
}

export interface IFootstepSystem extends IAudioSystem {
  play(params: FootstepPlayParams): void;
  setSurfaceMaterial(materialName: string): void;
  setVolume(vol: number): void;
}

export interface FootstepPlayParams {
  x: number;
  z: number;
  volumeMult?: number;
  fromHeight?: number;
}

// ── Submix bus (contrat) ─────────────────────────────────────────────────────
export interface IAudioBus {
  readonly id: SubmixBusId;
  readonly input: GainNode;
  readonly output: GainNode;
  setVolume(vol: number, rampMs?: number): void;
  getVolume(): number;
  connect(destination: AudioNode): void;
  disconnect(): void;
}

// ── AudioManager (contrat du singleton central) ──────────────────────────────
export interface IAudioManager {
  readonly music:    IMusicSystem;
  readonly sfx:      ISfxSystem;
  readonly ambiance: IAmbianceSystem;
  readonly voice:    IVoiceSystem;
  readonly footsteps: IFootstepSystem;
  readonly events:   AudioEventManagerFacade;

  init(): void;
  updateListener(pos: { x: number; y: number; z: number }): void;
  setMasterVolume(vol: number): void;
  getMasterVolume(): number;
  dispose(): void;
}

/** Façade légère des événements audio (délègue aux sous-systèmes). */
export interface AudioEventManagerFacade {
  on(event: GameAudioEvent, handler: AudioEventHandler): void;
  off(event: GameAudioEvent, handler: AudioEventHandler): void;
  emit(event: GameAudioEvent, payload?: unknown): void;
  tick(dt: number): void;
  reset(): void;
}
