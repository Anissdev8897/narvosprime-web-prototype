// ══════════════════════════════════════════════════════════════════════════════
// audio/subsystems.test.ts — Tests des sous-systèmes audio (stubs)
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';
import { MusicSystem } from './music/MusicSystem';
import { SfxSystem } from './sfx/SfxSystem';
import { AmbianceSystem } from './ambiance/AmbianceSystem';
import { VoiceSystem } from './voice/VoiceSystem';
import { FootstepSystem } from './footsteps/FootstepSystem';

// Mock du module CollisionWorld pour FootstepSystem
vi.mock('../runtime/CollisionWorld', () => ({
  collisionWorld: {
    getGroundMaterial: vi.fn(() => ({ materialName: 'Grass', meshName: 'ground' })),
  },
}));

// ── Mock AudioContext minimal ────────────────────────────────────────────────

function mockCtx(): AudioContext {
  return {
    createGain: () => ({
      gain: { value: 0, setValueAtTime: vi.fn(), setTargetAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
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
    destination: {} as AudioDestinationNode,
    currentTime: 0,
    sampleRate: 44100,
  } as unknown as AudioContext;
}

describe('MusicSystem', () => {
  it('init / dispose cycle', () => {
    const ms = new MusicSystem();
    ms.init(mockCtx());
    expect(ms.currentTheme).toBeNull();
    ms.dispose();
  });

  it('playTheme change le thème', () => {
    const ms = new MusicSystem();
    ms.init(mockCtx());
    ms.playTheme('exploration');
    expect(ms.currentTheme).toBe('exploration');
  });

  it('setVolume clamp entre 0 et 1', () => {
    const ms = new MusicSystem();
    ms.setVolume(0.8);
    expect(ms.volume).toBe(0.8);
    ms.setVolume(1.5);
    expect(ms.volume).toBe(1);
  });

  it('stop annule le thème courant', () => {
    const ms = new MusicSystem();
    ms.init(mockCtx());
    ms.playTheme('combat');
    ms.stop();
    expect(ms.currentTheme).toBeNull();
  });

  it('fadeTo appelle playTheme', () => {
    const ms = new MusicSystem();
    ms.init(mockCtx());
    ms.fadeTo('exploration', 1000);
    expect(ms.currentTheme).toBe('exploration');
  });

  it('update est no-op', () => {
    const ms = new MusicSystem();
    expect(() => ms.update(0.016)).not.toThrow();
  });
});

describe('SfxSystem', () => {
  it('init / dispose cycle', () => {
    const sfx = new SfxSystem();
    sfx.init(mockCtx());
    expect(sfx.volume).toBe(0.5);
    sfx.dispose();
  });

  it('play ne lance pas d erreur', () => {
    const sfx = new SfxSystem();
    sfx.init(mockCtx());
    expect(() => sfx.play('explosion')).not.toThrow();
    expect(() => sfx.play('explosion', 0.5)).not.toThrow();
  });

  it('playAt ne lance pas d erreur', () => {
    const sfx = new SfxSystem();
    sfx.init(mockCtx());
    expect(() => sfx.playAt('gunshot', { x: 10, y: 0, z: -5 })).not.toThrow();
  });

  it('preload ne lance pas d erreur', () => {
    const sfx = new SfxSystem();
    expect(() => sfx.preload(['explosion', 'gunshot'])).not.toThrow();
  });

  it('setVolume clamp', () => {
    const sfx = new SfxSystem();
    sfx.setVolume(0.1);
    expect(sfx.volume).toBeCloseTo(0.1);
  });
});

describe('AmbianceSystem', () => {
  it('init / dispose cycle', () => {
    const amb = new AmbianceSystem();
    amb.init(mockCtx());
    amb.dispose();
  });

  it('playMapAmbiance change la map courante', () => {
    const amb = new AmbianceSystem();
    amb.init(mockCtx());
    amb.playMapAmbiance('forge');
    expect(amb.currentMapId).toBe('forge');
  });

  it('stop annule la map courante', () => {
    const amb = new AmbianceSystem();
    amb.init(mockCtx());
    amb.playMapAmbiance('tower');
    amb.stop();
    expect(amb.currentMapId).toBeNull();
  });

  it('setVolume affecte le volume', () => {
    const amb = new AmbianceSystem();
    amb.setVolume(0.7);
    expect(amb.volume).toBeCloseTo(0.7);
  });

  it('playMapAmbiance ne relance pas si même map', () => {
    const amb = new AmbianceSystem();
    amb.init(mockCtx());
    amb.playMapAmbiance('forge');
    // Deuxième appel avec la même map = no-op
    expect(() => amb.playMapAmbiance('forge')).not.toThrow();
  });
});

describe('VoiceSystem', () => {
  it('init / dispose cycle', () => {
    const v = new VoiceSystem();
    v.init(mockCtx());
    v.dispose();
  });

  it('play ne lance pas d erreur', () => {
    const v = new VoiceSystem();
    v.init(mockCtx());
    expect(() => v.play('/voice/greet.mp3')).not.toThrow();
  });

  it('play avec spatial ne lance pas d erreur', () => {
    const v = new VoiceSystem();
    v.init(mockCtx());
    expect(() => v.play('/voice/npc.mp3', {
      position: { x: 5, y: 1.5, z: 0 },
    })).not.toThrow();
  });

  it('announce ne lance pas d erreur', () => {
    const v = new VoiceSystem();
    v.init(mockCtx());
    expect(() => v.announce('double_kill.mp3')).not.toThrow();
  });

  it('setVolume clamp', () => {
    const v = new VoiceSystem();
    v.setVolume(0.5);
    expect(v.volume).toBeCloseTo(0.5);
  });
});

describe('FootstepSystem', () => {
  it('init / dispose cycle', () => {
    const fs = new FootstepSystem();
    fs.init(mockCtx());
    fs.dispose();
  });

  it('play ne lance pas d erreur', () => {
    const fs = new FootstepSystem();
    fs.init(mockCtx());
    expect(() => fs.play({ x: 0, z: 0 })).not.toThrow();
  });

  it('setSurfaceMaterial force la surface', () => {
    const fs = new FootstepSystem();
    fs.setSurfaceMaterial('Stone_Floor');
    expect(fs.lastSurface).toBe('stone');
  });

  it('setVolume clamp', () => {
    const fs = new FootstepSystem();
    fs.setVolume(0.3);
    expect(fs.volume).toBeCloseTo(0.3);
  });
});
