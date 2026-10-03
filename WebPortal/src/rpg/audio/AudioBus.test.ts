// ══════════════════════════════════════════════════════════════════════════════
// audio/AudioBus.test.ts — Tests du système de submix
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioBus, SubmixGraph, DEFAULT_BUS_VOLUMES, submixGraph } from './AudioBus';
import type { SubmixBusId } from './types';

// ── Mock AudioContext (partiel) ──────────────────────────────────────────────

function mockAudioContext(): AudioContext {
  const ctx = {
    createGain: () => {
      const gainNode = {
        gain: { value: 0, setValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
        connect: vi.fn().mockReturnThis(),
        disconnect: vi.fn(),
        context: ctx as unknown as BaseAudioContext,
      };
      return gainNode as unknown as GainNode;
    },
    destination: {} as AudioDestinationNode,
    currentTime: 42,
    sampleRate: 44100,
  };
  return ctx as unknown as AudioContext;
}

describe('AudioBus', () => {
  it('crée un bus avec le volume initial par défaut', () => {
    const ctx = mockAudioContext();
    const bus = new AudioBus(ctx, 'music');
    expect(bus.id).toBe('music');
    expect(bus.getVolume()).toBeCloseTo(DEFAULT_BUS_VOLUMES.music);
  });

  it('crée un bus avec un volume personnalisé', () => {
    const ctx = mockAudioContext();
    const bus = new AudioBus(ctx, 'sfx', 0.75);
    expect(bus.getVolume()).toBeCloseTo(0.75);
  });

  it('setVolume clamp entre 0 et 1', () => {
    const ctx = mockAudioContext();
    const bus = new AudioBus(ctx, 'master', 1);
    bus.setVolume(1.5);
    expect(bus.getVolume()).toBe(1);
    bus.setVolume(-0.5);
    expect(bus.getVolume()).toBe(0);
  });

  it('setVolume avec fondu utilise setTargetAtTime', () => {
    const ctx = mockAudioContext();
    const bus = new AudioBus(ctx, 'voice');
    bus.output.gain.setTargetAtTime = vi.fn();
    bus.setVolume(0.5, 100);
    expect(bus.getVolume()).toBeCloseTo(0.5);
    expect(bus.output.gain.setTargetAtTime).toHaveBeenCalled();
  });

  it('connect et disconnect fonctionnent', () => {
    const ctx = mockAudioContext();
    const bus = new AudioBus(ctx, 'ambient');
    const dest = { connect: vi.fn(), disconnect: vi.fn() } as unknown as AudioNode;

    bus.output.connect = vi.fn();
    bus.output.disconnect = vi.fn();

    bus.connect(dest);
    expect(bus.output.connect).toHaveBeenCalledWith(dest);

    bus.disconnect();
    expect(bus.output.disconnect).toHaveBeenCalled();
  });

  it('toString retourne une chaîne de diagnostic', () => {
    const ctx = mockAudioContext();
    const bus = new AudioBus(ctx, 'music', 0.4);
    expect(bus.toString()).toContain('music');
    expect(bus.toString()).toContain('0.40');
  });
});

describe('SubmixGraph', () => {
  it('init crée le master + 5 bus filles', () => {
    const graph = new SubmixGraph();
    const ctx = mockAudioContext();
    graph.init(ctx);

    expect(graph.masterBus).not.toBeNull();
    expect(graph.get('master').id).toBe('master');
    expect(graph.get('music').id).toBe('music');
    expect(graph.get('sfx').id).toBe('sfx');
    expect(graph.get('voice').id).toBe('voice');
    expect(graph.get('ambient').id).toBe('ambient');
    expect(graph.get('announce').id).toBe('announce');
  });

  it('get lance une erreur si init pas appelé', () => {
    const graph = new SubmixGraph();
    expect(() => graph.get('music')).toThrow('introuvable');
  });

  it('setVolume propage au bon bus', () => {
    const graph = new SubmixGraph();
    const ctx = mockAudioContext();
    graph.init(ctx);

    graph.setVolume('sfx', 0.3);
    expect(graph.getVolume('sfx')).toBeCloseTo(0.3);
    // Les autres bus ne sont pas affectés
    expect(graph.getVolume('master')).toBeCloseTo(1.0);
  });

  it('snapshot retourne l état de tous les bus', () => {
    const graph = new SubmixGraph();
    const ctx = mockAudioContext();
    graph.init(ctx);

    graph.setVolume('music', 0.2);
    const snap = graph.snapshot();
    expect(snap.music).toBeCloseTo(0.2);
    expect(snap.master).toBeCloseTo(1.0);
  });

  it('dispose libère tous les bus', () => {
    const graph = new SubmixGraph();
    const ctx = mockAudioContext();
    graph.init(ctx);
    graph.dispose();
    expect(() => graph.get('master')).toThrow('introuvable');
  });
});

describe('submixGraph singleton', () => {
  it('est le même objet que l import', () => {
    expect(submixGraph).toBeDefined();
    expect(submixGraph).toBeInstanceOf(SubmixGraph);
  });
});
