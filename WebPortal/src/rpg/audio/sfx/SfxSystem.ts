// ══════════════════════════════════════════════════════════════════════════════
// audio/sfx/SfxSystem.ts — Système SFX (sous-système modulaire)
//
// Stub. Remplace progressivement la gestion SFX embarquée dans
// utils/AudioManager.ts (fireOnce + playSfxKey).
// ══════════════════════════════════════════════════════════════════════════════

import type { ISfxSystem } from '../types';
import { createSpatialPanner } from '../AudioSpatial';

export class SfxSystem implements ISfxSystem {
  private _ctx: AudioContext | null = null;
  private _volume = 0.5;
  private _failedUrls = new Set<string>();

  init(ctx: AudioContext): void {
    this._ctx = ctx;
  }

  play(key: string, volumeMult = 1.0): void {
    if (!this._ctx) return;
    const v = Math.max(0, Math.min(1, this._volume * volumeMult));
    if (v < 0.001) return;
    // TODO P2: Résoudre key → URL → fetch + decodeAudioData → play
    console.log(`[SfxSystem] play("${key}", ${volumeMult}) — sera implémenté jour 2`);
  }

  playAt(key: string, position: { x: number; y: number; z: number }, volumeMult = 1.0): void {
    if (!this._ctx) return;
    const v = Math.max(0, Math.min(1, this._volume * volumeMult));
    if (v < 0.001) return;
    // TODO P2: Comme play() mais avec PannerNode spatialisé
    console.log(`[SfxSystem] playAt("${key}", [${position.x},${position.y},${position.z}], ${volumeMult})`);
  }

  preload(keys: string[]): void {
    // TODO P3: Préchargement des SFX courants
    console.log(`[SfxSystem] preload(${keys.length} keys) — sera implémenté jour 3`);
  }

  setVolume(vol: number): void {
    this._volume = Math.max(0, Math.min(1, vol));
  }

  update(_dt: number): void {
    // Vide pour l'instant
  }

  dispose(): void {
    this._ctx = null;
    this._failedUrls.clear();
  }

  get volume(): number { return this._volume; }
}
