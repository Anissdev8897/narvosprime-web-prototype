// ══════════════════════════════════════════════════════════════════════════════
// audio/index.ts — Point d'entrée unique du système audio modulaire
//
// Exporte tout ce dont les consommateurs ont besoin :
//   • Singleton principal → ModularAudioManager
//   • AudioEventManager  → façade événementielle
//   • Types & interfaces → pour le typage
//   • AudioBus           → submix si accès direct nécessaire
//   • AudioSpatial       → spatialisation 3D
//   • AudioGraph         → MetaSound-like
//   • Sous-systèmes      → Music, SFX, Ambiance, Voice, Footsteps
// ══════════════════════════════════════════════════════════════════════════════

// ── Manager central ─────────────────────────────────────────────────────────
export { modularAudio, ModularAudioManager } from './ModularAudioManager';

// ── AudioEventManager (existant, amélioré) ──────────────────────────────────
export { audioEvents, QUEST_VOICE } from './audioEventManager';
export type { GameAudioEvent, AudioEventHandler } from './types';

// ── Submix ──────────────────────────────────────────────────────────────────
export { AudioBus, SubmixGraph, submixGraph, DEFAULT_BUS_VOLUMES } from './AudioBus';
export type { SubmixBusId, IAudioBus } from './types';

// ── Spatialisation 3D ───────────────────────────────────────────────────────
export { AudioListener3D, createSpatialPanner, updatePannerPosition, inverseDistanceAttenuation } from './AudioSpatial';

// ── MetaSound-like (graphe audio) ───────────────────────────────────────────
export { AudioGraphBuilder } from './AudioGraph';
export type { AudioGraphInstance } from './AudioGraph';
export { PRESET_REVERB, PRESET_LOW_PASS, PRESET_PING_PONG_DELAY } from './AudioGraph';
export type { AudioGraphNode, AudioGraphPreset, AudioNodeType } from './types';

// ── Sous-systèmes ──────────────────────────────────────────────────────────
export { MusicSystem } from './music/MusicSystem';
export { SfxSystem } from './sfx/SfxSystem';
export { AmbianceSystem } from './ambiance/AmbianceSystem';
export { VoiceSystem } from './voice/VoiceSystem';
export { FootstepSystem } from './footsteps/FootstepSystem';

// ── Interfaces sous-systèmes ────────────────────────────────────────────────
export type {
  IAudioSystem,
  IMusicSystem,
  ISfxSystem,
  IAmbianceSystem,
  IVoiceSystem,
  IFootstepSystem,
  IAudioManager,
  AudioEventManagerFacade,
} from './types';

// ── Types partagés ─────────────────────────────────────────────────────────
export type {
  BusVolumes,
  SpatialParams,
  ListenerState,
  FootstepPlayParams,
} from './types';

// ── Exports des systèmes existants (backward compat) ────────────────────────
export { KillStreakAudioSystem, killStreakClip, killStreakLabel, KILLSTREAK_WINDOW } from './killStreakAudio';
export { BossWarningAudioSystem, BOSS_AOE_WARNING } from './bossWarningAudio';
export { AreaAnnouncementSystem, AREA_ANNOUNCE, DUNGEON_ANNOUNCE } from './areaAnnouncements';

// ── Footstep system existant ────────────────────────────────────────────────
export {
  detectSurface,
  classifySurface,
  getFootstepUrl,
} from './footstepSystem';
export type { FootstepCategory, GroundSurface } from './footstepSystem';
