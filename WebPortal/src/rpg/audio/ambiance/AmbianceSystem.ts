// ══════════════════════════════════════════════════════════════════════════════
// audio/ambiance/AmbianceSystem.ts — Système d'ambiances (sous-système modulaire)
//
// Stub. Remplace progressivement la gestion d'ambiance embarquée dans
// utils/AudioManager.ts (AMBIENT, startAmbient, stopAmbient).
// ══════════════════════════════════════════════════════════════════════════════

import type { IAmbianceSystem } from '../types';

export class AmbianceSystem implements IAmbianceSystem {
  private _ctx: AudioContext | null = null;
  private _volume = 0.5;
  private _currentMapId: string | null = null;
  private _activeNodes: { source: AudioBufferSourceNode; gain: GainNode }[] = [];

  init(ctx: AudioContext): void {
    this._ctx = ctx;
  }

  playMapAmbiance(mapId: string): void {
    if (mapId === this._currentMapId) return;
    this.stop();
    this._currentMapId = mapId;
    // TODO P2: Charger les ambiances de la map → createBufferSource + loop + connect
    console.log(`[AmbianceSystem] playMapAmbiance("${mapId}") — sera implémenté jour 2`);
  }

  stop(): void {
    if (this._ctx) {
      for (const node of this._activeNodes) {
        try {
          node.gain.gain.setTargetAtTime(0, this._ctx.currentTime, 0.05);
          setTimeout(() => { try { node.source.stop(); } catch { /* déjà arrêté */ } }, 300);
        } catch { /* ignore */ }
      }
    }
    this._activeNodes = [];
    this._currentMapId = null;
  }

  setVolume(vol: number): void {
    this._volume = Math.max(0, Math.min(1, vol));
    if (this._ctx) {
      for (const node of this._activeNodes) {
        node.gain.gain.setTargetAtTime(this._volume, this._ctx.currentTime, 0.1);
      }
    }
  }

  update(_dt: number): void {
    // Vide pour l'instant — utilisé pour le crossfade progressif
  }

  dispose(): void {
    this.stop();
    this._ctx = null;
  }

  get volume(): number { return this._volume; }
  get currentMapId(): string | null { return this._currentMapId; }
}
