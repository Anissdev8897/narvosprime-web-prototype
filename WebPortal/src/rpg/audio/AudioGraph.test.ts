// ══════════════════════════════════════════════════════════════════════════════
// audio/AudioGraph.test.ts — Tests du graphe audio procédural (MetaSound-like)
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { AudioGraphBuilder } from './AudioGraph';
import { PRESET_REVERB, PRESET_LOW_PASS, PRESET_PING_PONG_DELAY } from './AudioGraph';
import type { AudioGraphPreset, AudioGraphNode } from './types';

// ── Mock AudioContext pour les tests ─────────────────────────────────────────

function mockAudioContext(): AudioContext {
  return {
    createGain: () => ({
      gain: { value: 0, setValueAtTime: vi.fn(), setTargetAtTime: vi.fn() },
      connect: vi.fn().mockReturnThis(),
      disconnect: vi.fn(),
    }),
    createPanner: () => ({
      panningModel: 'HRTF',
      distanceModel: 'inverse',
      refDistance: 1,
      maxDistance: 100,
      rolloffFactor: 1,
      coneInnerAngle: 360,
      coneOuterAngle: 360,
      coneOuterGain: 0,
      positionX: { value: 0 },
      positionY: { value: 0 },
      positionZ: { value: 0 },
      connect: vi.fn().mockReturnThis(),
    }),
    createBiquadFilter: () => ({
      type: 'lowpass',
      frequency: { value: 1000 },
      Q: { value: 1 },
      gain: { value: 0 },
      connect: vi.fn().mockReturnThis(),
    }),
    createDelay: () => ({
      delayTime: { value: 0.5 },
      connect: vi.fn().mockReturnThis(),
    }),
    createDynamicsCompressor: () => ({
      connect: vi.fn().mockReturnThis(),
      threshold: { value: -24 },
      knee: { value: 30 },
      ratio: { value: 12 },
      reduction: { value: 0 },
      attack: { value: 0.003 },
      release: { value: 0.25 },
    }),
    createWaveShaper: () => ({
      curve: null,
      oversample: 'none',
      connect: vi.fn().mockReturnThis(),
    }),
    createOscillator: () => ({
      type: 'sine',
      frequency: { value: 440 },
      start: vi.fn(),
      stop: vi.fn(),
      connect: vi.fn().mockReturnThis(),
    }),
    createConvolver: () => ({
      buffer: null,
      normalize: true,
      connect: vi.fn().mockReturnThis(),
    }),
    createBufferSource: () => ({
      buffer: null,
      loop: false,
      start: vi.fn(),
      stop: vi.fn(),
      connect: vi.fn().mockReturnThis(),
    }),
    createBuffer: vi.fn(() => ({
      getChannelData: vi.fn(() => new Float32Array(100)),
      duration: 0,
      length: 100,
      numberOfChannels: 1,
      sampleRate: 44100,
    })),
    sampleRate: 44100,
    currentTime: 0,
    destination: {} as AudioDestinationNode,
  } as unknown as AudioContext;
}

describe('AudioGraphBuilder', () => {
  it('crée une instance à partir d un preset', () => {
    const ctx = mockAudioContext();
    const builder = new AudioGraphBuilder(ctx);

    const preset: AudioGraphPreset = {
      name: 'test',
      nodes: [
        { type: 'gain', id: 'g1', params: { gain: 0.5 }, outputs: ['g2'] },
        { type: 'gain', id: 'g2', params: { gain: 0.8 }, outputs: [] },
      ],
    };

    const instance = builder.build(preset);
    expect(instance.presetName).toBe('test');
    expect(instance.nodes.size).toBe(2);
    expect(instance.connections).toHaveLength(1);
    expect(instance.connections[0].from).toBe('g1');
    expect(instance.connections[0].to).toBe('g2');
  });

  it('input et output sont détectés automatiquement', () => {
    const ctx = mockAudioContext();
    const builder = new AudioGraphBuilder(ctx);

    const preset: AudioGraphPreset = {
      name: 'chain',
      nodes: [
        { type: 'gain', id: 'in', params: {}, outputs: ['mid'] },
        { type: 'gain', id: 'mid', params: {}, inputs: ['in'], outputs: ['out'] },
        { type: 'gain', id: 'out', params: {}, inputs: ['mid'], outputs: [] },
      ],
    };

    const instance = builder.build(preset);
    expect(instance.input).not.toBeNull();
    expect(instance.output).not.toBeNull();
  });

  it('gère les nœuds de type oscillator', () => {
    const ctx = mockAudioContext();
    const builder = new AudioGraphBuilder(ctx);

    const preset: AudioGraphPreset = {
      name: 'oscTest',
      nodes: [
        { type: 'oscillator', id: 'osc', params: { type: 'sine', frequency: 440 }, outputs: ['amp'] },
        { type: 'gain', id: 'amp', params: { gain: 0.3 }, outputs: [] },
      ],
    };

    const instance = builder.build(preset);
    instance.start();
    expect(instance.nodes.has('osc')).toBe(true);
    expect(instance.nodes.has('amp')).toBe(true);

    instance.stop();
  });

  it('start/stop ne lance pas d erreur si pas d oscillateur', () => {
    const ctx = mockAudioContext();
    const builder = new AudioGraphBuilder(ctx);

    const preset: AudioGraphPreset = {
      name: 'noOsc',
      nodes: [
        { type: 'gain', id: 'g', params: { gain: 1 }, outputs: [] },
      ],
    };

    const instance = builder.build(preset);
    expect(() => instance.start()).not.toThrow();
    expect(() => instance.stop()).not.toThrow();
  });

  it('retourne null pour les types inconnus (pas d erreur)', () => {
    const ctx = mockAudioContext();
    const builder = new AudioGraphBuilder(ctx);

    const preset: AudioGraphPreset = {
      name: 'unknown',
      nodes: [
        // @ts-expect-error — type intentionnellement invalide
        { type: 'invalid_type', id: 'bad', params: {}, outputs: [] },
      ],
    };

    const instance = builder.build(preset);
    expect(instance.nodes.size).toBe(0);
  });
});

describe('Presets prédéfinis', () => {
  it('PRESET_REVERB a la structure attendue', () => {
    expect(PRESET_REVERB.name).toBe('simpleReverb');
    expect(PRESET_REVERB.nodes).toHaveLength(4);
    expect(PRESET_REVERB.nodes[0].type).toBe('gain');
    expect(PRESET_REVERB.nodes[1].type).toBe('gain');
    expect(PRESET_REVERB.nodes[2].type).toBe('convolver');
    expect(PRESET_REVERB.nodes[3].type).toBe('gain');
  });

  it('PRESET_LOW_PASS a la structure attendue', () => {
    expect(PRESET_LOW_PASS.name).toBe('lowPassFilter');
    expect(PRESET_LOW_PASS.nodes).toHaveLength(2);
    expect(PRESET_LOW_PASS.nodes[0].type).toBe('biquadFilter');
    expect(PRESET_LOW_PASS.nodes[0].params?.type).toBe('lowpass');
    expect(PRESET_LOW_PASS.nodes[0].params?.frequency).toBe(800);
  });

  it('PRESET_PING_PONG_DELAY a les 5 nœuds', () => {
    expect(PRESET_PING_PONG_DELAY.name).toBe('pingPongDelay');
    expect(PRESET_PING_PONG_DELAY.nodes).toHaveLength(5);
  });
});
