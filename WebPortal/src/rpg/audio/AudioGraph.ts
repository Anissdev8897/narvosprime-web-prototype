// ══════════════════════════════════════════════════════════════════════════════
// audio/AudioGraph.ts — Graphe audio procédural (MetaSound-like)
//
// Permet de construire des chaînes de nœuds Web Audio (gain, filtre, panner,
// delay, compressor, convolver, oscillator, noise, enveloppe) à partir d'une
// description déclarative (AudioGraphPreset). Chaque preset est un mini-graphe
// qui peut être instancié, connecté et piloté en runtime.
// ══════════════════════════════════════════════════════════════════════════════

import type { AudioGraphNode, AudioGraphPreset } from './types';

// ── Résultat d'instanciation d'un preset ─────────────────────────────────────

export interface AudioGraphInstance {
  presetName: string;
  /** Nœuds Web Audio créés (id → node). */
  nodes: Map<string, AudioNode | AudioScheduledSourceNode | OscillatorNode | GainNode>;
  /** Connexions établies. */
  connections: { from: string; to: string }[];
  /** Point d'entrée du graphe (input). */
  input: AudioNode | null;
  /** Point de sortie du graphe (output). */
  output: AudioNode | null;
  /** Démarre les sources (oscillateurs, buffers). */
  start(): void;
  /** Arrête et libère. */
  stop(): void;
}

// ── Constructeur de graphe ───────────────────────────────────────────────────

export class AudioGraphBuilder {
  private _ctx: AudioContext;

  constructor(ctx: AudioContext) {
    this._ctx = ctx;
  }

  /**
   * Instancie un preset : crée tous les nœuds, les connecte selon le graphe,
   * et retourne une instance prête à l'emploi.
   */
  build(preset: AudioGraphPreset): AudioGraphInstance {
    const nodes = new Map<string, AudioNode | AudioScheduledSourceNode>();
    const connections: { from: string; to: string }[] = [];
    let inputNode: AudioNode | null = null;
    let outputNode: AudioNode | null = null;

    // Phase 1 : créer tous les nœuds
    for (const desc of preset.nodes) {
      const node = this._createNode(desc);
      if (node) {
        nodes.set(desc.id, node);
      }
    }

    // Phase 2 : connecter selon le graphe
    for (const desc of preset.nodes) {
      const source = nodes.get(desc.id);
      if (!source) continue;
      if (!desc.outputs || desc.outputs.length === 0) {
        // Dernier nœud sans sortie explicite = output du graphe
        outputNode = source as AudioNode;
      }
      for (const targetId of desc.outputs ?? []) {
        const target = nodes.get(targetId);
        if (target) {
          (source as AudioNode).connect(target as AudioNode);
          connections.push({ from: desc.id, to: targetId });
        }
      }
      // Connexions d'entrée (le premier nœud sans entrée = entrée du graphe)
      if (!desc.inputs || desc.inputs.length === 0) {
        inputNode = source as AudioNode;
      }
    }

    // Phase 3 : wrap avec méthodes start/stop
    const instance: AudioGraphInstance = {
      presetName: preset.name,
      nodes,
      connections,
      input: inputNode,
      output: outputNode,
      start: () => {
        const all = Array.from(nodes.values());
        for (let i = 0; i < all.length; i++) {
          const node = all[i];
          // start() existe sur les sources audio (oscillator, buffer)
          // On utilise try/catch car les types Web Audio ne sont pas
          // disponibles en runtime Node.js (vitest environment: node)
          try {
            if (typeof (node as any).start === 'function') {
              (node as any).start();
            }
          } catch { /* déjà démarré ou type non-source */ }
        }
      },
      stop: () => {
        const all = Array.from(nodes.values());
        for (let i = 0; i < all.length; i++) {
          const node = all[i];
          try {
            if (typeof (node as any).stop === 'function') {
              (node as any).stop();
            }
          } catch { /* déjà arrêté ou type non-source */ }
        }
      },
    };

    return instance;
  }

  /**
   * Crée un nœud Web Audio unique à partir d'une description.
   */
  private _createNode(desc: AudioGraphNode): AudioNode | AudioScheduledSourceNode | null {
    const ctx = this._ctx;
    const p = desc.params ?? {};

    switch (desc.type) {
      case 'gain': {
        const gain = ctx.createGain();
        if (typeof p.gain === 'number') gain.gain.value = p.gain;
        return gain;
      }
      case 'panner': {
        const panner = ctx.createPanner();
        if (typeof p.panningModel === 'string') panner.panningModel = p.panningModel as PanningModelType;
        if (typeof p.distanceModel === 'string') panner.distanceModel = p.distanceModel as DistanceModelType;
        return panner;
      }
      case 'biquadFilter': {
        const filter = ctx.createBiquadFilter();
        if (typeof p.type === 'string') filter.type = p.type as BiquadFilterType;
        if (typeof p.frequency === 'number') filter.frequency.value = p.frequency;
        if (typeof p.Q === 'number') filter.Q.value = p.Q;
        return filter;
      }
      case 'delay': {
        const delay = ctx.createDelay();
        if (typeof p.delayTime === 'number') delay.delayTime.value = p.delayTime;
        return delay;
      }
      case 'dynamicsCompressor': {
        return ctx.createDynamicsCompressor();
      }
      case 'waveShaper': {
        return ctx.createWaveShaper();
      }
      case 'oscillator': {
        const osc = ctx.createOscillator();
        if (typeof p.type === 'string') osc.type = p.type as OscillatorType;
        if (typeof p.frequency === 'number') osc.frequency.value = p.frequency;
        return osc;
      }
      case 'convolver': {
        return ctx.createConvolver();
      }
      case 'noise': {
        // Génère un buffer de bruit blanc
        const length = typeof p.length === 'number' ? p.length : ctx.sampleRate * 0.5;
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        if (typeof p.loop === 'boolean') source.loop = p.loop;
        return source;
      }
      case 'envelope': {
        // Enveloppe = gain node piloté (l'enveloppe est appliquée par le caller)
        const gain = ctx.createGain();
        gain.gain.value = 0;
        return gain;
      }
      case 'mixer': {
        // Mixer = gain node simple (additionne les entrées)
        const gain = ctx.createGain();
        if (typeof p.gain === 'number') gain.gain.value = p.gain;
        return gain;
      }
      default:
        console.warn(`[AudioGraph] Type de nœud inconnu : ${desc.type}`);
        return null;
    }
  }
}

// ── Presets MetaSound-like prédéfinis ────────────────────────────────────────

/** Reverb simple : source → gain → convolver (nécessite un impulse response chargé). */
export const PRESET_REVERB: AudioGraphPreset = {
  name: 'simpleReverb',
  nodes: [
    { type: 'gain', id: 'input_gain', params: { gain: 1 }, inputs: [], outputs: ['reverb_mix'] },
    { type: 'gain', id: 'reverb_mix', params: { gain: 0.3 }, inputs: ['input_gain'], outputs: ['convolver'] },
    { type: 'convolver', id: 'convolver', params: {}, inputs: ['reverb_mix'], outputs: ['output_gain'] },
    { type: 'gain', id: 'output_gain', params: { gain: 1 }, inputs: ['convolver'], outputs: [] },
  ],
};

/** Filtre passe-bas avec fondu : source → biquadFilter(LPF) → gain. */
export const PRESET_LOW_PASS: AudioGraphPreset = {
  name: 'lowPassFilter',
  nodes: [
    { type: 'biquadFilter', id: 'lpf', params: { type: 'lowpass', frequency: 800, Q: 1 }, inputs: [], outputs: ['output_gain'] },
    { type: 'gain', id: 'output_gain', params: { gain: 1 }, inputs: ['lpf'], outputs: [] },
  ],
};

/** Ping-pong delay : source → delayL + delayR → mix. */
export const PRESET_PING_PONG_DELAY: AudioGraphPreset = {
  name: 'pingPongDelay',
  nodes: [
    { type: 'delay', id: 'delayL', params: { delayTime: 0.25 }, inputs: [], outputs: ['gainL'] },
    { type: 'gain', id: 'gainL', params: { gain: 0.5 }, inputs: ['delayL'], outputs: ['mix'] },
    { type: 'delay', id: 'delayR', params: { delayTime: 0.5 }, inputs: [], outputs: ['gainR'] },
    { type: 'gain', id: 'gainR', params: { gain: 0.5 }, inputs: ['delayR'], outputs: ['mix'] },
    { type: 'gain', id: 'mix', params: { gain: 1 }, inputs: ['gainL', 'gainR'], outputs: [] },
  ],
};
