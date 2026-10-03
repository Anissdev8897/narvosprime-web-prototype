// ══════════════════════════════════════════════════════════════════════════════
// audio/voice/VoiceSystem.ts — Système de voix (sous-système modulaire)
//
// Stub. Remplace progressivement playVoice(), playAnnouncement(), et
// la gestion des annonces (boss, killstreak, area) embarquée dans
// utils/AudioManager.ts.
// ══════════════════════════════════════════════════════════════════════════════

import type { IVoiceSystem, SpatialParams } from '../types';
import { createSpatialPanner } from '../AudioSpatial';

export class VoiceSystem implements IVoiceSystem {
  private _ctx: AudioContext | null = null;
  private _volume = 1.0;

  init(ctx: AudioContext): void {
    this._ctx = ctx;
  }

  play(url: string, spatial?: SpatialParams): void {
    if (!this._ctx) return;
    const v = Math.max(0, Math.min(1, this._volume));
    if (v < 0.001) return;
    // TODO P2: fetch + decodeAudioData + (PannerNode si spatial) + play
    console.log(`[VoiceSystem] play("${url}") — sera implémenté jour 2`);
  }

  announce(file: string, _priority = 1): void {
    if (!this._ctx) return;
    // TODO P2: File d'annonces séquentielle (comme pumpAnnounce)
    console.log(`[VoiceSystem] announce("${file}") — sera implémenté jour 2`);
  }

  setVolume(vol: number): void {
    this._volume = Math.max(0, Math.min(1, vol));
  }

  update(_dt: number): void {
    // Vide pour l'instant
  }

  dispose(): void {
    this._ctx = null;
  }

  get volume(): number { return this._volume; }
}
