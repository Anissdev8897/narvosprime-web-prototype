// ══════════════════════════════════════════════════════════════════════════════
// audio/AudioBus.ts — Système de submix (Master → Music/SFX/Voice/Ambient)
//
// Chaque bus encapsule un GainNode avec fondu progressif (ramp) et maintient
// une hiérarchie : Master → bus filles → destination AudioContext.
// ══════════════════════════════════════════════════════════════════════════════

import type { SubmixBusId, IAudioBus } from './types';

// ── Constantes ───────────────────────────────────────────────────────────────

/** Durée par défaut du fondu de volume (secondes). */
const DEFAULT_RAMP_SEC = 0.05;

/** Volumes par défaut par bus. */
export const DEFAULT_BUS_VOLUMES: Record<SubmixBusId, number> = {
  master:   1.0,
  music:    0.4,
  sfx:      0.5,
  voice:    1.0,
  ambient:  0.5,
  announce: 0.8,
};

// ── Implémentation du bus ────────────────────────────────────────────────────

/**
 * Submix bus audio avec fondu progressif.
 * Chaque bus encapsule un GainNode et maintient une hiérarchie :
 * Master → bus filles → destination AudioContext.
 */
export class AudioBus implements IAudioBus {
  readonly id: SubmixBusId;
  readonly input: GainNode;
  readonly output: GainNode;
  private _volume: number;

  constructor(
    ctx: AudioContext,
    id: SubmixBusId,
    initialVolume = DEFAULT_BUS_VOLUMES[id] ?? 1.0,
  ) {
    this.id = id;
    this._volume = initialVolume;

    this.input = ctx.createGain();
    this.output = ctx.createGain();
    this.output.gain.setValueAtTime(initialVolume, ctx.currentTime);

    // Par défaut, input → output (prêt à être connecté en série)
    this.input.connect(this.output);
  }

  /** Définit le volume avec fondu progressif optionnel. */
  setVolume(vol: number, rampMs?: number): void {
    this._volume = Math.max(0, Math.min(1, vol));
    const ctx = this.output.context;
    const now = ctx.currentTime;
    const ramp = (rampMs ?? DEFAULT_RAMP_SEC) / 1000;

    if (ramp > 0) {
      this.output.gain.setTargetAtTime(this._volume, now, ramp);
    } else {
      this.output.gain.setValueAtTime(this._volume, now);
    }
  }

  getVolume(): number {
    return this._volume;
  }

  /** Connecte la sortie du bus à une destination AudioNode. */
  connect(destination: AudioNode): void {
    this.output.connect(destination);
  }

  /** Déconnecte la sortie du bus. */
  disconnect(): void {
    this.output.disconnect();
  }

  /** Chaîne de diagnostic. */
  toString(): string {
    return `AudioBus(${this.id}) vol=${this._volume.toFixed(2)}`;
  }
}

// ── Gestionnaire de la hiérarchie de bus ─────────────────────────────────────

/**
 * Gestionnaire hiérarchique des bus de submix.
 * Crée et gère le graphe Master → (music, sfx, voice, ambient, announce).
 *
 * @example
 * ```ts
 * const graph = new SubmixGraph();
 * graph.init(audioCtx);
 * graph.setVolume('music', 0.5);
 * ```
 */
export class SubmixGraph {
  private _buses = new Map<SubmixBusId, AudioBus>();
  private _ctx: AudioContext | null = null;
  private _masterBus: AudioBus | null = null;

  /** Crée le graphe complet avec les connexions Master → filles. */
  init(ctx: AudioContext): void {
    this._ctx = ctx;
    this._buses.clear();

    // Créer le bus Master
    const master = new AudioBus(ctx, 'master', 1.0);
    master.connect(ctx.destination);
    this._masterBus = master;
    this._buses.set('master', master);

    // Créer les bus filles et les connecter au Master
    const childIds: SubmixBusId[] = ['music', 'sfx', 'voice', 'ambient', 'announce'];
    for (const id of childIds) {
      const bus = new AudioBus(ctx, id);
      bus.connect(master.input); // les bus filles → entrée du Master
      this._buses.set(id, bus);
    }
  }

  /** Récupère un bus par son ID. */
  get(id: SubmixBusId): AudioBus {
    const bus = this._buses.get(id);
    if (!bus) throw new Error(`SubmixGraph: bus "${id}" introuvable. Appeler init() d'abord.`);
    return bus;
  }

  /** Raccourci pour définir le volume d'un bus. */
  setVolume(id: SubmixBusId, vol: number, rampMs?: number): void {
    this.get(id).setVolume(vol, rampMs);
  }

  /** Volume actuel d'un bus. */
  getVolume(id: SubmixBusId): number {
    return this.get(id).getVolume();
  }

  /** Libère tous les bus et déconnecte. */
  dispose(): void {
    for (const bus of this._buses.values()) {
      bus.disconnect();
    }
    this._buses.clear();
    this._ctx = null;
    this._masterBus = null;
  }

  /** Retourne l'état courant pour debug. */
  snapshot(): Record<SubmixBusId, number> {
    const snap: Partial<Record<SubmixBusId, number>> = {};
    for (const [id, bus] of this._buses) {
      snap[id] = bus.getVolume();
    }
    return snap as Record<SubmixBusId, number>;
  }

  get masterBus(): AudioBus | null { return this._masterBus; }
  get ctx(): AudioContext | null { return this._ctx; }
}

/**
 * Singleton du graphe de submix pour l'application.
 * Initialisé au premier appel audio (via init()). */
export const submixGraph = new SubmixGraph();
