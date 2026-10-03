// ══════════════════════════════════════════════════════════════════════════════
// audio/footsteps/FootstepSystem.ts — Système de pas (sous-système modulaire)
//
// Stub qui wrappe le système existant (footstepSystem.ts) dans l'interface
// IFootstepSystem. L'implémentation complète déléguera à footstepSystem.ts
// pour la détection de surface et la sélection d'URL.
// ══════════════════════════════════════════════════════════════════════════════

import type { IFootstepSystem, FootstepPlayParams } from '../types';

// Import du système existant (détection de surface + sélection d'URL)
import {
  detectSurface,
  getFootstepUrl,
  classifySurface,
  type FootstepCategory,
} from '../footstepSystem';

export class FootstepSystem implements IFootstepSystem {
  private _ctx: AudioContext | null = null;
  private _volume = 0.5;
  private _lastSurface: FootstepCategory | null = null;

  init(ctx: AudioContext): void {
    this._ctx = ctx;
  }

  play(params: FootstepPlayParams): void {
    if (!this._ctx) return;
    const volMult = params.volumeMult ?? 1.0;
    const v = Math.max(0, Math.min(1, this._volume * volMult));
    if (v < 0.001) return;

    // Détection de surface via le système existant
    const surface = detectSurface(params.x, params.z, params.fromHeight ?? 10);
    const category = surface?.category ?? this._lastSurface ?? 'grass';
    this._lastSurface = category;

    const url = getFootstepUrl(category);
    // TODO P2: fetch + decodeAudioData + play via AudioContext
    console.log(`[FootstepSystem] play() → ${category} → ${url}`);
  }

  setSurfaceMaterial(materialName: string): void {
    // Permet de forcer une surface (utile pour les tests / override)
    this._lastSurface = classifySurface(materialName);
  }

  setVolume(vol: number): void {
    this._volume = Math.max(0, Math.min(1, vol));
  }

  update(_dt: number): void {
    // Vide pour l'instant
  }

  dispose(): void {
    this._ctx = null;
    this._lastSurface = null;
  }

  get volume(): number { return this._volume; }
  get lastSurface(): FootstepCategory | null { return this._lastSurface; }
}
