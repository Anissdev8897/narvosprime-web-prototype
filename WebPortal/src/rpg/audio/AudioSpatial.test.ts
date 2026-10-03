// ══════════════════════════════════════════════════════════════════════════════
// audio/AudioSpatial.test.ts — Tests du module de spatialisation 3D
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import {
  createSpatialPanner,
  updatePannerPosition,
  AudioListener3D,
  inverseDistanceAttenuation,
  DEFAULT_SPATIAL,
} from './AudioSpatial';
import type { ListenerState } from './types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function mockPannerNode(): PannerNode {
  return {
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
  } as unknown as PannerNode;
}

function mockAudioContext(): AudioContext {
  return {
    createPanner: mockPannerNode,
    listener: {
      positionX: { value: 0 },
      positionY: { value: 0 },
      positionZ: { value: 0 },
      forwardX: { value: 0 },
      forwardY: { value: 0 },
      forwardZ: { value: 0 },
      upX: { value: 0 },
      upY: { value: 0 },
      upZ: { value: 0 },
    },
  } as unknown as AudioContext;
}

describe('DEFAULT_SPATIAL', () => {
  it('a les valeurs par défaut Narvos', () => {
    expect(DEFAULT_SPATIAL.panningModel).toBe('HRTF');
    expect(DEFAULT_SPATIAL.distanceModel).toBe('inverse');
    expect(DEFAULT_SPATIAL.refDistance).toBe(8);
    expect(DEFAULT_SPATIAL.maxDistance).toBe(50);
    expect(DEFAULT_SPATIAL.rolloffFactor).toBe(1.5);
  });
});

describe('createSpatialPanner', () => {
  it('crée un PannerNode avec les paramètres par défaut', () => {
    const ctx = mockAudioContext();
    const panner = createSpatialPanner(ctx);
    expect(panner.panningModel).toBe('HRTF');
    expect(panner.distanceModel).toBe('inverse');
  });

  it('utilise les paramètres fournis', () => {
    const ctx = mockAudioContext();
    const panner = createSpatialPanner(ctx, {
      position: { x: 10, y: 5, z: -3 },
      panningModel: 'equalpower',
      refDistance: 15,
    });
    expect(panner.positionX.value).toBe(10);
    expect(panner.positionY.value).toBe(5);
    expect(panner.positionZ.value).toBe(-3);
    expect(panner.panningModel).toBe('equalpower');
    expect(panner.refDistance).toBe(15);
  });
});

describe('updatePannerPosition', () => {
  it('met à jour les 3 axes', () => {
    const panner = mockPannerNode();
    updatePannerPosition(panner, { x: 20, y: 3, z: -10 });
    expect(panner.positionX.value).toBe(20);
    expect(panner.positionY.value).toBe(3);
    expect(panner.positionZ.value).toBe(-10);
  });
});

describe('AudioListener3D', () => {
  it('update positionne l auditeur avec orientation', () => {
    const ctx = mockAudioContext();
    const listener = new AudioListener3D();
    listener.init(ctx);

    const state: ListenerState = {
      position: { x: 5, y: 1.7, z: 0 },
      forward: { x: 0, y: 0, z: -1 },
      up: { x: 0, y: 1, z: 0 },
    };
    listener.update(state);

    expect(ctx.listener.positionX.value).toBe(5);
    expect(ctx.listener.forwardZ.value).toBe(-1);
    expect(ctx.listener.upY.value).toBe(1);
  });

  it('setPosition garde l orientation par défaut', () => {
    const ctx = mockAudioContext();
    const listener = new AudioListener3D();
    listener.init(ctx);

    listener.setPosition(10, 2, -5);

    expect(ctx.listener.positionX.value).toBe(10);
    expect(ctx.listener.positionZ.value).toBe(-5);
    expect(ctx.listener.forwardZ.value).toBe(-1);
    expect(ctx.listener.upY.value).toBe(1);
  });

  it('update et setPosition sont no-op sans init', () => {
    const listener = new AudioListener3D();
    expect(() => listener.setPosition(1, 2, 3)).not.toThrow();
    expect(() => listener.update({
      position: { x: 0, y: 0, z: 0 },
      forward: { x: 0, y: 0, z: -1 },
      up: { x: 0, y: 1, z: 0 },
    })).not.toThrow();
  });

  it('dispose libère la référence', () => {
    const ctx = mockAudioContext();
    const listener = new AudioListener3D();
    listener.init(ctx);
    listener.dispose();
    // No-op après dispose
    expect(() => listener.setPosition(1, 2, 3)).not.toThrow();
  });
});

describe('inverseDistanceAttenuation', () => {
  it('retourne 1 pour distance <= refDistance', () => {
    expect(inverseDistanceAttenuation(5, 8, 50, 1.5)).toBe(1);
  });

  it('retourne 0 pour distance >= maxDistance', () => {
    expect(inverseDistanceAttenuation(60, 8, 50, 1.5)).toBe(0);
  });

  it('calcule l atténuation dans la zone linéaire', () => {
    const att = inverseDistanceAttenuation(16, 8, 50, 1.5);
    // formule: ref / (ref + rolloff * (dist - ref))
    // = 8 / (8 + 1.5 * 8) = 8 / (8 + 12) = 8/20 = 0.4
    expect(att).toBeCloseTo(0.4);
  });
});
