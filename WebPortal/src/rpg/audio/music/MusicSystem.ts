// ══════════════════════════════════════════════════════════════════════════════
// audio/music/MusicSystem.ts — Système de musique (sous-système modulaire)
//
// Stub prêt pour l'implémentation complète. Remplace progressivement la
// gestion de musique embarquée dans utils/AudioManager.ts.
// ══════════════════════════════════════════════════════════════════════════════

import type { IMusicSystem } from '../types';

export class MusicSystem implements IMusicSystem {
  private _ctx: AudioContext | null = null;
  private _currentTheme: string | null = null;
  private _volume = 0.4;
  private _currentSource: AudioBufferSourceNode | null = null;
  private _currentGain: GainNode | null = null;
  private _token = 0; // anti-orphelin

  init(ctx: AudioContext): void {
    this._ctx = ctx;
  }

  playTheme(themeId: string): void {
    this._currentTheme = themeId;
    // TODO P2: Charger et décoder le fichier audio correspondant à themeId
    // via AudioContext.decodeAudioData() + créer AudioBufferSourceNode
    if (this._ctx) {
      const token = ++this._token;
      // Stub: le logging indique l'intention
      console.log(`[MusicSystem] playTheme("${themeId}") — sera implémenté jour 2`);
    }
  }

  stop(): void {
    this._token++; // invalide toute lecture en cours
    if (this._currentSource && this._ctx) {
      try {
        this._currentGain?.gain.setTargetAtTime(0, this._ctx.currentTime, 0.2);
        setTimeout(() => {
          try { this._currentSource?.stop(); } catch { /* déjà arrêté */ }
        }, 400);
      } catch { /* ignore */ }
    }
    this._currentSource = null;
    this._currentGain = null;
    this._currentTheme = null;
  }

  fadeTo(themeId: string, durationMs: number): void {
    // TODO P2: Fade-out de la piste courante → playTheme → fade-in
    this.playTheme(themeId);
  }

  setVolume(vol: number): void {
    this._volume = Math.max(0, Math.min(1, vol));
    if (this._currentGain && this._ctx) {
      this._currentGain.gain.setTargetAtTime(this._volume, this._ctx.currentTime, 0.1);
    }
  }

  update(_dt: number): void {
    // Vide pour l'instant — sera utilisé pour le beat-sync, etc.
  }

  dispose(): void {
    this.stop();
    this._ctx = null;
  }

  get currentTheme(): string | null { return this._currentTheme; }
  get volume(): number { return this._volume; }
}
