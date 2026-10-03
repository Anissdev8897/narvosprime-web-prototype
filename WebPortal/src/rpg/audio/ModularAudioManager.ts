// ══════════════════════════════════════════════════════════════════════════════
// audio/ModularAudioManager.ts — Gestionnaire audio modulaire central
//
// Singleton qui orchestre l'ensemble des sous-systèmes audio :
//   • SubmixGraph (Master → Music/SFX/Voice/Ambient/Announce)
//   • AudioListener3D (position auditeur)
//   • Sous-systèmes spécialisés : Music, SFX, Ambiance, Voice, Footsteps
//   • AudioEventManager (events gameplay + event-driven)
//
// Conçu pour remplacer progressivement utils/AudioManager.ts sans casser
// le build — les deux coexistent pendant la transition.
//
// Utilisation future :
//   import { modularAudio } from '../audio';
//   modularAudio.init();
//   modularAudio.updateListener(playerPos);
//   modularAudio.music.playTheme('exploration');
//   modularAudio.sfx.playAt('explosion', pos);
// ══════════════════════════════════════════════════════════════════════════════

import { AudioListener3D } from './AudioSpatial';
import { submixGraph, type SubmixGraph } from './AudioBus';
import { MusicSystem } from './music/MusicSystem';
import { SfxSystem } from './sfx/SfxSystem';
import { AmbianceSystem } from './ambiance/AmbianceSystem';
import { VoiceSystem } from './voice/VoiceSystem';
import { FootstepSystem } from './footsteps/FootstepSystem';
import { audioEvents, type AudioEventManager } from './audioEventManager';
import type { IAudioManager, ListenerState } from './types';

// ── Classe principale ────────────────────────────────────────────────────────

export class ModularAudioManager implements IAudioManager {
  private _ctx: AudioContext | null = null;
  private _initialized = false;

  // Sous-systèmes exposés
  readonly music: MusicSystem;
  readonly sfx: SfxSystem;
  readonly ambiance: AmbianceSystem;
  readonly voice: VoiceSystem;
  readonly footsteps: FootstepSystem;

  // Sous-systèmes internes
  readonly listener: AudioListener3D;
  readonly submix: SubmixGraph;
  readonly events: AudioEventManager;

  constructor() {
    this.music = new MusicSystem();
    this.sfx = new SfxSystem();
    this.ambiance = new AmbianceSystem();
    this.voice = new VoiceSystem();
    this.footsteps = new FootstepSystem();
    this.listener = new AudioListener3D();
    this.submix = submixGraph;
    this.events = audioEvents;
  }

  /**
   * Initialise le contexte audio et tous les sous-systèmes.
   * Appelé au premier geste utilisateur (autoplay unlock).
   */
  init(): void {
    if (this._initialized) return;

    try {
      this._ctx = new AudioContext();
    } catch (e) {
      console.error('[ModularAudioManager] Impossible de créer AudioContext:', e);
      return;
    }

    // 1. Créer le graphe de submix
    this.submix.init(this._ctx);

    // 2. Initialiser les sous-systèmes avec le contexte
    this.music.init(this._ctx);
    this.sfx.init(this._ctx);
    this.ambiance.init(this._ctx);
    this.voice.init(this._ctx);
    this.footsteps.init(this._ctx);

    // 3. Connecter les sous-systèmes aux buses appropriées
    // (à faire quand les sous-systèmes auront un nœud output configurable)

    // 4. Initialiser le listener 3D
    this.listener.init(this._ctx);

    // 5. Enregistrer les sous-systèmes dans l'event manager
    this.events.registerSubsystem(this.music);
    this.events.registerSubsystem(this.sfx);
    this.events.registerSubsystem(this.ambiance);
    this.events.registerSubsystem(this.voice);
    this.events.registerSubsystem(this.footsteps);

    this._initialized = true;

    if (import.meta.env.DEV) {
      console.log('[ModularAudioManager] Initialisé avec', this._ctx.sampleRate, 'Hz');
    }
  }

  /** Met à jour la position de l'auditeur chaque frame. */
  updateListener(pos: { x: number; y: number; z: number }): void {
    this.listener.setPosition(pos.x, pos.y, pos.z);
  }

  /** Met à jour la position + orientation complète. */
  updateListenerFull(state: ListenerState): void {
    this.listener.update(state);
  }

  /** Volume master global. */
  setMasterVolume(vol: number): void {
    this.submix.setVolume('master', vol);
  }

  getMasterVolume(): number {
    return this.submix.getVolume('master');
  }

  /** Volume d'un bus spécifique. */
  setBusVolume(busId: 'music' | 'sfx' | 'voice' | 'ambient' | 'announce', vol: number): void {
    this.submix.setVolume(busId, vol);
  }

  /** Tick de tous les sous-systèmes (appelé chaque frame). */
  update(dt: number): void {
    this.events.tick(dt);
  }

  /** Reset à la mort / changement de map. */
  reset(): void {
    this.ambiance.stop();
    this.music.stop();
    this.events.reset();
  }

  /** Libère toutes les ressources. */
  dispose(): void {
    this.music.dispose();
    this.sfx.dispose();
    this.ambiance.dispose();
    this.voice.dispose();
    this.footsteps.dispose();
    this.events.dispose();
    this.listener.dispose();
    this.submix.dispose();
    this._ctx?.close().catch(() => {});
    this._ctx = null;
    this._initialized = false;
  }

  get initialized(): boolean { return this._initialized; }
}

// Singleton exporté pour l'application.
export const modularAudio = new ModularAudioManager();
